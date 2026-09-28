import { uniqueValues } from '../data/schema.js';
import { resolveData } from '../transform/transformData.js';
import { WAVEFORMS, MOTIF_BANK, statusStateFor } from '../audio/instruments.js';
import { DEFAULT_SCALES } from '../spec/defaultScales.js';
import { distinctGroups, effectiveComposition } from './composition.js';

const SCALE_PHRASES = { sqrt: 'a square-root scale', log: 'a logarithmic scale', symlog: 'a signed-logarithmic scale' };

// Spec -> auditory legend queue. A sonification without a legend is a chart
// without axes: each mapped channel is explained in speech, then demonstrated
// with example tones drawn from the same encoded values used for playback.
//
// Items are {kind:'speech', text} or {kind:'audio', events, span} where each
// event is {midi?, hz?, offset?, duration?, wave?, gain?, pan?} and span is
// the total seconds the audio item occupies.

function fieldLabel(data, key) {
  return data.fields.find((field) => field.key === key)?.label || key;
}

// Same rule as the compiler: categories come from the raw data when the field
// exists there, so category identity is stable under filtering.
function categoryRows(spec, data, field) {
  return spec.data.fields.some((candidate) => candidate.key === field) ? spec.data.values : data.rows;
}

function scaleFor(spec, channel) {
  return { ...DEFAULT_SCALES[channel], ...(spec.encoding[channel]?.scale || {}) };
}

// Range endpoints in the order a listener meets them: value at the low end
// of the data first, high end second. Negative polarity swaps them.
function ends(scale, [low, high]) {
  return scale.polarity === 'negative' ? [high, low] : [low, high];
}

function scaleNote(scale) {
  const parts = [];
  if (scale.polarity === 'negative') parts.push('reversed, so higher values sound lower');
  if (SCALE_PHRASES[scale.scaleType]) parts.push(`on ${SCALE_PHRASES[scale.scaleType]}`);
  return parts.length ? ` This mapping is ${parts.join(' and ')}.` : '';
}

function describeComposition(spec, data, points) {
  const groups = distinctGroups(points);
  const grouped = groups.length > 0 && points.every((point) => point.position?.group !== undefined);
  if (!grouped) return null;

  const { mode, field } = effectiveComposition(spec.composition, groups.length, true);
  const label = fieldLabel(data, field);
  if (mode === 'group') {
    return `Playback is grouped by ${label}: ${groups.join(', ')}. Each group plays in turn, with a short pause between groups.`;
  }
  if (mode === 'repeat') {
    return `Playback repeats by ${label}: ${groups.join(', ')}. Each group's name is spoken, then its data plays.`;
  }
  if (mode === 'overlay') {
    return `Playback overlays ${label}: ${groups.join(', ')} play together, one step at a time. Voices are simplified to their main tone, and timbre and stereo position keep them apart.`;
  }
  return null;
}

