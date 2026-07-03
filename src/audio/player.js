// All Web Audio output goes through this module.

// Fixed layer gains for identity/context cues. These are deliberately quiet:
// volume is only ever a secondary encoding.
const MOTIF_GAIN = 0.055;
const CHORD_GAIN = 0.035;
const PULSE_GAIN = 0.025;

let audioContext = null;
let activeNodes = [];

export function ensureAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

export function now() {
  return ensureAudioContext().currentTime;
}

export function stopAll() {
  activeNodes.forEach((node) => {
    try { node.stop(); } catch (error) { /* already stopped */ }
  });
  activeNodes = [];
}

function createGain(time, duration, peak = 0.13) {
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.025);
  gain.gain.setValueAtTime(Math.max(0.0002, peak), Math.max(time + 0.03, time + duration - 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  return gain;
}

export function playTone(freq, start, duration, type = 'sine', volume = 0.13, pan = 0) {
  ensureAudioContext();
  const osc = audioContext.createOscillator();
  const gain = createGain(start, duration, volume);
  const panner = audioContext.createStereoPanner();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  panner.pan.setValueAtTime(pan, start);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioContext.destination);

  osc.start(start);
  osc.stop(start + duration + 0.02);
  activeNodes.push(osc);
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Schedules one encoded point (motif lead-in, chord, status harmony, rhythm
// pulses, then the main value tone) at an absolute AudioContext time.
// Returns the point's total lead-in offset in seconds.
export function schedulePoint(point, { start, tempo = 1 } = {}) {
  ensureAudioContext();
  const audio = point.audio;
  const eventStart = start ?? now() + 0.05;
  const pan = audio.pan;

  if (audio.motif) {
    audio.motif.forEach((midi, index) => {
      playTone(midiToFrequency(midi), eventStart + index * (0.08 / tempo), 0.055 / tempo, 'triangle', MOTIF_GAIN, pan);
    });
  }

  const mainStart = eventStart + audio.motifLeadIn / tempo;

  if (audio.chord) {
    audio.chord.forEach((midi) => playTone(midiToFrequency(midi), mainStart, 0.26 / tempo, 'sine', CHORD_GAIN, pan));
  }

  if (audio.statusState) {
    audio.statusState.chord.forEach((midi) => {
      playTone(midiToFrequency(midi), mainStart, 0.42 / tempo, audio.statusState.wave, audio.statusState.volume, pan);
    });
  }

  for (let i = 0; i < audio.pulseCount; i += 1) {
    playTone(audio.pitchHz * 2, mainStart + i * (0.055 / tempo), 0.028 / tempo, 'square', PULSE_GAIN, pan);
  }

  playTone(audio.pitchHz, mainStart + 0.06 / tempo, audio.duration / tempo, audio.waveform, audio.gain, pan);

  return audio.motifLeadIn / tempo;
}

// Total footprint of one scheduled point in seconds, for sequencing.
export function pointSpanSeconds(point, tempo = 1) {
  const audio = point.audio;
  return (audio.motifLeadIn + 0.06 + Math.max(audio.duration, audio.statusState ? 0.42 : 0)) / tempo;
}

// Interactive render of a single point. Scrub mode is deliberately compact
// (main value tone only) so fast movement stays legible; full mode replays
// every layer, like one step of timeline playback.
export function renderPoint(point, { mode = 'full', tempo = 1 } = {}) {
  ensureAudioContext();
  stopAll();

  if (mode === 'scrub') {
    const audio = point.audio;
    playTone(audio.pitchHz, now() + 0.02, Math.min(audio.duration, 0.22) / tempo, audio.waveform, audio.gain, audio.pan);
    return 0;
  }

  return schedulePoint(point, { start: now() + 0.05, tempo });
}

// The auditory saccade: anchor point, short gap, current point.
// Returns the total duration in seconds so callers can time follow-up speech.
export function renderComparison(anchorPoint, currentPoint, { tempo = 1, gapSeconds = 0.35 } = {}) {
  ensureAudioContext();
  stopAll();

  const start = now() + 0.05;
  schedulePoint(anchorPoint, { start, tempo });
  const currentStart = start + pointSpanSeconds(anchorPoint, tempo) + gapSeconds;
  schedulePoint(currentPoint, { start: currentStart, tempo });
  return currentStart + pointSpanSeconds(currentPoint, tempo) - now();
}
