// Row ordering and (later) filter/sort/group/bin transforms.

// Nominal sequence fields (category axes, month names, ...) keep data order,
// matching what a bar chart displays; temporal and quantitative fields sort
// ascending.
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
