import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTransforms, describeTransform, niceStep, resolveData } from '../src/transform/transformData.js';
import { validateSpec } from '../src/spec/validateSpec.js';
import { buildSpec } from '../src/spec/buildSpec.js';
import { compileEncodedPoints } from '../src/compiler/compileEncodedPoints.js';
import { compileLegendQueue } from '../src/compiler/compileLegendQueue.js';
import { agencyDataset, compileAgency } from './helpers.js';

const { rows, fields } = agencyDataset();
const run = (transforms) => applyTransforms(rows, transforms, fields);

test('filter supports numeric, string, and contains comparisons', () => {
  assert.equal(run([{ type: 'filter', field: 'fiscalYear', op: '>=', value: 2022 }]).rows.length, 8);
  assert.equal(run([{ type: 'filter', field: 'fiscalYear', op: '>=', value: '2022' }]).rows.length, 8);
  assert.equal(run([{ type: 'filter', field: 'agency', op: '==', value: 'Health' }]).rows.length, 3);
  assert.equal(run([{ type: 'filter', field: 'agency', op: '!=', value: 'Health' }]).rows.length, 9);
  assert.equal(run([{ type: 'filter', field: 'agency', op: 'contains', value: 'ED' }]).rows.length, 3);
  assert.equal(run([{ type: 'filter', field: 'spendBillions', op: '<', value: 100 }]).rows.length, 3);
});

test('filters chain (AND)', () => {
  const result = run([
    { type: 'filter', field: 'fiscalYear', op: '>=', value: 2022 },
    { type: 'filter', field: 'agency', op: '==', value: 'Defense' }
  ]);
  assert.deepEqual(result.rows.map((row) => row.fiscalYear), [2022, 2023]);
  assert.deepEqual(result.steps.map((step) => step.rowCount), [8, 2]);
});

test('sort orders numerically and stably, ascending or descending', () => {
  const ascending = run([{ type: 'sort', field: 'riskScore', order: 'ascending' }]).rows.map((row) => row.riskScore);
  assert.deepEqual(ascending, [...ascending].sort((a, b) => a - b));
  const descending = run([{ type: 'sort', field: 'riskScore', order: 'descending' }]).rows.map((row) => row.riskScore);
  assert.deepEqual(descending, [...descending].sort((a, b) => b - a));
  assert.equal(descending[0], 83);

  const byAgency = run([{ type: 'sort', field: 'agency' }]).rows;
  assert.deepEqual(byAgency.slice(0, 3).map((row) => row.fiscalYear), [2021, 2022, 2023]);
});

test('aggregate groups rows and reports derived fields', () => {
  const result = run([{ type: 'aggregate', groupBy: ['agency'], fields: [
    { field: 'spendBillions', op: 'sum', as: 'totalSpend' },
    { field: 'riskScore', op: 'mean', as: 'avgRisk' },
    { op: 'count', as: 'n' }
  ] }]);
  assert.equal(result.rows.length, 4);
  const defense = result.rows.find((row) => row.agency === 'Defense');
  assert.equal(defense.totalSpend, 705 + 742 + 781);
  assert.equal(defense.avgRisk, Number(((61 + 64 + 66) / 3).toFixed(4)));
  assert.equal(defense.n, 3);
  assert.deepEqual(result.fields.map((field) => field.key), ['agency', 'totalSpend', 'avgRisk', 'n']);
  assert.equal(result.fields.find((field) => field.key === 'totalSpend').type, 'quantitative');
  assert.equal(result.fields.find((field) => field.key === 'agency').type, 'nominal');
});

test('aggregate handles median, min, max, and an overall (ungrouped) group', () => {
  const result = run([{ type: 'aggregate', groupBy: [], fields: [
    { field: 'riskScore', op: 'median', as: 'med' },
    { field: 'riskScore', op: 'min', as: 'lo' },
    { field: 'riskScore', op: 'max', as: 'hi' }
  ] }]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].lo, 37);
  assert.equal(result.rows[0].hi, 83);
  assert.ok(result.rows[0].med >= 37 && result.rows[0].med <= 83);
});

test('bin adds bin start/end fields covering the data, including the maximum', () => {
  const result = run([{ type: 'bin', field: 'riskScore', step: 10, as: 'riskBin' }]);
  assert.equal(result.rows.length, 12);
  result.rows.forEach((row) => {
    assert.ok(row.riskBin <= row.riskScore && row.riskScore < row.riskBin + 10 + 1e-9);
    assert.equal(row.riskBin_end, row.riskBin + 10);
  });
  assert.ok(result.fields.some((field) => field.key === 'riskBin' && field.type === 'quantitative'));
  const auto = run([{ type: 'bin', field: 'riskScore', maxbins: 5, as: 'b' }]);
  assert.ok(new Set(auto.rows.map((row) => row.b)).size <= 6);
  assert.equal(niceStep(3.2), 5);
  assert.equal(niceStep(0.07), 0.1);
});

test('bin then aggregate count builds a histogram', () => {
  const result = run([
    { type: 'bin', field: 'riskScore', step: 20, as: 'riskBin' },
    { type: 'aggregate', groupBy: ['riskBin'], fields: [{ op: 'count', as: 'count' }] }
  ]);
  assert.equal(result.rows.reduce((sum, row) => sum + row.count, 0), 12);
  assert.deepEqual(result.fields.map((field) => field.key), ['riskBin', 'count']);
});

