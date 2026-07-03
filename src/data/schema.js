// Field and value helpers. Pure functions over (dataset | rows, fieldKey) so
// they work for demo datasets and imported data alike.

export function getField(dataset, key) {
  return dataset.fields.find((field) => field.key === key);
}

export function numericValues(rows, fieldKey) {
  return rows.map((row) => Number(row[fieldKey])).filter((value) => Number.isFinite(value));
}

export function extent(rows, fieldKey) {
  const values = numericValues(rows, fieldKey);
  if (!values.length) return [0, 1];
  return [Math.min(...values), Math.max(...values)];
}

export function uniqueValues(rows, fieldKey) {
  return [...new Set(rows.map((row) => row[fieldKey]))];
}

export function categoryIndex(rows, fieldKey, value) {
  const values = uniqueValues(rows, fieldKey);
  return Math.max(0, values.indexOf(value));
}
