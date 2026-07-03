// Row ordering and (later) filter/sort/group/bin transforms.

export function orderRows(rows, timeField) {
  const copy = [...rows];
  if (!timeField) return copy;

  return copy.sort((a, b) => {
    const av = a[timeField];
    const bv = b[timeField];
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  });
}
