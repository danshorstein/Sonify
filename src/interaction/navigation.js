// Keyboard, wheel, and pointer bindings for the sonification explorer
// region. This module owns input translation only; the app owns state.

const JUMP = 5;

export function bindExplorer(region, handlers) {
  region.addEventListener('keydown', (event) => {
    const key = event.key;
    let handled = true;

    if (key === 'ArrowRight' && event.shiftKey) handlers.onExtendRegion?.(1);
    else if (key === 'ArrowLeft' && event.shiftKey) handlers.onExtendRegion?.(-1);
    else if (key === 'ArrowRight') handlers.onStep?.(event.ctrlKey ? JUMP : 1);
    else if (key === 'ArrowLeft') handlers.onStep?.(event.ctrlKey ? -JUMP : -1);
    else if (key === 'PageDown') handlers.onStep?.(JUMP);
    else if (key === 'PageUp') handlers.onStep?.(-JUMP);
    else if (key === 'Home') handlers.onHome?.();
    else if (key === 'End') handlers.onEnd?.();
    else if (key === ' ') handlers.onReplay?.();
    else if (key === 'Enter') handlers.onPlayFrom?.();
    else if (key === 'Escape') handlers.onStop?.();
    else if (key === 'a' || key === 'A') handlers.onAnchor?.();
    else if (key === 'c' || key === 'C') handlers.onCompare?.();
    else if (key === 'm' || key === 'M') handlers.onMax?.();
    else if (key === 'n' || key === 'N') handlers.onMin?.();
    else if (key === 's' || key === 'S') handlers.onSpeak?.();
    else if (key === 'l' || key === 'L') handlers.onLegend?.();
    else if (key === 'z' || key === 'Z') handlers.onZoom?.();
    else if (key === 'x' || key === 'X') handlers.onClearRegion?.();
    else if (key === '?') handlers.onHelp?.();
    else handled = false;

    if (handled) event.preventDefault();
  });

  region.addEventListener('wheel', (event) => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    if (direction !== 0) handlers.onStep?.(direction);
  }, { passive: false });

  let dragging = false;

  region.addEventListener('pointerdown', (event) => {
    if (!handlers.indexFromX) return;
    dragging = true;
    region.setPointerCapture(event.pointerId);
    const index = handlers.indexFromX(event.clientX);
    if (index !== null) handlers.onScrubTo?.(index);
  });

  region.addEventListener('pointermove', (event) => {
    if (!dragging || !handlers.indexFromX) return;
    const index = handlers.indexFromX(event.clientX);
    if (index !== null) handlers.onScrubTo?.(index);
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    try { region.releasePointerCapture(event.pointerId); } catch (error) { /* not captured */ }
  };
  region.addEventListener('pointerup', endDrag);
  region.addEventListener('pointercancel', endDrag);
}

// The canonical control list, rendered into the help overlay so the docs
// and the bindings cannot drift apart.
export const CONTROLS = [
  { keys: '→ / ←', action: 'Next / previous point' },
  { keys: 'Ctrl+→ / Ctrl+← or PageDown / PageUp', action: 'Jump 5 points' },
  { keys: 'Home / End', action: 'First / last point' },
  { keys: 'Mouse wheel', action: 'Scrub forward / backward' },
  { keys: 'Click or drag on chart', action: 'Jump / scrub to a point' },
  { keys: 'Space', action: 'Replay current point (full detail)' },
  { keys: 'Enter', action: 'Play from current point onward' },
  { keys: 'Shift+→ / Shift+←', action: 'Extend a selection region from the current point' },
  { keys: 'Z', action: 'Zoom into the selected region (dilated playback)' },
  { keys: 'X', action: 'Clear the selection region / zoom' },
  { keys: 'A', action: 'Anchor the current point for comparison' },
  { keys: 'C', action: 'Compare: play anchor then current, then speak the change' },
  { keys: 'M / N', action: 'Jump to maximum / minimum of the pitch-mapped field' },
  { keys: 'S', action: 'Speak the current point values' },
  { keys: 'L', action: 'Play the auditory legend' },
  { keys: 'Esc', action: 'Stop all audio and speech' },
  { keys: '?', action: 'Open this keyboard help' }
];
