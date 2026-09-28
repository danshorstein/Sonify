// Scale helpers. Per the sonification grammar, raw values are never mapped
// directly to Hz: quantitative values become a unit position in [0, 1], the
// unit position is mapped into a bounded range, and pitch lands on a
// pentatonic MIDI ladder inside that range. Only MIDI notes become frequencies.

export const PENTATONIC_MIDI = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72];
const PENTATONIC_PITCH_CLASSES = [0, 2, 4, 7, 9];

export const SCALE_TYPES = ['linear', 'sqrt', 'log', 'symlog'];

// Hard bounds per channel. The grammar forbids unbounded pitch ranges, so
// user-supplied ranges are clamped into these limits by the UI and rejected
// by validateSpec.
export const RANGE_LIMITS = {
  pitch: [36, 96],
  duration: [0.05, 2],
  volume: [0.02, 0.3],
  pan: [-1, 1],
  rhythm: [1, 10]
};

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function normalize(value, [min, max]) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (Number(value) - min) / (max - min)));
}

export function pentatonicMidi(normalized) {
  const index = Math.max(0, Math.min(PENTATONIC_MIDI.length - 1, Math.round(normalized * (PENTATONIC_MIDI.length - 1))));
  return PENTATONIC_MIDI[index];
}

// The pentatonic notes available inside a MIDI range. A range too narrow to
// contain any pentatonic note collapses to its midpoint.
export function pentatonicLadder([low, high]) {
  const ladder = [];
  for (let midi = Math.ceil(Math.min(low, high)); midi <= Math.floor(Math.max(low, high)); midi += 1) {
    if (PENTATONIC_PITCH_CLASSES.includes(((midi % 12) + 12) % 12)) ladder.push(midi);
  }
  return ladder.length ? ladder : [Math.round((low + high) / 2)];
}

export function ladderMidi(ladder, unit) {
  const index = Math.max(0, Math.min(ladder.length - 1, Math.round(unit * (ladder.length - 1))));
  return ladder[index];
}

export function lerp([low, high], unit) {
  return low + unit * (high - low);
}

const TRANSFORMS = {
  linear: (value) => value,
  sqrt: (value) => Math.sign(value) * Math.sqrt(Math.abs(value)),
  log: (value) => Math.log(value),
  symlog: (value) => Math.sign(value) * Math.log1p(Math.abs(value))
};

// A true log scale needs a strictly positive domain; otherwise fall back to
// symlog, which is log-like but defined through zero.
export function effectiveScaleType(scaleType, [min]) {
  if (!SCALE_TYPES.includes(scaleType)) return 'linear';
  if (scaleType === 'log' && !(min > 0)) return 'symlog';
  return scaleType;
}

// domain: 'auto' | [min, max]; either bound may be null/undefined to mean
// "auto" for that end. Auto bounds come from the values being encoded.
export function resolveDomain(domain, values) {
  const finite = values.filter((value) => Number.isFinite(value));
  const autoMin = finite.length ? Math.min(...finite) : 0;
  const autoMax = finite.length ? Math.max(...finite) : 1;
  if (!Array.isArray(domain)) return [autoMin, autoMax];
  const low = Number.isFinite(Number(domain[0])) && domain[0] !== null && domain[0] !== '' ? Number(domain[0]) : autoMin;
  const high = Number.isFinite(Number(domain[1])) && domain[1] !== null && domain[1] !== '' ? Number(domain[1]) : autoMax;
  return [low, high];
}

// Builds value -> unit position in [0, 1] from a scale description
// ({domain, scaleType, polarity}) over the rows' numeric values. The result
// is always clamped: ranges stay bounded no matter what the data does.
export function createUnitScale(scale = {}, values = []) {
  const domain = resolveDomain(scale.domain, values);
  const type = effectiveScaleType(scale.scaleType, domain);
  const transform = TRANSFORMS[type];
  const lo = transform(Math.min(...domain));
  const hi = transform(Math.max(...domain));
  const negative = scale.polarity === 'negative';

  const unit = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    let t = hi === lo ? 0.5 : (transform(numeric) - lo) / (hi - lo);
    if (!Number.isFinite(t)) t = 0;
    t = Math.max(0, Math.min(1, t));
    return negative ? 1 - t : t;
  };

  return Object.assign(unit, { domain, scaleType: type });
}
