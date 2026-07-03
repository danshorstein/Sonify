import { extent, uniqueValues, categoryIndex, getField } from '../data/schema.js';
import { normalize, pentatonicMidi, midiToFrequency } from '../transform/scales.js';
import { orderRows } from '../transform/transformData.js';
import { WAVEFORMS, CHORD_BANK, MOTIF_BANK, statusStateFor } from '../audio/instruments.js';

// Compiles a Sonify spec into navigable encoded points: the single
// intermediate representation feeding both timeline playback and
// on-demand interactive rendering. Durations/gains are at tempo 1;
// tempo is applied at render time.

const CHORD_NAMES = ['major', 'major add4', 'suspended stack', 'sus2', 'minor seventh', 'major seventh'];

export function compileEncodedPoints(spec) {
  const rows = orderRows(spec.data.values, spec.encoding.time?.field);
  const fields = spec.data.fields;
  const dataset = { fields };
  const encoding = spec.encoding;
  const allRows = spec.data.values;

  const extents = {};
  const quantNormalize = (channel, row) => {
    const field = encoding[channel]?.field;
    if (!field) return null;
    if (!extents[field]) extents[field] = extent(allRows, field);
    return normalize(row[field], extents[field]);
  };
  const catIndex = (channel, row) => {
    const field = encoding[channel]?.field;
    if (!field) return null;
    return categoryIndex(allRows, field, row[field]);
  };

  const identityField = encoding.timbre?.field || encoding.chord?.field || encoding.motif?.field || null;
  const timeField = encoding.time?.field || null;

  return rows.map((row, index) => {
    const explanation = {};
    const note = (channel, raw, scaled) => {
      if (encoding[channel]?.field != null) explanation[channel] = { field: encoding[channel].field, raw, scaled };
    };

    // pitch -> bounded pentatonic MIDI ladder (never raw value -> Hz)
    const pitchNorm = quantNormalize('pitch', row);
    const midi = pitchNorm === null ? 60 : pentatonicMidi(pitchNorm);
    note('pitch', row[encoding.pitch?.field], midi);

    const durationNorm = quantNormalize('duration', row);
    const duration = durationNorm === null ? 0.28 : 0.16 + durationNorm * 0.48;
    note('duration', row[encoding.duration?.field], Number(duration.toFixed(3)));

    const volumeNorm = quantNormalize('volume', row);
    const gain = volumeNorm === null ? 0.13 : 0.06 + volumeNorm * 0.12;
    note('volume', row[encoding.volume?.field], Number(gain.toFixed(3)));

    let pan = 0;
    if (encoding.pan?.field) {
      const panField = getField(dataset, encoding.pan.field);
      if (panField?.type === 'quantitative') {
        pan = -0.75 + quantNormalize('pan', row) * 1.5;
      } else {
        const values = uniqueValues(allRows, encoding.pan.field);
        pan = values.length <= 1 ? 0 : -0.75 + (catIndex('pan', row) / (values.length - 1)) * 1.5;
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
      pulseCount = 1 + Math.round(quantNormalize('rhythm', row) * 6);
      note('rhythm', row[encoding.rhythm.field], pulseCount);
    }

    let statusState = null;
    if (encoding.status?.field) {
      statusState = statusStateFor(quantNormalize('status', row));
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