export function compileLegendQueue(spec, points) {
  const data = resolveData(spec);
  const items = [];
  const encoding = spec.encoding;
  const say = (text) => items.push({ kind: 'speech', text });
  const play = (events, span) => items.push({ kind: 'audio', events, span });

  const composition = describeComposition(spec, data, points);
  if (composition) say(composition);

  if (encoding.pitch && points.length) {
    let minPoint = points[0];
    let maxPoint = points[0];
    points.forEach((point) => {
      const value = Number(point.row[encoding.pitch.field]);
      if (value < Number(minPoint.row[encoding.pitch.field])) minPoint = point;
      if (value > Number(maxPoint.row[encoding.pitch.field])) maxPoint = point;
    });

    say(`${fieldLabel(data, encoding.pitch.field)} is mapped to pitch.${scaleNote(scaleFor(spec, 'pitch'))} Lowest value, ${minPoint.row[encoding.pitch.field]}, sounds like this.`);
    play([{ midi: minPoint.audio.midi, duration: 0.5 }], 0.65);
    say(`Highest value, ${maxPoint.row[encoding.pitch.field]}, sounds like this.`);
    play([{ midi: maxPoint.audio.midi, duration: 0.5 }], 0.65);
  }

  if (encoding.timbre) {
    say(`Categories of ${fieldLabel(data, encoding.timbre.field)} are mapped to timbre.`);
    uniqueValues(categoryRows(spec, data, encoding.timbre.field), encoding.timbre.field)
      .slice(0, WAVEFORMS.length)
      .forEach((category, index) => {
        say(`${category}:`);
        play([{ midi: 60, duration: 0.45, wave: WAVEFORMS[index % WAVEFORMS.length] }], 0.6);
      });
  }

  if (encoding.motif) {
    say(`Categories of ${fieldLabel(data, encoding.motif.field)} each get a short melodic motif.`);
    uniqueValues(categoryRows(spec, data, encoding.motif.field), encoding.motif.field)
      .slice(0, MOTIF_BANK.length)
      .forEach((category, index) => {
        say(`${category}:`);
        const motif = MOTIF_BANK[index % MOTIF_BANK.length];
        play(motif.map((midi, note) => ({ midi, offset: note * 0.12, duration: 0.09, wave: 'triangle', gain: 0.08 })), motif.length * 0.12 + 0.2);
      });
  }

  if (encoding.duration) {
    const scale = scaleFor(spec, 'duration');
    const [first, second] = ends(scale, scale.range);
    say(`${fieldLabel(data, encoding.duration.field)} is mapped to tone length, from ${first < second ? 'short to long' : 'long to short'} as values rise.${scaleNote(scale)}`);
    play([
      { midi: 60, duration: first },
      { midi: 60, offset: first + 0.4, duration: second }
    ], first + second + 0.8);
  }

  if (encoding.volume) {
    const scale = scaleFor(spec, 'volume');
    const [first, second] = ends(scale, scale.range);
    say(`${fieldLabel(data, encoding.volume.field)} is mapped to loudness, from ${first < second ? 'soft to loud' : 'loud to soft'} as values rise.${scaleNote(scale)}`);
    play([
      { midi: 60, duration: 0.4, gain: first },
      { midi: 60, offset: 0.6, duration: 0.4, gain: second }
    ], 1.2);
  }

  if (encoding.rhythm) {
    const scale = scaleFor(spec, 'rhythm');
    const [first, second] = ends(scale, scale.range).map(Math.round);
    say(`${fieldLabel(data, encoding.rhythm.field)} is mapped to pulse density, from ${first < second ? 'sparse to dense' : 'dense to sparse'} as values rise.${scaleNote(scale)}`);
    const pulse = (count, offset) => Array.from({ length: count }, (_, i) => ({ midi: 84, offset: offset + i * 0.09, duration: 0.03, wave: 'square', gain: 0.03 }));
    play([...pulse(first, 0), ...pulse(second, first * 0.09 + 0.7)], (first + second) * 0.09 + 0.9);
  }

  if (encoding.pan) {
    const scale = scaleFor(spec, 'pan');
    const [first, second] = ends(scale, scale.range);
    say(`${fieldLabel(data, encoding.pan.field)} is mapped to stereo position, ${first < second ? 'left to right' : 'right to left'}.${scaleNote(scale)}`);
    play([
      { midi: 60, duration: 0.4, pan: first },
      { midi: 60, offset: 0.6, duration: 0.4, pan: second }
    ], 1.2);
  }

  if (encoding.status) {
    const scale = scaleFor(spec, 'status');
    const reversed = scale.polarity === 'negative';
    say(`${fieldLabel(data, encoding.status.field)} is mapped to harmony: ${reversed ? 'high values sound stable, low values sound tense' : 'low values sound stable, high values sound tense'}.${scaleNote({ ...scale, polarity: 'positive' })}`);
    const stable = statusStateFor(0, scale.thresholds);
    const tense = statusStateFor(1, scale.thresholds);
    play([
      ...stable.chord.map((midi) => ({ midi, duration: 0.55, wave: stable.wave, gain: 0.05 })),
      ...tense.chord.map((midi) => ({ midi, offset: 0.85, duration: 0.55, wave: tense.wave, gain: 0.05 }))
    ], 1.7);
  }

  if (!items.length) say('No channels are mapped yet, so there is nothing to explain.');
  return items;
}
