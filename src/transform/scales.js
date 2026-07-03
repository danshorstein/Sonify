// Scale helpers. Per the sonification grammar, raw values are never mapped
// directly to Hz: quantitative values normalize into a bounded pentatonic
// MIDI ladder, and only MIDI notes become frequencies.

export const PENTATONIC_MIDI = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72];

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
