// Encoded points -> a scheduled playback queue. Playback and interactive
// rendering share the same encoded values by construction.

export function compileAudioQueue(points, spec, { fromIndex = 0, region = null, dilate = false } = {}) {
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

  const items = selected
    .filter((point) => point.index >= fromIndex)
    .map((point, position) => ({ point, offsetSeconds: position * stepSeconds }));

  return {
    items,
    stepSeconds,
    totalSeconds: items.length ? items[items.length - 1].offsetSeconds + stepSeconds : 0
  };
}