test('invalid steps are skipped and reported, never thrown', () => {
  const result = run([
    { type: 'filter', field: 'nope', op: '>', value: 1 },
    { type: 'sort', field: 'riskScore', order: 'ascending' },
    { type: 'wobble' },
    { type: 'filter', field: 'agency', op: '~', value: 'x' },
    { type: 'filter', field: 'agency', op: '==', value: '' },
    { type: 'aggregate', groupBy: ['ghost'] },
    { type: 'aggregate', groupBy: [], fields: [{ field: 'ghost', op: 'sum' }] },
    { type: 'bin', field: 'agency' }
  ]);
  assert.equal(result.rows.length, 12);
  assert.equal(result.errors.length, 7);
  assert.match(result.errors[0], /Step 1 \(filter\).*unknown field "nope"/);
});

test('a transform after aggregate cannot see dropped fields', () => {
  const result = run([
    { type: 'aggregate', groupBy: ['agency'], fields: [{ field: 'spendBillions', op: 'sum', as: 'total' }] },
    { type: 'filter', field: 'mission', op: '==', value: 'Care' }
  ]);
  assert.equal(result.rows.length, 4);
  assert.equal(result.errors.length, 1);
});

test('input rows are never mutated', () => {
  const before = JSON.stringify(rows);
  run([{ type: 'bin', field: 'riskScore', step: 10 }, { type: 'sort', field: 'riskScore' }]);
  assert.equal(JSON.stringify(rows), before);
});

test('describeTransform produces readable labels', () => {
  assert.equal(describeTransform({ type: 'filter', field: 'spendBillions', op: '>', value: 500 }, fields), 'Filter: Spend ($B) > 500');
  assert.equal(describeTransform({ type: 'sort', field: 'riskScore', order: 'descending' }, fields), 'Sort: Risk Score, descending');
  assert.equal(
    describeTransform({ type: 'aggregate', groupBy: ['agency'], fields: [{ field: 'spendBillions', op: 'mean' }] }, fields),
    'Aggregate: mean of Spend ($B) by Agency'
  );
});

test('buildSpec stores transforms and binds channels to derived fields', () => {
  const transforms = [{ type: 'aggregate', groupBy: ['agency'], fields: [{ field: 'spendBillions', op: 'sum', as: 'totalSpend' }] }];
  const spec = buildSpec(agencyDataset(), { time: 'agency', pitch: 'totalSpend', timbre: 'agency' }, { transforms });
  assert.deepEqual(spec.transform, transforms);
  assert.equal(spec.encoding.pitch.field, 'totalSpend');
  assert.equal(validateSpec(spec).valid, true);

  const points = compileEncodedPoints(spec);
  assert.equal(points.length, 4);
  assert.ok(points.every((point) => point.audio.midi >= 48 && point.audio.midi <= 72));
  assert.deepEqual(resolveData(spec).rows.map((row) => row.agency), ['Defense', 'Health', 'Education', 'Energy']);
});

test('filtered rows sonify fewer points and rescale the auto domain', () => {
  const all = compileAgency().points;
  const filtered = compileAgency({ config: { transforms: [{ type: 'filter', field: 'fiscalYear', op: '==', value: 2023 }] } }).points;
  assert.equal(filtered.length, 4);
  assert.ok(filtered.length < all.length);
  const midis = filtered.map((point) => point.audio.midi);
  assert.equal(Math.max(...midis), 72);
  assert.equal(Math.min(...midis), 48);
});

test('a sort transform defines playback order instead of the time field', () => {
  const { points } = compileAgency({ config: { transforms: [{ type: 'sort', field: 'riskScore', order: 'descending' }] } });
  const risks = points.map((point) => point.row.riskScore);
  assert.deepEqual(risks, [...risks].sort((a, b) => b - a));
  assert.deepEqual(points.map((point) => point.index), points.map((_, index) => index));
});

test('without a sort transform rows still follow the time field', () => {
  const { points } = compileAgency();
  const years = points.map((point) => point.row.fiscalYear);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
});

test('category sounds stay stable when other categories are filtered out', () => {
  const all = compileAgency().points.find((point) => point.row.agency === 'Health' && point.row.fiscalYear === 2022);
  const filtered = compileAgency({ config: { transforms: [{ type: 'filter', field: 'agency', op: '!=', value: 'Defense' }] } })
    .points.find((point) => point.row.agency === 'Health' && point.row.fiscalYear === 2022);
  assert.equal(filtered.audio.waveform, all.audio.waveform);
  assert.deepEqual(filtered.audio.motif, all.audio.motif);
  assert.equal(filtered.audio.pan, all.audio.pan);
});

test('validateSpec reports transform errors and empty results', () => {
  const badField = compileAgency({ config: { transforms: [{ type: 'filter', field: 'ghost', op: '>', value: 1 }] } }).spec;
  const result = validateSpec(badField);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /unknown field "ghost"/);

  const empty = compileAgency({ config: { transforms: [{ type: 'filter', field: 'fiscalYear', op: '>', value: 3000 }] } }).spec;
  const emptyResult = validateSpec(empty);
  assert.equal(emptyResult.valid, false);
  assert.match(emptyResult.errors.join(' '), /no rows/);
});

test('a channel bound to a field the transforms removed fails validation', () => {
  const spec = compileAgency().spec;
  spec.transform = [{ type: 'aggregate', groupBy: ['agency'], fields: [{ op: 'count', as: 'count' }] }];
  const result = validateSpec(spec);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /unknown field/);
});

test('legend reads labels from transformed fields', () => {
  const transforms = [{ type: 'aggregate', groupBy: ['agency'], fields: [{ field: 'spendBillions', op: 'sum', as: 'totalSpend' }] }];
  const spec = buildSpec(agencyDataset(), { time: 'agency', pitch: 'totalSpend' }, { transforms });
  const points = compileEncodedPoints(spec);
  const text = compileLegendQueue(spec, points).filter((item) => item.kind === 'speech').map((item) => item.text).join(' ');
  assert.match(text, /Sum of Spend \(\$B\) is mapped to pitch/);
});
