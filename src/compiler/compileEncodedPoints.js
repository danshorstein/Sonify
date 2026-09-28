import { numericValues, uniqueValues, categoryIndex, getField } from '../data/schema.js';
import { createUnitScale, pentatonicLadder, ladderMidi, lerp, midiToFrequency } from '../transform/scales.js';
import { DEFAULT_SCALES } from '../spec/defaultScales.js';
import { orderRows } from '../transform/transformData.js';
import { WAVEFORMS, CHORD_BANK, MOTIF_BANK, statusStateFor } from '../audio/instruments.js';

// Compiles a Sonify spec into navigable encoded points: the single
// intermediate representation feeding both timeline playback and
// on-demand interactive rendering. Durations/gains are at tempo 1;
// tempo is applied at render time.

const CHORD_NAMES = ['major', 'major add4', 'suspended stack', 'sus2', 'minor seventh', 'major seventh'];

// Default tone lengths per articulation when no duration channel is mapped:
// bars are struck (staccato), lines sustain toward the next point (legato),
// scatter points are short blips. Per the grammar's mark mappings.
const ARTICULATION_DURATIONS = { staccato: 0.28, legato: 0.5, blip: 0.14 };

export function compileEncodedPoints(spec) {
  const rows = orderRows(spec.data.values, spec.encoding.time?.field, spec.encoding.time?.type);
  const fields = spec.data.fields;
  const dataset = { fields };
  const encoding = spec.encoding;
  const allRows = spec.data.values;

  // Scale descriptions in the spec win over defaults, channel by channel.
  const scaleFor = (channel) => ({ ...DEFAULT_SCALES[channel], ...(encoding[channel]?.scale || {}) });
  const unitScales = {};
  const unitFor = (channel, row) => {
    const field = encoding[channel]?.field;
    if (!field) return null;
    if (!unitScales[channel]) unitScales[channel] = createUnitScale(scaleFor(channel), numericValues(allRows, field));
    return unitScales[channel](row[field]);
  };
  const catIndex = (channel, row) => {
    const field = encoding[channel]?.field;
    if (!field) return null;
    return categoryIndex(allRows, field, row[field]);
  };
  const pitchLadder = pentatonicLadder(scaleFor('pitch').range);

  const identityField = encoding.timbre?.field || encoding.chord?.field || encoding.motif?.field || null;
  const timeField = encoding.time?.field || null;

  return rows.map((row, index) => {
    const explanation = {};
    const note = (channel, raw, scaled) => {
      if (encoding[channel]?.field != null) explanation[channel] = { field: encoding[channel].field, raw, scaled };
    };

    // pitch -> bounded pentatonic MIDI ladder (never raw value -> Hz)
    const pitchUnit = unitFor('pitch', row);
    const midi = pitchUnit === null ? 60 : ladderMidi(pitchLadder, pitchUnit);
    note('pitch', row[encoding.pitch?.field], midi);

    const durationUnit = unitFor('duration', row);
    const defaultDuration = ARTICULATION_DURATIONS[spec.tone?.articulation] ?? 0.28;
    const duration = durationUnit === null ? defaultDuration : lerp(scaleFor('duration').range, durationUnit);
    note('duration', row[encoding.duration?.field], Number(duration.toFixed(3)));

    const volumeUnit = unitFor('volume', row);
    const gain = volumeUnit === null ? 0.13 : lerp(scaleFor('volume').range, volumeUnit);
    note('volume', row[encoding.volume?.field], Number(gain.toFixed(3)));

    let pan = 0;
    if (encoding.pan?.field) {
      const panField = getField(dataset, encoding.pan.field);
      const panRange = scaleFor('pan').range;
      if (panField?.type === 'quantitative') {
        pan = lerp(panRange, unitFor('pan', row));
      } else {
        const values = uniqueValues(allRows, encoding.pan.field);
        pan = values.length <= 1 ? 0 : lerp(panRange, catIndex('pan', row) / (values.length - 1));
      }
      note('pan', row[encoding.pan.field], Number(pan.toFixed(2)));
    }

    let waveform = spec.tone?.defaultWaveform || 'sine';
    if (encoding.timbre?.field) {
      waveform = WAVEFORMS[catIndex('timbre', row) % WAVEFORMS.length];
      note('timbre', row[encoding.timbre.field], waveform);
    }

    let chord = null;
    if (encoding.chord?.field) {
      const chordIndex = catIndex('chord', row) % CHORD_BANK.length;
      chord = CHORD_BANK[chordIndex];
      note('chord', row[encoding.chord.field], CHORD_NAMES[chordIndex]);
    }

    let motif = null;
    if (encoding.motif?.field) {
      motif = MOTIF_BANK[catIndex('motif', row) % MOTIF_BANK.length];
      note('motif', row[encoding.motif.field], motif.join('-'));
    }

    let pulseCount = 0;
    if (encoding.rhythm?.field) {
      pulseCount = Math.round(lerp(scaleFor('rhythm').range, unitFor('rhythm', row)));
      note('rhythm', row[encoding.rhythm.field], pulseCount);
    }

    let statusState = null;
    if (encoding.status?.field) {
      statusState = statusStateFor(unitFor('status', row), scaleFor('status').thresholds);
      note('status', row[encoding.status.field], statusState.name);
    }

    const labelParts = [
      timeField ? row[timeField] : `#${index + 1}`,
      identityField ? row[identityField] : null
    ].filter((part) => part !== null && part !== undefined);

    return {
      index,
      row,
      position: {
        sequenceIndex: index,
        normalizedX: rows.length <= 1 ? 0 : index / (rows.length - 1),
        label: labelParts.join(' · ')
      },
      audio: {
        midi,
        pitchHz: Number(midiToFrequency(midi).toFixed(2)),
        duration,
        gain,
        pan,
        waveform,
        pulseCount,
        motif,
        chord,
        statusState,
        motifLeadIn: motif ? 0.28 : 0
      },
      explanation
    };
  });
}
