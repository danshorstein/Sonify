import { getField } from '../data/schema.js';
import { WAVEFORMS } from '../audio/instruments.js';

// Default scale descriptions per channel. Ranges are bounded on purpose:
// the grammar forbids unbounded pitch ranges and raw value -> Hz mappings.
const DEFAULT_SCALES = {
  pitch: { domain: 'auto', range: [48, 72], rangeType: 'midiPentatonic', scaleType: 'linear', polarity: 'positive', clamp: true },
  duration: { domain: 'auto', range: [0.16, 0.64], scaleType: 'linear', polarity: 'positive' },
  volume: { domain: 'auto', range: [0.06, 0.18], scaleType: 'linear', polarity: 'positive' },
  pan: { domain: 'auto', range: [-0.75, 0.75] },
  rhythm: { domain: 'auto', range: [1, 7], output: 'pulseCount' },
  timbre: { range: WAVEFORMS },
  chord: { range: 'chordBank' },
  motif: { range: 'motifBank' },
  status: { domain: 'auto', thresholds: [0.25, 0.5, 0.75, 1] }
};

export function buildSpec(dataset, fieldMappings, config = {}) {
  const encoding = {};

  Object.entries(fieldMappings).forEach(([channel, fieldKey]) => {
    if (!fieldKey) return;
    const field = getField(dataset, fieldKey);
    if (!field) return;

    const entry = { field: field.key, type: field.type };
    if (channel === 'time') entry.sort = 'ascending';
    const scale = DEFAULT_SCALES[channel];
    if (scale) entry.scale = JSON.parse(JSON.stringify(scale));
    encoding[channel] = entry;
  });

  return {
    version: '0.1',
    datasetId: dataset.id,
    data: {
      values: dataset.rows,
      fields: dataset.fields
    },
    transform: [],
    tone: {
      articulation: config.articulation || 'staccato',
      defaultWaveform: 'sine',
      envelope: { attack: 0.025, release: 0.08 }
    },
    encoding,
    composition: {
      mode: 'sequence',
      stepSeconds: 0.72,
      groupBy: null,
      overlayBy: null
    },
    interaction: {
      mode: 'scrub',
      scrub: {
        input: ['wheel', 'keyboard', 'pointer'],
        trigger: 'onStep',
        repeatCurrentOnSpace: true,
        speakLabels: 'onDemand',
        throttleMs: 80,
        stopPreviousOnMove: true
      }
    },
    legend: {
      enabled: true,
      includeSpeech: true,
      includeExamples: true
    },
    config: {
      tempo: config.tempo ?? 1,
      maxDurationSeconds: 30
    }
  };
}
