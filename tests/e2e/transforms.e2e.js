import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './harness.js';

let app;
before(async () => { app = await startApp(); });
after(async () => {
  const errors = app.errors;
  await app.close();
  assert.deepEqual(errors, [], 'no console errors or warnings');
});

test('filter shrinks the data preview and reports the source row count', async () => {
  assert.equal(await app.tableRows(), 12);
  await app.addTransform('filter', async (page) => {
    await page.selectOption('#tf-field', 'fiscalYear');
    await page.selectOption('#tf-op', '>=');
    await page.fill('#tf-value', '2022');
  });
  assert.equal(await app.tableRows(), 8);
  assert.match(await app.text('#chart-type'), /8 rows.*from 12 rows/);
  await app.announced(/Added Filter: Fiscal Year >= 2022\. 8 rows\./);
});

test('sort defines playback order', async () => {
  await app.addTransform('sort', async (page) => {
    await page.selectOption('#tf-field', 'riskScore');
    await page.selectOption('#tf-order', 'descending');
  });
  const { values } = (await app.spec()).data;
  assert.equal((await app.spec()).transform.length, 2);
  assert.equal(values.length, 12, 'the spec keeps raw data');
  assert.match(await app.text('#point-position'), /^1 of 8 · 2023 · Health/);
});

test('aggregate remaps time and pitch, then removing it restores the original mappings', async () => {
  await app.addTransform('aggregate', async (page) => {
    await page.check('input[name=tf-group][value=agency]');
    await page.selectOption('#tf-agg-op', 'sum');
    await page.selectOption('#tf-agg-field', 'spendBillions');
  });
  let spec = await app.spec();
  assert.equal(spec.encoding.time.field, 'agency');
  assert.equal(spec.encoding.pitch.field, 'sum_spendBillions');
  assert.equal(await app.tableRows(), 4);
  await app.announced(/Mapped time and pitch to the new fields/);

  await app.page.click('#transform-list li:last-child button');
  await app.wait(100);
  spec = await app.spec();
  assert.equal(spec.encoding.time.field, 'fiscalYear');
  assert.equal(spec.encoding.pitch.field, 'spendBillions');
});

test('a transform that would leave no rows is refused', async () => {
  const before = await app.page.$$eval('#transform-list li', (items) => items.length);
  await app.addTransform('filter', async (page) => {
    await page.selectOption('#tf-field', 'fiscalYear');
    await page.selectOption('#tf-op', '>');
    await page.fill('#tf-value', '3000');
  });
  assert.match(await app.text('#transform-message'), /leave no rows/);
  assert.equal(await app.page.$$eval('#transform-list li', (items) => items.length), before);
});

test('bin then aggregate count builds a histogram', async () => {
  await app.page.click('#clear-transforms');
  await app.addTransform('bin', async (page) => {
    await page.selectOption('#tf-field', 'riskScore');
    await page.fill('#tf-step', '10');
  });
  await app.addTransform('aggregate', async (page) => {
    await page.check('input[name=tf-group][value=bin_riskScore]');
    await page.selectOption('#tf-agg-op', 'count');
  });
  const spec = await app.spec();
  assert.equal(spec.encoding.time.field, 'bin_riskScore');
  assert.equal(spec.encoding.pitch.field, 'count');
  assert.equal(await app.tableRows(), 6);
});

test('switching datasets clears transforms', async () => {
  await app.page.click('.option-button:nth-child(2)');
  await app.wait(100);
  assert.equal((await app.spec()).transform.length, 0);
  assert.equal(await app.page.$$eval('#transform-list li', (items) => items.length), 0);
});
