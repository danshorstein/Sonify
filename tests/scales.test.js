import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnitScale, pentatonicLadder, ladderMidi, lerp, PENTATONIC_MIDI, effectiveScaleType } from '../src/transform/scales.js';
import { validateSpec } from '../src/spec/validateSpec.js';
import { compileLegendQueue } from '../src/compiler/compileLegendQueue.js';
import { compileAgency } from './helpers.js';

test('default pitch ladder is the classic bounded pentatonic ladder', () => {
  assert.deepEqual(pentatonicLadder([48, 72]), PENTATONIC_MIDI);
});

test('narrow ranges shrink the ladder and collapse to the midpoint when empty', () => {
  assert.deepEqual(pentatonicLadder([60, 64]), [60, 62, 64]);
  assert.deepEqual(pentatonicLadder([61, 61]), [61]);
  assert.equal(ladderMidi([60, 62, 64], 1), 64);
  assert.equal(ladderMidi([60, 62, 64], 0), 60);
});

test('unit scale is linear over the auto domain and always clamped', () => {
  const unit = createUnitScale({}, [0, 50, 100]);
  assert.equal(unit(0), 0);
  assert.equal(unit(50), 0.5);
  assert.equal(unit(100), 1);
  assert.equal(unit(500), 1);
  assert.equal(unit(-500), 0);
});

test('negative polarity flips the unit position', () => {
  const unit = createUnitScale({ polarity: 'negative' }, [0, 100]);
  assert.equal(unit(0), 1);
  assert.equal(unit(100), 0);
  assert.equal(unit(25), 0.75);
});

test('sqrt and log change the shape; log falls back to symlog through zero', () => {
  const linear = createUnitScale({ scaleType: 'linear' }, [0, 100]);
  const sqrt = createUnitScale({ scaleType: 'sqrt' }, [0, 100]);
  assert.ok(sqrt(25) > linear(25));
  assert.ok(Math.abs(sqrt(25) - 0.5) < 1e-9);

  const log = createUnitScale({ scaleType: 'log' }, [1, 1000]);
  assert.ok(Math.abs(log(10) - 1 / 3) < 1e-9);
  assert.equal(effectiveScaleType('log', [0, 10]), 'symlog');
  assert.equal(createUnitScale({ scaleType: 'log' }, [0, 100]).scaleType, 'symlog');
});

test('a manual domain overrides auto, either bound may stay auto', () => {
  const unit = createUnitScale({ domain: [0, 200] }, [0, 100]);
  assert.equal(unit(100), 0.5);
  const half = createUnitScale({ domain: [50, null] }, [0, 100]);
  assert.equal(half(75), 0.5);
  assert.deepEqual(half.domain, [50, 100]);
});

test('lerp maps unit positions into a range', () => {
  assert.equal(lerp([0.2, 0.6], 0.5), 0.4);
});

test('default spec compiles to the same pitch ladder as before', () => {
  const { points } = compileAgency();
  points.forEach((point) => assert.ok(PENTATONIC_MIDI.includes(point.audio.midi)));
  const midis = points.map((point) => point.audio.midi);
  assert.equal(Math.max(...midis), 72);
  assert.equal(Math.min(...midis), 48);
});

test('polarity reverses pitch order while staying in range', () => {
  const normal = compileAgency().points;
  const reversed = compileAgency({ config: { scales: { pitch: { polarity: 'negative' } } } }).points;
  const byValue = (points) => [...points].sort((a, b) => a.row.spendBillions - b.row.spendBillions);
  assert.equal(byValue(normal)[0].audio.midi, 48);
  assert.equal(byValue(reversed)[0].audio.midi, 72);
  assert.equal(byValue(reversed).at(-1).audio.midi, 48);
});

test('a narrower pitch range confines every midi note to it', () => {
  const { points } = compileAgency({ config: { scales: { pitch: { range: [55, 67] } } } });
  points.forEach((point) => assert.ok(point.audio.midi >= 55 && point.audio.midi <= 67));
});

test('sqrt changes scaled pitch output for skewed data', () => {
  const linear = compileAgency().points;
  const sqrt = compileAgency({ config: { scales: { pitch: { scaleType: 'sqrt' } } } }).points;
  const meanMidi = (points) => points.reduce((sum, point) => sum + point.audio.midi, 0) / points.length;
  assert.ok(meanMidi(sqrt) > meanMidi(linear));
});

test('domain overrides shift the encoded values', () => {
  const auto = compileAgency().points;
  const wide = compileAgency({ config: { scales: { pitch: { domain: [0, 5000] } } } }).points;
  const meanMidi = (points) => points.reduce((sum, point) => sum + point.audio.midi, 0) / points.length;
  assert.ok(meanMidi(wide) < meanMidi(auto));
});

test('duration, volume, pan and rhythm honor their ranges', () => {
  const { points } = compileAgency({
    config: {
      scales: {
        duration: { range: [0.2, 0.3] },
        volume: { range: [0.1, 0.12] },
        pan: { range: [-0.25, 0.25] },
        rhythm: { range: [2, 4] }
      }
    }
  });
  points.forEach(({ audio }) => {
    assert.ok(audio.duration >= 0.2 - 1e-9 && audio.duration <= 0.3 + 1e-9);
    assert.ok(audio.gain >= 0.1 - 1e-9 && audio.gain <= 0.12 + 1e-9);
    assert.ok(audio.pan >= -0.25 - 1e-9 && audio.pan <= 0.25 + 1e-9);
    assert.ok(audio.pulseCount >= 2 && audio.pulseCount <= 4);
  });
});

test('validateSpec accepts default scales and rejects unbounded or malformed ones', () => {
  assert.equal(validateSpec(compileAgency().spec).valid, true);

  const bad = (scale) => validateSpec(compileAgency({ config: { scales: { pitch: scale } } }).spec);
  assert.equal(bad({ range: [0, 200] }).valid, false);
  assert.equal(bad({ range: [72, 48] }).valid, false);
  assert.equal(bad({ scaleType: 'cubic' }).valid, false);
  assert.equal(bad({ polarity: 'sideways' }).valid, false);
  assert.equal(bad({ domain: [10, 5] }).valid, false);
  assert.equal(bad({ domain: [null, 5] }).valid, true);
});

test('legend explains reversed and non-linear scales', () => {
  const { spec, points } = compileAgency({ config: { scales: { pitch: { polarity: 'negative', scaleType: 'log' } } } });
  const text = compileLegendQueue(spec, points).filter((item) => item.kind === 'speech').map((item) => item.text).join(' ');
  assert.match(text, /higher values sound lower/);
  assert.match(text, /logarithmic scale/);
});
