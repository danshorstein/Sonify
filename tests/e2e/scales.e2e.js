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

test('every mapped numeric channel gets a scale card, nominal pan does not', async () => {
  const legends = await app.page.$$eval('#scale-controls .scale-card legend', (nodes) => nodes.map((node) => node.textContent.trim()));
  assert.equal(legends.length, 5);
  assert.ok(legends.some((text) => text.startsWith('Pitch')));
  assert.ok(!legends.some((text) => text.startsWith('Stereo pan')));
});

test('polarity, scale type, range, and domain edits reach the spec and the inspector', async () => {
  const { page } = app;
  await page.selectOption('#scale-pitch-polarity', 'negative');
  await page.selectOption('#scale-pitch-type', 'sqrt');
  await page.fill('#scale-pitch-range-low', '55');
  await page.press('#scale-pitch-range-low', 'Tab');
  await page.fill('#scale-pitch-domain-min', '0');
  await page.press('#scale-pitch-domain-min', 'Tab');

  const scale = (await app.spec()).encoding.pitch.scale;
  assert.equal(scale.polarity, 'negative');
  assert.equal(scale.scaleType, 'sqrt');
  assert.deepEqual(scale.range, [55, 72]);
  assert.deepEqual(scale.domain, [0, null]);
  assert.match(await app.text('#point-inspector'), /pitch\s+spendBillions\s+705\s+\d+/);
});

test('out-of-range values are clamped in place without stealing focus', async () => {
  const { page } = app;
  await page.fill('#scale-pitch-range-high', '500');
  await page.press('#scale-pitch-range-high', 'Tab');
  assert.equal(await page.inputValue('#scale-pitch-range-high'), '96');
  assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'scale-pitch-range-high');
});

test('an inverted domain shows an error and is not applied', async () => {
  const { page } = app;
  await page.fill('#scale-pitch-domain-min', '900');
  await page.fill('#scale-pitch-domain-max', '100');
  await page.press('#scale-pitch-domain-max', 'Tab');
  assert.match(await app.text('#scale-message'), /minimum must be below the maximum/);
  const { domain } = (await app.spec()).encoding.pitch.scale;
  assert.ok(!(domain?.[0] === 900 && domain?.[1] === 100));
});

test('reset restores default scales', async () => {
  await app.page.click('#reset-scales');
  const scale = (await app.spec()).encoding.pitch.scale;
  assert.deepEqual(scale, { domain: 'auto', range: [48, 72], rangeType: 'midiPentatonic', scaleType: 'linear', polarity: 'positive', clamp: true });
  assert.equal(await app.text('#scale-message'), '');
});
