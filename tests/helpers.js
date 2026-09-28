import { datasets } from '../src/data/datasets.js';
import { presets } from '../src/spec/defaultMappings.js';
import { buildSpec } from '../src/spec/buildSpec.js';
import { compileEncodedPoints } from '../src/compiler/compileEncodedPoints.js';

export function agencyDataset() {
  return datasets.find((dataset) => dataset.id === 'agency-spending');
}

export function compileAgency({ mappings = presets['agency-spending'], config = {}, edit } = {}) {
  const spec = buildSpec(agencyDataset(), mappings, config);
  if (edit) edit(spec);
  return { spec, points: compileEncodedPoints(spec) };
}
