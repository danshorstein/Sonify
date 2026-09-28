import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAudioQueue, speechSeconds } from '../src/compiler/compileAudioQueue.js';
import { compileLegendQueue } from '../src/compiler/compileLegendQueue.js';
import { effectiveComposition, groupRows, MAX_OVERLAY_GROUPS } from '../src/compiler/composition.js';
import { validateSpec } from '../src/spec/validateSpec.js';
import { datasets } from '../src/data/datasets.js';
import { presets } from '../src/spec/defaultMappings.js';
import { buildSpec } from '../src/spec/buildSpec.js';
import { compileEncodedPoints } from '../src/compiler/compileEncodedPoints.js';
import { compileAgency } from './helpers.js';

const withComposition = (composition, extra = {}) => compileAgency({ config: { composition, ...extra } });
const queueFor = ({ spec, points }, options) => compileAudioQueue(points, spec, options);

test('sequence mode is unchanged: uniform steps, no group metadata', () => {
  const result = compileAgency();
  assert.ok(result.points.every((point) => point.position.group === undefined));
  const queue = queueFor(result);
  assert.equal(queue.mode, 'sequence');
  assert.deepEqual(queue.items.map((item) => item.offsetSeconds), result.points.map((_, index) => index * 0.72));
  assert.ok(queue.items.every((item) => item.kind === 'point'));
});

test('group mode orders points group-major with time order inside groups', () => {
  const { points } = withComposition({ mode: 'group', groupBy: 'agency' });
  assert.deepEqual(points.map((point) => point.row.agency), [
    'Defense', 'Defense', 'Defense', 'Health', 'Health', 'Health',
    'Education', 'Education', 'Education', 'Energy', 'Energy', 'Energy'
  ]);
  const defense = points.filter((point) => point.position.group === 'Defense');
  assert.deepEqual(defense.map((point) => point.row.fiscalYear), [2021, 2022, 2023]);
  assert.deepEqual(defense.map((point) => point.position.groupPosition), [0, 1, 2]);
  assert.deepEqual(points.map((point) => point.index), points.map((_, index) => index));
});

test('group mode leaves a gap between groups', () => {
  const queue = queueFor(withComposition({ mode: 'group', groupBy: 'agency' }));
  const offsets = queue.items.map((item) => item.offsetSeconds);
  const step = 0.72;
  assert.equal(offsets[1] - offsets[0], step);
  assert.ok(offsets[3] - offsets[2] > step);
  assert.equal(queue.mode, 'group');
  assert.ok(queue.items.every((item) => item.kind === 'point'));
});

test('repeat mode announces each group before its data', () => {
  const queue = queueFor(withComposition({ mode: 'repeat', groupBy: 'agency' }));
  const speech = queue.items.filter((item) => item.kind === 'speech');
  assert.deepEqual(speech.map((item) => item.text), ['Defense', 'Health', 'Education', 'Energy']);

  const firstPoint = queue.items.find((item) => item.kind === 'point');
  assert.ok(firstPoint.offsetSeconds >= speechSeconds('Defense'));
  assert.equal(queue.items[0].kind, 'speech');

  const kinds = queue.items.map((item) => item.kind);
  assert.deepEqual(kinds.slice(0, 5), ['speech', 'point', 'point', 'point', 'speech']);
  const offsets = queue.items.map((item) => item.offsetSeconds);
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
});

test('repeat mode reserves a real-time speech window at faster tempos', () => {
  const slow = queueFor(withComposition({ mode: 'repeat', groupBy: 'agency' }), { tempo: 1 });
  const fast = queueFor(withComposition({ mode: 'repeat', groupBy: 'agency' }), { tempo: 2 });
  const gapAfterSpeech = (queue, tempo) => (queue.items[1].offsetSeconds - queue.items[0].offsetSeconds) / tempo;
  assert.ok(Math.abs(gapAfterSpeech(slow, 1) - gapAfterSpeech(fast, 2)) < 1e-9);
});

test('overlay mode plays every group together on shared time steps', () => {
  const result = withComposition({ mode: 'overlay', overlayBy: 'agency' });
  const queue = queueFor(result);
  assert.equal(queue.mode, 'overlay');
  assert.equal(queue.items.length, 12);

  const offsets = [...new Set(queue.items.map((item) => item.offsetSeconds))];
  assert.deepEqual(offsets, [0, 0.72, 1.44]);
  offsets.forEach((offset) => {
    const voices = queue.items.filter((item) => item.offsetSeconds === offset);
    assert.equal(voices.length, 4);
    assert.ok(voices.every((item) => item.simplified === true));
    assert.ok(voices.every((item) => Math.abs(item.gainScale - 0.5) < 1e-9));
    assert.deepEqual(new Set(voices.map((item) => item.point.row.fiscalYear)).size, 1);
  });
  assert.equal(queue.totalSeconds, 3 * 0.72);
});

