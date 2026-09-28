import { getField } from '../data/schema.js';
import { defaultScale } from './defaultScales.js';
import { applyTransforms } from '../transform/transformData.js';

export function buildSpec(dataset, fieldMappings, config = {}) {
  const encoding = {};
  const transform = config.transforms || [];
  // Channels bind to fields as they exist after transforms (aggregates and
  // bins introduce new ones).
  const resolved = applyTransforms(dataset.rows, transform, dataset.fields);

  Object.entries(fieldMappings).forEach(([channel, fieldKey]) => {
    if (!fieldKey) return;
    const field = getField(resolved, fieldKey);
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
    transform: JSON.parse(JSON.stringify(transform)),
    tone: {
      articulation: config.articulation || 'staccato',
      defaultWaveform: 'sine',
      envelope: { attack: 0.025, release: 0.08 }
    },
    encoding,
    composition: {
      mode: config.composition?.mode || 'sequence',
      stepSeconds: 0.72,
      groupBy: config.composition?.groupBy ?? null,
      overlayBy: config.composition?.overlayBy ?? null
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
