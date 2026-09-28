import { channelDefinitions } from './channels.js';
import { SCALABLE_CHANNELS } from './defaultScales.js';
import { RANGE_LIMITS, SCALE_TYPES } from '../transform/scales.js';
import { resolveData } from '../transform/transformData.js';
import { COMPOSITION_MODES, MAX_OVERLAY_GROUPS, compositionGroupField } from '../compiler/composition.js';

function validateComposition(spec, resolved, errors) {
  const composition = spec.composition;
  if (!composition || composition.mode === undefined) return;

  if (!COMPOSITION_MODES.includes(composition.mode)) {
    errors.push(`composition.mode must be one of ${COMPOSITION_MODES.join(', ')}.`);
    return;
  }
  if (composition.mode === 'sequence') return;

  const field = compositionGroupField(composition);
  const key = composition.mode === 'overlay' ? 'overlayBy' : 'groupBy';
  if (!field) {
    errors.push(`composition.${key} is required for ${composition.mode} mode.`);
    return;
  }
  if (!resolved.fields.some((candidate) => candidate.key === field)) {
    errors.push(`composition.${key} references unknown field "${field}".`);
    return;
  }
  if (composition.mode === 'overlay') {
    const groups = new Set(resolved.rows.map((row) => String(row[field]))).size;
    if (groups > MAX_OVERLAY_GROUPS) {
      errors.push(`Overlay mode supports at most ${MAX_OVERLAY_GROUPS} groups; "${field}" has ${groups}.`);
    }
  }
}

function validateScale(channelKey, scale, errors) {
  if (!scale || typeof scale !== 'object') return;
  const label = `Channel "${channelKey}" scale`;

  if (scale.scaleType !== undefined && !SCALE_TYPES.includes(scale.scaleType)) {
    errors.push(`${label}: scaleType must be one of ${SCALE_TYPES.join(', ')}.`);
  }
  if (scale.polarity !== undefined && !['positive', 'negative'].includes(scale.polarity)) {
    errors.push(`${label}: polarity must be "positive" or "negative".`);
  }
  if (scale.domain !== undefined && scale.domain !== 'auto') {
    const domain = scale.domain;
    const bounds = Array.isArray(domain) && domain.length === 2 ? domain : null;
    const numeric = bounds?.every((bound) => bound === null || bound === '' || Number.isFinite(Number(bound)));
    if (!bounds || !numeric) {
      errors.push(`${label}: domain must be "auto" or [min, max] (either may be null).`);
    } else if (bounds.every((bound) => bound !== null && bound !== '') && Number(bounds[0]) >= Number(bounds[1])) {
      errors.push(`${label}: domain min must be below domain max.`);
    }
  }

  const limits = RANGE_LIMITS[channelKey];
  if (limits && Array.isArray(scale.range)) {
    const [low, high] = scale.range;
    if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
      errors.push(`${label}: range must be [low, high] with low <= high.`);
    } else if (low < limits[0] || high > limits[1]) {
      errors.push(`${label}: range must stay within ${limits[0]} to ${limits[1]} (ranges are bounded).`);
    }
  }
}

export function validateSpec(spec) {
  const errors = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Spec must be an object.'] };
  }
  if (!Array.isArray(spec.data?.values) || spec.data.values.length === 0) {
    errors.push('data.values must be a non-empty array.');
  }
  if (!Array.isArray(spec.data?.fields)) {
    errors.push('data.fields must be an array.');
  }
  const resolved = Array.isArray(spec.data?.values) && Array.isArray(spec.data?.fields) ? resolveData(spec) : null;
  if (resolved) {
    errors.push(...resolved.errors);
    if (spec.data.values.length > 0 && resolved.rows.length === 0 && resolved.errors.length === 0) {
      errors.push('The transforms leave no rows to sonify.');
    }
  }

  if (resolved) validateComposition(spec, resolved, errors);

  if (!spec.encoding || typeof spec.encoding !== 'object') {
    errors.push('encoding must be an object.');
  } else {
    Object.entries(spec.encoding).forEach(([channelKey, entry]) => {
      const channel = channelDefinitions.find((definition) => definition.key === channelKey);
      if (!channel) {
        errors.push(`Unknown channel "${channelKey}".`);
        return;
      }
      if (!entry.field) {
        errors.push(`Channel "${channelKey}" is missing a field.`);
        return;
      }
      const field = (resolved?.fields || spec.data?.fields)?.find((candidate) => candidate.key === entry.field);
      if (!field) {
        errors.push(`Channel "${channelKey}" references unknown field "${entry.field}".`);
        return;
      }
      if (!channel.accepted.includes(field.type)) {
        errors.push(`Channel "${channelKey}" does not accept ${field.type} field "${entry.field}".`);
      }
      if (SCALABLE_CHANNELS.includes(channelKey)) validateScale(channelKey, entry.scale, errors);
    });
  }

  return { valid: errors.length === 0, errors };
}