test('overlay slots follow time order, not group order', () => {
  const rows = [
    { g: 'a', t: 1 }, { g: 'b', t: 1 }, { g: 'a', t: 2 }, { g: 'b', t: 2 }, { g: 'a', t: 3 }
  ];
  const { ordered, slotCount } = groupRows(rows, 'g', 't');
  assert.equal(slotCount, 3);
  const slotFor = (group, t) => ordered.find((entry) => entry.row.g === group && entry.row.t === t).slot;
  assert.equal(slotFor('a', 1), slotFor('b', 1));
  assert.equal(slotFor('a', 3), 2);
});

test('repeated time values inside one group get separate overlay slots', () => {
  const rows = [{ g: 'a', t: 1 }, { g: 'a', t: 1 }, { g: 'b', t: 1 }];
  const { ordered, slotCount } = groupRows(rows, 'g', 't');
  assert.equal(slotCount, 2);
  const slots = ordered.map((entry) => `${entry.row.g}${entry.slot}`);
  assert.deepEqual(slots, ['a0', 'a1', 'b0']);
});

test('overlay play-from-here starts at the current slot across groups', () => {
  const result = withComposition({ mode: 'overlay', overlayBy: 'agency' });
  const secondYear = result.points.find((point) => point.position.slot === 1).index;
  const queue = queueFor(result, { fromIndex: secondYear });
  assert.equal(queue.items[0].offsetSeconds, 0);
  assert.ok(queue.items.every((item) => item.point.position.slot >= 1));
  assert.equal(queue.items.length, 8);
});

test('overlay with too many groups falls back to group sequence with a note', () => {
  const dataset = datasets.find((candidate) => candidate.id === 'ai-monitoring');
  const spec = buildSpec(dataset, presets['ai-monitoring'], { composition: { mode: 'overlay', overlayBy: 'run' } });
  assert.equal(validateSpec(spec).valid, false);
  const points = compileEncodedPoints(spec);
  const queue = compileAudioQueue(points, spec);
  assert.equal(queue.mode, 'group');
  assert.match(queue.note, new RegExp(`at most ${MAX_OVERLAY_GROUPS}`));
});

test('grouped mode without a usable field falls back to sequence', () => {
  const result = withComposition({ mode: 'group', groupBy: null });
  assert.ok(result.points.every((point) => point.position.group === undefined));
  assert.equal(queueFor(result).mode, 'sequence');
  assert.equal(validateSpec(result.spec).valid, false);

  const ghost = withComposition({ mode: 'repeat', groupBy: 'ghost' });
  assert.equal(queueFor(ghost).mode, 'sequence');
  assert.match(validateSpec(ghost.spec).errors.join(' '), /unknown field "ghost"/);
});

test('effectiveComposition explains fallbacks', () => {
  assert.equal(effectiveComposition({ mode: 'group', groupBy: null }, 3).mode, 'sequence');
  assert.equal(effectiveComposition({ mode: 'overlay', overlayBy: 'x' }, 9).mode, 'group');
  assert.equal(effectiveComposition({ mode: 'overlay', overlayBy: 'x' }, 4).mode, 'overlay');
  assert.equal(effectiveComposition({ mode: 'nonsense' }, 4).mode, 'sequence');
});

test('validateSpec accepts valid compositions and rejects bad modes and overloaded overlays', () => {
  assert.equal(validateSpec(withComposition({ mode: 'repeat', groupBy: 'mission' }).spec).valid, true);
  assert.equal(validateSpec(withComposition({ mode: 'overlay', overlayBy: 'agency' }).spec).valid, true);
  assert.equal(validateSpec(withComposition({ mode: 'karaoke' }).spec).valid, false);
});

test('regional zoom still slices grouped points and dilates steps', () => {
  const result = withComposition({ mode: 'group', groupBy: 'agency' });
  const queue = queueFor(result, { region: { start: 0, end: 2 }, dilate: true });
  assert.equal(queue.items.length, 3);
  assert.ok(queue.stepSeconds > 0.72);
});

test('group labels include the group when it is not already the identity field', () => {
  const { points } = withComposition({ mode: 'group', groupBy: 'mission' });
  assert.match(points[0].position.label, /Security/);
  assert.equal(points[0].position.group, 'Security');
});

test('legend explains the composition mode', () => {
  const textFor = (composition) => {
    const { spec, points } = withComposition(composition);
    return compileLegendQueue(spec, points).filter((item) => item.kind === 'speech').map((item) => item.text).join(' ');
  };
  assert.match(textFor({ mode: 'group', groupBy: 'agency' }), /grouped by Agency: Defense, Health, Education, Energy/);
  assert.match(textFor({ mode: 'repeat', groupBy: 'agency' }), /repeats by Agency/);
  assert.match(textFor({ mode: 'overlay', overlayBy: 'agency' }), /overlays Agency/);
  assert.doesNotMatch(textFor({ mode: 'sequence' }), /Playback (is grouped|repeats|overlays)/);
});

test('composition works on top of transforms', () => {
  const { points } = withComposition(
    { mode: 'group', groupBy: 'agency' },
    { transforms: [{ type: 'filter', field: 'agency', op: '!=', value: 'Energy' }] }
  );
  assert.equal(points.length, 9);
  assert.deepEqual([...new Set(points.map((point) => point.position.group))], ['Defense', 'Health', 'Education']);
});
