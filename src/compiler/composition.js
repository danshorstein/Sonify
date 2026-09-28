// Composition modes (Erie-style structure over the encoded points):
//   sequence  rows play one after another (the default)
//   group     rows play group by group, with a short gap between groups
//   repeat    like group, but each group is announced in speech first
//   overlay   groups play together on one timeline, one time step at a time
// Grouped modes reorder the encoded points group-major so scrubbing walks a
// whole group before moving to the next.

export const COMPOSITION_MODES = ['sequence', 'group', 'repeat', 'overlay'];
export const MAX_OVERLAY_GROUPS = 4;

export const MODE_LABELS = {
  sequence: 'Row sequence',
  group: 'Group sequence',
  repeat: 'Repeat by category, with speech',
  overlay: 'Overlay by category (use with care)'
};

// The field a composition groups by. Overlay reads overlayBy; group and
// repeat read groupBy; sequence groups by nothing.
export function compositionGroupField(composition = {}) {
  if (composition.mode === 'overlay') return composition.overlayBy || null;
  if (composition.mode === 'group' || composition.mode === 'repeat') return composition.groupBy || null;
  return null;
}

// What playback will actually do. A grouped mode with no usable field falls
// back to sequence, and an overlay of too many groups falls back to group
// sequence, because a wall of simultaneous voices hides the data.
export function effectiveComposition(composition = {}, groupCount = 0, fieldExists = true) {
  const requested = COMPOSITION_MODES.includes(composition.mode) ? composition.mode : 'sequence';
  const field = compositionGroupField({ ...composition, mode: requested });

  if (requested === 'sequence') return { mode: 'sequence', field: null, note: null };
  if (!field || !fieldExists) {
    return { mode: 'sequence', field: null, note: 'Choose a group-by field to use this mode; playing as a row sequence for now.' };
  }
  if (requested === 'overlay' && groupCount > MAX_OVERLAY_GROUPS) {
    return {
      mode: 'group',
      field,
      note: `Overlay plays at most ${MAX_OVERLAY_GROUPS} groups at once and this field has ${groupCount}, so playback is grouped in sequence instead.`
    };
  }
  return { mode: requested, field, note: null };
}

// Stable group-major ordering: groups in order of first appearance, rows
// keeping their existing order inside each group. Returns the reordered rows
// plus each row's group bookkeeping. `slot` is the row's time step for overlay
// (its time value's first appearance, or its position inside the group when
// there is no time field).
export function groupRows(rows, groupField, timeField) {
  const order = [];
  const buckets = new Map();
  rows.forEach((row) => {
    const key = String(row[groupField]);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key).push(row);
  });

  // Slots are numbered by first appearance in the ungrouped (time-ordered)
  // rows. Repeated time values inside one group get their own slots so they
  // never sound at the same instant.
  const slots = new Map();
  const seenInGroup = new Map();
  const slotByRow = new Map();
  rows.forEach((row) => {
    const groupKey = String(row[groupField]);
    const timeKey = timeField ? String(row[timeField]) : '';
    const occurrenceKey = `${groupKey}\u0000${timeKey}`;
    const positionInGroup = seenInGroup.get(groupKey) || 0;
    seenInGroup.set(groupKey, positionInGroup + 1);
    const occurrence = timeField ? (seenInGroup.get(occurrenceKey) || 0) : positionInGroup;
    if (timeField) seenInGroup.set(occurrenceKey, occurrence + 1);
    const slotKey = timeField ? `${timeKey}\u0000${occurrence}` : String(positionInGroup);
    if (!slots.has(slotKey)) slots.set(slotKey, slots.size);
    slotByRow.set(row, slots.get(slotKey));
  });

  const ordered = [];
  order.forEach((key, groupIndex) => {
    buckets.get(key).forEach((row, groupPosition) => {
      ordered.push({ row, group: key, groupIndex, groupPosition, groupSize: buckets.get(key).length, slot: slotByRow.get(row) });
    });
  });

  return { ordered, groups: order, slotCount: slots.size };
}

export function distinctGroups(points) {
  const seen = [];
  points.forEach((point) => {
    const group = point.position?.group;
    if (group !== undefined && !seen.includes(group)) seen.push(group);
  });
  return seen;
}
