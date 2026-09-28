import { WAVEFORMS } from '../audio/instruments.js';

// Default scale descriptions per channel. Ranges are bounded on purpose:
// the grammar forbids unbounded pitch ranges and raw value -> Hz mappings.
// Channels with a numeric scale (see SCALABLE_CHANNELS) accept user overrides
// for domain, range, scaleType, and polarity.
export const DEFAULT_SCALES = {
  pitch: { domain: 'auto', range: [48, 72], rangeType: 'midiPentatonic', scaleType: 'linear', polarity: 'positive', clamp: true },
  duration: { domain: 'auto', range: [0.16, 0.64], scaleType: 'linear', polarity: 'positive' },
  volume: { domain: 'auto', range: [0.06, 0.18], scaleType: 'linear', polarity: 'positive' },
  pan: { domain: 'auto', range: [-0.75, 0.75], scaleType: 'linear', polarity: 'positive' },
  rhythm: { domain: 'auto', range: [1, 7], output: 'pulseCount', scaleType: 'linear', polarity: 'positive' },
  timbre: { range: WAVEFORMS },
  chord: { range: 'chordBank' },
  motif: { range: 'motifBank' },
  status: { domain: 'auto', thresholds: [0.25, 0.5, 0.75, 1], scaleType: 'linear', polarity: 'positive' }
};

// Channels whose values map through a numeric scale the user can shape.
// pan only scales when its field is quantitative; nominal pan spreads
// categories evenly across the pan range.
export const SCALABLE_CHANNELS = ['pitch', 'duration', 'volume', 'rhythm', 'pan', 'status'];

export function defaultScale(channel) {
  return DEFAULT_SCALES[channel] ? JSON.parse(JSON.stringify(DEFAULT_SCALES[channel])) : undefined;
}
