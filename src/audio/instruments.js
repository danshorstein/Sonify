// Identity encodings: chords, motifs, and status harmonies over a shared
// tonal center (C). Category = identity, per the sonification grammar.

export const WAVEFORMS = ['sine', 'triangle', 'square', 'sawtooth'];

export const CHORD_BANK = [
  [48, 52, 55, 60],
  [48, 53, 57, 60],
  [48, 55, 62, 65],
  [48, 50, 55, 60],
  [48, 51, 55, 58],
  [48, 52, 59, 64]
];

export const MOTIF_BANK = [
  [60, 64, 62],
  [60, 57, 62],
  [55, 60, 67],
  [64, 62, 60],
  [60, 65, 64],
  [57, 60, 62]
];

// Consonant -> suspended -> minor -> tense, mapped over normalized risk.
export const STATUS_STATES = [
  { threshold: 0.25, name: 'stable', chord: [43, 48, 52, 55], wave: 'sine', volume: 0.025 },
  { threshold: 0.5, name: 'watch', chord: [43, 48, 53, 55], wave: 'triangle', volume: 0.03 },
  { threshold: 0.75, name: 'elevated', chord: [43, 46, 50, 55], wave: 'triangle', volume: 0.035 },
  { threshold: 1, name: 'critical', chord: [43, 46, 49, 54], wave: 'sawtooth', volume: 0.03 }
];

// thresholds (optional) are four ascending upper bounds, one per state, from
// the status channel's scale description; they default to the built-in ones.
export function statusStateFor(normalized, thresholds) {
  const index = STATUS_STATES.findIndex((state, i) => normalized <= (thresholds?.[i] ?? state.threshold));
  return STATUS_STATES[index === -1 ? STATUS_STATES.length - 1 : index];
}
