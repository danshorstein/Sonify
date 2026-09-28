import { getField } from '../data/schema.js';
import { defaultScale } from './defaultScales.js';

export function buildSpec(dataset, fieldMappings, config = {}) {
  const encoding = {};

  Object.entries(fieldMappings).forEach(([channel, fieldKey]) => {
    if (!fieldKey) return;
    const field = getField(dataset, fieldKey);
    if (!field) return;

    const entry = { field: field.key, type: field.type };
    if (channel === 'time') entry.sort = 'ascending';
    const scale = defaultScale(channel);
    if (scale) entry.scale = { ...scale, ...(config.scales?.[channel] || {}) };
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
