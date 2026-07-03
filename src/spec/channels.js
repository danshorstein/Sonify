export const channelDefinitions = [
  { key: 'time', label: 'Time / sequence', accepted: ['temporal', 'quantitative', 'nominal'], description: 'Controls the order in which rows are heard. This is the audio equivalent of the x-axis.' },
  { key: 'pitch', label: 'Pitch / register', accepted: ['quantitative'], description: 'Maps numeric magnitude to a bounded pentatonic pitch range.' },
  { key: 'timbre', label: 'Timbre / waveform', accepted: ['nominal'], description: 'Maps categories to oscillator character: sine, triangle, square, or sawtooth.' },
  { key: 'chord', label: 'Chord identity', accepted: ['nominal'], description: 'Maps categories to short chord identities over a shared tonal center.' },
  { key: 'motif', label: 'Motif identity', accepted: ['nominal'], description: 'Maps categories to a short melodic signature before the value tone.' },
  { key: 'duration', label: 'Duration', accepted: ['quantitative'], description: 'Maps numeric magnitude to how long the main tone lasts.' },
  { key: 'rhythm', label: 'Rhythm density', accepted: ['quantitative'], description: 'Maps numeric magnitude to pulse density layered around the main tone.' },
  { key: 'volume', label: 'Volume / salience', accepted: ['quantitative'], description: 'Maps numeric magnitude to loudness. Used gently because volume is a weak primary data channel.' },
  { key: 'pan', label: 'Stereo pan', accepted: ['quantitative', 'nominal'], description: 'Maps values or categories left-to-right as a redundant separation cue.' },
  { key: 'status', label: 'Status harmony', accepted: ['quantitative'], description: 'Maps a numeric risk/status field to stable, suspended, minor, or tense harmonic cues.' }
];
