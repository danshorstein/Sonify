// All speech output goes through this module (Web Speech API).
// interrupt=true cancels pending utterances so scrubbing never queues
// stale speech.

export function speechAvailable() {
  return 'speechSynthesis' in window;
}

export function speak(text, { interrupt = true, rate = 1.05 } = {}) {
  if (!speechAvailable() || !text) return null;
  if (interrupt) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeech() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
