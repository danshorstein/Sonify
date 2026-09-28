// Encoded points -> a scheduled playback queue. Playback and interactive
// rendering share the same encoded values by construction.
//
// Queue items are {kind:'point', point, offsetSeconds, gainScale?, simplified?}
// or {kind:'speech', text, offsetSeconds}. Offsets are in "queue time" at
// tempo 1; the player divides them by tempo. Speech windows are therefore
// multiplied by tempo here, so a spoken group name always gets its real
// duration however fast the tempo is.

import { distinctGroups, effectiveComposition } from './composition.js';

const GROUP_GAP_STEPS = 0.9; // silence between groups, in steps
const SPEECH_PAD_SECONDS = 0.2;

// Rough real-time length of a spoken label, used to reserve a window for it.
export function speechSeconds(text) {
  return Math.max(0.9, 0.55 + 0.07 * String(text).length);
}

export function compileAudioQueue(points, spec, { fromIndex = 0, region = null, dilate = false, tempo = 1 } = {}) {
  const baseStep = spec.composition?.stepSeconds ?? 0.72;

  let selected = points;
  let stepSeconds = baseStep;

  if (region) {
    selected = points.slice(region.start, region.end + 1);
    if (dilate && selected.length) {
      // The audio magnifying glass: the region is re-rendered over a longer
      // duration. Because we re-schedule from encoded points rather than
      // stretching samples, there is no pitch artifact.
      const factor = Math.min(6, Math.max(1, points.length / selected.length));
      stepSeconds = baseStep * factor;
    }
  }

  const groups = distinctGroups(points);
  const grouped = points.length > 0 && groups.length > 0 && points.every((point) => point.position?.group !== undefined);
  const composition = effectiveComposition(spec.composition, groups.length, grouped);
  const mode = grouped ? composition.mode : 'sequence';

  let items;
  let totalSeconds;

  if (mode === 'overlay') {
    ({ items, totalSeconds } = overlayItems(points, selected, fromIndex, stepSeconds));
  } else if (mode === 'group' || mode === 'repeat') {
    ({ items, totalSeconds } = groupItems(selected.filter((point) => point.index >= fromIndex), {
      stepSeconds,
      tempo,
      announce: mode === 'repeat'
    }));
  } else {
    items = selected
      .filter((point) => point.index >= fromIndex)
      .map((point, position) => ({ kind: 'point', point, offsetSeconds: position * stepSeconds }));
    totalSeconds = items.length ? items[items.length - 1].offsetSeconds + stepSeconds : 0;
  }

  return { items, stepSeconds, totalSeconds, mode, note: grouped ? composition.note : null };
}

function groupItems(points, { stepSeconds, tempo, announce }) {
  const items = [];
  let offset = 0;
  let currentGroup = null;

  points.forEach((point) => {
    const group = point.position.group;
    if (group !== currentGroup) {
      if (currentGroup !== null) offset += stepSeconds * GROUP_GAP_STEPS;
      if (announce) {
        items.push({ kind: 'speech', text: String(group), offsetSeconds: offset });
        offset += (speechSeconds(group) + SPEECH_PAD_SECONDS) * tempo;
      }
      currentGroup = group;
    }
    items.push({ kind: 'point', point, offsetSeconds: offset });
    offset += stepSeconds;
  });

  return { items, totalSeconds: items.length ? offset : 0 };
}

// Every group plays at once, one time step (slot) at a time. Playing "from
// here" means from the current point's slot, across all groups. Stacked
// voices are simplified to the main tone and attenuated so the mix stays
// legible; timbre and pan keep the groups apart.
function overlayItems(allPoints, selected, fromIndex, stepSeconds) {
  const fromSlot = allPoints[fromIndex]?.position.slot ?? 0;
  const candidates = selected.filter((point) => point.position.slot >= fromSlot);
  if (!candidates.length) return { items: [], totalSeconds: 0 };

  const firstSlot = Math.min(...candidates.map((point) => point.position.slot));
  const perSlot = new Map();
  candidates.forEach((point) => perSlot.set(point.position.slot, (perSlot.get(point.position.slot) || 0) + 1));

  const items = candidates
    .map((point) => {
      const voices = perSlot.get(point.position.slot);
      return {
        kind: 'point',
        point,
        offsetSeconds: (point.position.slot - firstSlot) * stepSeconds,
        simplified: voices > 1,
        gainScale: voices > 1 ? 1 / Math.sqrt(voices) : 1
      };
    })
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds || a.point.index - b.point.index);

  const lastOffset = items[items.length - 1].offsetSeconds;
  return { items, totalSeconds: lastOffset + stepSeconds };
}
