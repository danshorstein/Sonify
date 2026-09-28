// Data transforms and row ordering. A transform list runs top to bottom over
// the spec's raw rows: filter, sort, aggregate, bin. Each step may add or
// drop fields, so applyTransforms returns the resulting rows AND fields; every
// downstream stage (validation, compiling, legend, UI) reads those, never the
// raw values directly.

export const FILTER_OPS = ['==', '!=', '<', '<=', '>', '>=', 'contains'];
export const AGGREGATE_OPS = ['count', 'sum', 'mean', 'median', 'min', 'max'];
export const TRANSFORM_TYPES = ['filter', 'sort', 'aggregate', 'bin'];

const OP_WORDS = { '==': 'is', '!=': 'is not', '<': '<', '<=': '<=', '>': '>', '>=': '>=', contains: 'contains' };

function toNumber(value) {
  return value === null || value === undefined || value === '' ? NaN : Number(value);
}

function compareValues(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

function rowMatches(row, { field, op, value }) {
  const cell = row[field];
  switch (op) {
    case '==': return compareValues(cell, value) === 0;
    case '!=': return compareValues(cell, value) !== 0;
    case '<': return compareValues(cell, value) < 0;
    case '<=': return compareValues(cell, value) <= 0;
    case '>': return compareValues(cell, value) > 0;
    case '>=': return compareValues(cell, value) >= 0;
    case 'contains': return String(cell).toLowerCase().includes(String(value).toLowerCase());
    default: return true;
  }
}

function aggregateValues(op, values) {
  if (op === 'count') return values.length;
  const numbers = values.map(toNumber).filter(Number.isFinite);
  if (!numbers.length) return null;
  let result;
  if (op === 'sum') result = numbers.reduce((sum, value) => sum + value, 0);
  else if (op === 'mean') result = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  else if (op === 'min') result = Math.min(...numbers);
  else if (op === 'max') result = Math.max(...numbers);
  else if (op === 'median') {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    result = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return Number(result.toFixed(4));
}

// Rounds a raw bin width up to 1, 2, 5, or 10 times a power of ten.
export function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

function fieldLabel(fields, key) {
  return fields.find((field) => field.key === key)?.label || key;
}

export function describeTransform(transform, fields) {
  const label = (key) => fieldLabel(fields, key);
  switch (transform.type) {
    case 'filter':
      return `Filter: ${label(transform.field)} ${OP_WORDS[transform.op] || transform.op} ${transform.value}`;
    case 'sort':
      return `Sort: ${label(transform.field)}, ${transform.order === 'descending' ? 'descending' : 'ascending'}`;
    case 'aggregate': {
      const measures = (transform.fields || [])
        .map((measure) => (measure.op === 'count' ? 'count' : `${measure.op} of ${label(measure.field)}`))
        .join(', ');
      const groups = (transform.groupBy || []).map(label).join(', ');
      return `Aggregate: ${measures || 'nothing'}${groups ? ` by ${groups}` : ' overall'}`;
    }
    case 'bin':
      return `Bin: ${label(transform.field)} into ${transform.step ? `steps of ${transform.step}` : `about ${transform.maxbins || 10} bins`}`;
    default:
      return `Unknown transform "${transform.type}"`;
  }
}

function applyFilter(rows, fields, transform, fail) {
  if (!fields.some((field) => field.key === transform.field)) return fail(`filter references unknown field "${transform.field}"`);
  if (!FILTER_OPS.includes(transform.op)) return fail(`filter has unknown operator "${transform.op}"`);
  if (transform.value === undefined || transform.value === '') return fail('filter needs a value');
  return { rows: rows.filter((row) => rowMatches(row, transform)), fields };
}

function applySort(rows, fields, transform, fail) {
  if (!fields.some((field) => field.key === transform.field)) return fail(`sort references unknown field "${transform.field}"`);
  const direction = transform.order === 'descending' ? -1 : 1;
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => direction * compareValues(a.row[transform.field], b.row[transform.field]) || a.index - b.index)
    .map(({ row }) => row);
  return { rows: sorted, fields };
}

function applyAggregate(rows, fields, transform, fail) {
  const groupBy = transform.groupBy || [];
  const measures = transform.fields?.length ? transform.fields : [{ op: 'count', as: 'count' }];

  for (const key of groupBy) {
    if (!fields.some((field) => field.key === key)) return fail(`aggregate groups by unknown field "${key}"`);
  }
  for (const measure of measures) {
    if (!AGGREGATE_OPS.includes(measure.op)) return fail(`aggregate has unknown operation "${measure.op}"`);
    if (measure.op !== 'count' && !fields.some((field) => field.key === measure.field)) {
      return fail(`aggregate references unknown field "${measure.field}"`);
    }
  }

  const groups = new Map();
  rows.forEach((row) => {
    const id = JSON.stringify(groupBy.map((key) => row[key]));
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  });

  const outputName = (measure) => measure.as || (measure.op === 'count' ? 'count' : `${measure.op}_${measure.field}`);
  const outRows = [...groups.values()].map((members) => {
    const out = {};
    groupBy.forEach((key) => { out[key] = members[0][key]; });
    measures.forEach((measure) => {
      out[outputName(measure)] = aggregateValues(measure.op, members.map((row) => row[measure.field]));
    });
    return out;
  });

  const outFields = [
    ...groupBy.map((key) => fields.find((field) => field.key === key)),
    ...measures.map((measure) => ({
      key: outputName(measure),
      label: measure.op === 'count' ? 'Count' : `${measure.op[0].toUpperCase()}${measure.op.slice(1)} of ${fieldLabel(fields, measure.field)}`,
      type: 'quantitative'
    }))
  ];
  return { rows: outRows, fields: outFields };
}

function applyBin(rows, fields, transform, fail) {
  const source = fields.find((field) => field.key === transform.field);
  if (!source) return fail(`bin references unknown field "${transform.field}"`);

  const numbers = rows.map((row) => toNumber(row[transform.field])).filter(Number.isFinite);
  if (!numbers.length) return fail(`bin field "${transform.field}" has no numeric values`);

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const step = transform.step > 0
    ? Number(transform.step)
    : niceStep((max - min) / Math.max(1, Math.round(transform.maxbins || 10)));
  const start = Math.floor(min / step) * step;
  const binCount = Math.max(1, Math.ceil((max - start) / step));
  const as = transform.as || `bin_${transform.field}`;
  const round = (value) => Number(value.toFixed(6));

  const outRows = rows
    .filter((row) => Number.isFinite(toNumber(row[transform.field])))
    .map((row) => {
      const index = Math.min(binCount - 1, Math.max(0, Math.floor((toNumber(row[transform.field]) - start) / step)));
      return { ...row, [as]: round(start + index * step), [`${as}_end`]: round(start + (index + 1) * step) };
    });

  const outFields = [
    ...fields,
    { key: as, label: `${source.label} (bin start)`, type: 'quantitative' },
    { key: `${as}_end`, label: `${source.label} (bin end)`, type: 'quantitative' }
  ];
  return { rows: outRows, fields: outFields };
}

const APPLIERS = { filter: applyFilter, sort: applySort, aggregate: applyAggregate, bin: applyBin };

// Runs the transform list. Invalid steps are skipped and reported in
// `errors` rather than thrown, so a half-edited chain never breaks the app.
// `steps` describes each applied step and the row count it left behind.
export function applyTransforms(rows, transforms = [], fields = []) {
  let current = { rows: [...rows], fields: [...fields] };
  const errors = [];
  const steps = [];

  transforms.forEach((transform, index) => {
    const describe = describeTransform(transform, current.fields);
    const applier = APPLIERS[transform.type];
    let failure = null;
    const fail = (message) => {
      failure = `Step ${index + 1} (${transform.type}): ${message}.`;
      return null;
    };

    const result = applier ? applier(current.rows, current.fields, transform, fail) : fail('unknown transform type');
    if (failure || !result) {
      errors.push(failure);
      steps.push({ transform, description: describe, rowCount: current.rows.length, error: failure });
      return;
    }
    current = result;
    steps.push({ transform, description: describe, rowCount: current.rows.length, error: null });
  });

  return { rows: current.rows, fields: current.fields, errors, steps };
}

// The rows and fields a spec actually encodes: raw data with its transforms
// applied.
export function resolveData(spec) {
  return applyTransforms(spec.data?.values || [], spec.transform || [], spec.data?.fields || []);
}

// Nominal sequence fields (category axes, month names, ...) keep data order,
// matching what a bar chart displays; temporal and quantitative fields sort
// ascending. Skipped entirely when the spec contains a sort transform, which
// defines playback order explicitly.
export function orderRows(rows, timeField, timeFieldType) {
  const copy = [...rows];
  if (!timeField || timeFieldType === 'nominal') return copy;

  return copy.sort((a, b) => {
    const av = a[timeField];
    const bv = b[timeField];
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  });
}
