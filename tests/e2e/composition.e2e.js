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

test('group-by is disabled until a grouped mode is chosen', async () => {
  assert.equal(await app.page.$eval('#composition-group', (element) => element.disabled), true);
});

test('repeat mode groups points, draws one line per group, and reorders scrubbing', async () => {
  const { page } = app;
  await page.selectOption('#composition-mode', 'repeat');
  await app.wait(100);
  const { composition } = await app.spec();
  assert.equal(composition.mode, 'repeat');
  assert.equal(composition.groupBy, 'agency');
  assert.equal(await page.$$eval('svg polyline', (lines) => lines.length), 4);
  assert.match(await app.text('#point-position'), /^1 of 12 · 2021 · Defense/);

  await page.focus('#visualization');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
  assert.match(await app.text('#point-position'), /^4 of 12 · 2021 · Health/);
});

test('playback advances the cursor and speaks group names', async () => {
  const { page } = app;
  await page.keyboard.press('Home');
  await page.evaluate(() => {
    const slider = document.getElementById('tempo-slider');
    slider.value = '1.8';
    slider.dispatchEvent(new Event('input'));
  });
  await page.keyboard.press('Enter');
  const seen = new Set();
  for (let i = 0; i < 24; i += 1) {
    seen.add(await app.text('#point-position'));
    await app.wait(250);
  }
  assert.ok(seen.size >= 6, `cursor moved through several points (saw ${seen.size})`);
  const spoken = await page.evaluate(() => window.__spoken);
  assert.deepEqual(spoken.slice(0, 2), ['Defense', 'Health']);
  await page.keyboard.press('Escape');
});

test('overlay aligns groups on shared time steps', async () => {
  const { page } = app;
  await page.selectOption('#composition-mode', 'overlay');
  await app.wait(100);
  const { composition } = await app.spec();
  assert.equal(composition.overlayBy, 'agency');
  assert.equal(composition.groupBy, null);
  const xs = await page.$$eval('svg circle.viz-point', (circles) => circles.map((circle) => Math.round(Number(circle.getAttribute('cx')))));
  assert.equal(xs.length, 12);
  assert.equal(new Set(xs).size, 3);
});

test('group by can change to another category field', async () => {
  const { page } = app;
  await page.selectOption('#composition-mode', 'group');
  await page.selectOption('#composition-group', 'mission');
  await app.wait(100);
  assert.equal((await app.spec()).composition.groupBy, 'mission');
  assert.match(await app.text('#point-position'), /Security/);
});

test('switching datasets returns to row sequence', async () => {
  await app.page.click('.option-button:nth-child(2)');
  await app.wait(100);
  assert.equal(await app.page.$eval('#composition-mode', (element) => element.value), 'sequence');
});
