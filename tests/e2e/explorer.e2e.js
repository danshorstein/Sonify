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

test('keyboard scrubbing, extremes, anchors, and help work from the explorer', async () => {
  const { page } = app;
  await page.focus('#visualization');
  await page.keyboard.press('ArrowRight');
  assert.match(await app.text('#point-position'), /^2 of 12/);

  await page.keyboard.press('m');
  await app.announced(/Maximum Spend \(\$B\): 1512/);
  await page.keyboard.press('n');
  await app.announced(/Minimum Spend \(\$B\): 49/);

  await page.keyboard.press('a');
  assert.match(await app.text('#anchor-status'), /Anchor:/);

  await page.keyboard.press('?');
  assert.equal(await page.$eval('#help-overlay', (element) => element.hidden), false);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#help-overlay', (element) => element.hidden), true);
});

test('region zoom selects, zooms, and clears', async () => {
  const { page } = app;
  await page.focus('#visualization');
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await app.announced(/Selected points 1 to 3 of 12/);
  await page.keyboard.press('z');
  await app.announced(/Zoomed into points 1 to 3/);
  await page.keyboard.press('x');
  await app.announced(/Selection cleared/);
});

test('the legend plays, speaks the mapping, and stops on request', async () => {
  const { page } = app;
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.click('#legend-button');
  await app.wait(1500);
  const spoken = await page.evaluate(() => window.__spoken);
  assert.match(spoken[0], /Spend \(\$B\) is mapped to pitch/);
  await page.click('#stop-button');
  await app.announced(/Stopped/);
});

test('the spec panel always shows a valid spec for the current state', async () => {
  const spec = await app.spec();
  assert.equal(spec.version, '0.1');
  assert.ok(spec.encoding.pitch && spec.encoding.time);
});

test('imported Vega-Lite examples load, map, and stay explorable', async () => {
  const { page } = app;
  for (const [label, channels] of [
    ['Bar chart', ['time', 'pitch']],
    ['Multi-series line', ['time', 'pitch', 'timbre', 'pan']],
    ['Scatter', ['time', 'pitch', 'timbre', 'volume', 'pan']]
  ]) {
    await page.click(`text=Load example: ${label}`);
    await app.wait(150);
    assert.deepEqual(Object.keys((await app.spec()).encoding), channels, label);
  }
  await page.focus('#visualization');
  await page.keyboard.press('ArrowRight');
  assert.match(await app.text('#point-position'), /^2 of /);
});

test('invalid Vega-Lite input reports an error instead of crashing', async () => {
  const { page } = app;
  await page.fill('#vl-input', '{"mark": "arc", "data": {"values": [{"a": 1}]}}');
  await page.click('#import-vl');
  assert.match(await app.text('#import-error'), /not supported/i);
  await page.fill('#vl-input', 'not json');
  await page.click('#import-vl');
  assert.match(await app.text('#import-error'), /Not valid JSON/);
});
