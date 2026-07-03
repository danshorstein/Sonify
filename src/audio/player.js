// All Web Audio output goes through this module.

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
