import { uniqueValues } from '../data/schema.js';
import { WAVEFORMS, MOTIF_BANK, statusStateFor } from '../audio/instruments.js';

// Spec -> auditory legend queue. A sonification without a legend is a chart
// without axes: each mapped channel is explained in speech, then demonstrated
// with example tones drawn from the same encoded values used for playback.
//
// Items are {kind:'speech', text} or {kind:'audio', events, span} where each
// event is {midi?, hz?, offset?, duration?, wave?, gain?, pan?} and span is
// the total seconds the audio item occupies.

function fieldLabel(spec, key) {
  return spec.data.fields.find((field) => field.key === key)?.label || key;
}

export function compileLegendQueue(spec, points) {
  const items = [];
  const encoding = spec.encoding;
  const say = (text) => items.push({ kind: 'speech', text });
  const play = (events, span) => items.push({ kind: 'audio', events, span });

  if (encoding.pitch && points.length) {
    let minPoint = points[0];
    let maxPoint = points[0];
    points.forEach((point) => {
      const value = Number(point.row[encoding.pitch.field]);
      if (value < Number(minPoint.row[encoding.pitch.field])) minPoint = point;
      if (value > Number(maxPoint.row[encoding.pitch.field])) maxPoint = point;
    });

    say(`${fieldLabel(spec, encoding.pitch.field)} is mapped to pitch. Lowest value, ${minPoint.row[encoding.pitch.field]}, sounds like this.`);
    play([{ midi: minPoint.audio.midi, duration: 0.5 }], 0.65);
    say(`Highest value, ${maxPoint.row[encoding.pitch.field]}, sounds like this.`);
    play([{ midi: maxPoint.audio.midi, duration: 0.5 }], 0.65);
  }

  if (encoding.timbre) {
    say(`Categories of ${fieldLabel(spec, encoding.timbre.field)} are mapped to timbre.`);
    uniqueValues(spec.data.values, encoding.timbre.field)
      .slice(0, WAVEFORMS.length)
      .forEach((category, index) => {
        say(`${category}:`);
        play([{ midi: 60, duration: 0.45, wave: WAVEFORMS[index % WAVEFORMS.length] }], 0.6);
      });
  }

  if (encoding.motif) {
    say(`Categories of ${fieldLabel(spec, encoding.motif.field)} each get a short melodic motif.`);
    uniqueValues(spec.data.values, encoding.motif.field)
      .slice(0, MOTIF_BANK.length)
      .forEach((category, index) => {
        say(`${category}:`);
        const motif = MOTIF_BANK[index % MOTIF_BANK.length];
        play(motif.map((midi, note) => ({ midi, offset: note * 0.12, duration: 0.09, wave: 'triangle', gain: 0.08 })), motif.length * 0.12 + 0.2);
      });
  }

  if (encoding.duration) {
    say(`${fieldLabel(spec, encoding.duration.field)} is mapped to tone length, from short to long.`);
    play([
      { midi: 60, duration: 0.16 },
      { midi: 60, offset: 0.55, duration: 0.64 }
    ], 1.4);
  }

  if (encoding.volume) {
    say(`${fieldLabel(spec, encoding.volume.field)} is mapped to loudness, from soft to loud.`);
    play([
      { midi: 60, duration: 0.4, gain: 0.06 },
      { midi: 60, offset: 0.6, duration: 0.4, gain: 0.18 }
    ], 1.2);
  }

  if (encoding.rhythm) {
    say(`${fieldLabel(spec, encoding.rhythm.field)} is mapped to pulse density, from sparse to dense.`);
    const pulse = (count, offset) => Array.from({ length: count }, (_, i) => ({ midi: 84, offset: offset + i * 0.09, duration: 0.03, wave: 'square', gain: 0.03 }));
    play([...pulse(2, 0), ...pulse(7, 0.8)], 1.7);
  }

  if (encoding.pan) {
    say(`${fieldLabel(spec, encoding.pan.field)} is mapped to stereo position, left to right.`);
    play([
      { midi: 60, duration: 0.4, pan: -0.75 },
      { midi: 60, offset: 0.6, duration: 0.4, pan: 0.75 }
    ], 1.2);
  }

  if (encoding.status) {
    say(`${fieldLabel(spec, encoding.status.field)} is mapped to harmony: low values sound stable, high values sound tense.`);
    const stable = statusStateFor(0);
    const tense = statusStateFor(1);
    play([
      ...stable.chord.map((midi) => ({ midi, duration: 0.55, wave: stable.wave, gain: 0.05 })),
      ...tense.chord.map((midi) => ({ midi, offset: 0.85, duration: 0.55, wave: tense.wave, gain: 0.05 }))
    ], 1.7);
  }

  if (!items.length) say('No channels are mapped yet, so there is nothing to explain.');
  return items;
}
