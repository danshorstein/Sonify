import { numericValues, uniqueValues, categoryIndex, getField } from '../data/schema.js';
import { createUnitScale, pentatonicLadder, ladderMidi, lerp, midiToFrequency } from '../transform/scales.js';
import { DEFAULT_SCALES } from '../spec/defaultScales.js';
import { compositionGroupField, effectiveComposition, groupRows } from './composition.js';
import { orderRows, resolveData } from '../transform/transformData.js';
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
  const resolved = resolveData(spec);
  const encoding = spec.encoding;
  const allRows = resolved.rows;
  const dataset = { fields: resolved.fields };

  // A sort transform defines playback order; otherwise rows follow the time field.
  const hasSort = (spec.transform || []).some((transform) => transform.type === 'sort');
  const timeOrdered = hasSort ? [...allRows] : orderRows(allRows, encoding.time?.field, encoding.time?.type);

  // Grouped composition modes reorder points group-major; a mode whose group
  // field is missing falls back to plain sequence order.
  const requestedField = compositionGroupField(spec.composition);
  const groupFieldExists = Boolean(requestedField && dataset.fields.some((field) => field.key === requestedField));
  const groupCount = groupFieldExists ? new Set(timeOrdered.map((row) => String(row[requestedField]))).size : 0;
  const composition = effectiveComposition(spec.composition, groupCount, groupFieldExists);
  const grouped = composition.field ? groupRows(timeOrdered, composition.field, encoding.time?.field) : null;
  const entries = grouped ? grouped.ordered : timeOrdered.map((row) => ({ row }));

  // Category identity (timbre, chord, motif, nominal pan) is keyed to the raw
  // data whenever the field exists there, so filtering out one category does
  // not silently reassign every other category's sound.
  const rawFieldKeys = new Set((spec.data.fields || []).map((field) => field.key));
  const categoryRows = (field) => (rawFieldKeys.has(field) ? spec.data.values : allRows);

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
    return categoryIndex(categoryRows(field), field, row[field]);
  };
  const pitchLadder = pentatonicLadder(scaleFor('pitch').range);

  const identityField = encoding.timbre?.field || encoding.chord?.field || encoding.motif?.field || null;
  const timeField = encoding.time?.field || null;

  return entries.map(({ row, group, groupIndex, groupPosition, groupSize, slot }, index) => {
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
        const values = uniqueValues(categoryRows(encoding.pan.field), encoding.pan.field);
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
      identityField ? row[identityField] : null,
      group !== undefined && composition.field !== identityField ? group : null
    ].filter((part) => part !== null && part !== undefined);

    const position = {
      sequenceIndex: index,
      normalizedX: entries.length <= 1 ? 0 : index / (entries.length - 1),
      label: labelParts.join(' · ')
    };
    if (group !== undefined) {
      Object.assign(position, { group, groupIndex, groupPosition, groupSize, slot, slotCount: grouped.slotCount });
    }

    return {
      index,
      row,
      position,
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
