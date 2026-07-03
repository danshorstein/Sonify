import { channelDefinitions } from './channels.js';

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
      const field = spec.data?.fields?.find((candidate) => candidate.key === entry.field);
      if (!field) {
        errors.push(`Channel "${channelKey}" references unknown field "${entry.field}".`);
        return;
      }
      if (!channel.accepted.includes(field.type)) {
        errors.push(`Channel "${channelKey}" does not accept ${field.type} field "${entry.field}".`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
