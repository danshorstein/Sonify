# Legacy prototypes

These two apps are superseded by the root grammar lab, which is the canonical
Sonify app. They are kept for reference only and are not deployed or developed.

## Why they were retired

- `backend/` — a FastAPI service that compiled Vega-Lite specs into **static WAV
  files** with NumPy/SciPy. A WAV file is the PNG of audio: sequential,
  fixed-pace, un-explorable. Sonify's thesis is that audio must be
  *random-access* — scrubbing, anchoring, and comparing points interactively is
  the auditory equivalent of eyes scanning a chart. The Vega-Lite extraction
  logic from `backend/app/sonify/vegalite.py` was ported to the browser-side
  adapter at `src/spec/vegaLiteAdapter.js` rather than discarded.
- `frontend/` — a React/Vite demo client for that backend. The grammar lab is
  vanilla JS + ES modules with no build step, so this client is no longer
  needed.

## What replaces them

- Interactive rendering: the root app compiles a Sonify spec into encoded
  points and renders them live through Web Audio (`src/audio/player.js`).
- Vega-Lite/Altair import: `src/spec/vegaLiteAdapter.js` runs entirely in the
  browser.
- WAV export will return later as an *export* button that renders the compiled
  audio queue offline via `OfflineAudioContext` — never as the primary output.
