# Sonify

An interactive data sonification workbench: it translates data visualizations —
especially Vega-Lite and Altair charts — into interactive audio experiences for
blind and low-vision users, and for anyone exploring data by ear.

The core thesis: a static audio file is the PNG of audio — sequential,
fixed-pace, un-explorable. Vision is random-access; eyes scan back and forth at
will. Sonify's scrub interaction is the auditory equivalent, so the primary
artifact is an **interactive** app, and files (WAV, JSON) are exports.

## The app

The root of this repo is the canonical app: the **Sonification Grammar Lab**, a
static vanilla-JS + Web Audio app with no build step. Open `index.html` from any
static server (or the Vercel deployment) and you can:

- choose a multi-field demo dataset
- map data fields to audio channels: time, pitch, timbre, chord, motif,
  duration, rhythm density, volume, pan, and status harmony
- play the combined sonification through Web Audio

The roadmap (see `docs/SONIFY_ENGINEERING_PLAN.md`) adds a declarative Sonify
spec, interactive scrubbing and point inspection, comparison anchors, queue
playback, and first-class Vega-Lite import with synchronized dual (visual +
audio) rendering.

## Vega-Lite and Altair

Vega-Lite chart→audio translation is the product's core differentiator. The
adapter accepts Vega-Lite JSON with inline `data.values`, suggests audio
mappings (x→time, y→pitch, color→timbre+pan, size→loudness), and compiles into
the same pipeline as the demo datasets.

To import: paste the JSON into the "Import a Vega-Lite or Altair chart" panel
(or load one of the three bundled examples — bar, multi-series line, scatter)
and press Import. Supported marks: `bar`, `line` (single and color-grouped
multi-series), `point`/`circle`. Horizontal charts (quantitative x against a
categorical y) are handled by swapping the axis suggestions. The suggested
mappings are defaults — override any of them in the mapping UI.

Imported charts get **synchronized dual rendering**: the real chart renders
via vega-embed next to the audio controls, scrubbing the audio moves a cursor
on the chart, and clicking a mark jumps the audio to that point — so a sighted
analyst and a blind analyst can explore the same artifact together.

**Altair support is Vega-Lite support**: an Altair chart is just
`chart.to_dict()`. Paste the resulting JSON into Sonify and it is treated
exactly like any Vega-Lite spec.

```python
import altair as alt
import pandas as pd

source = pd.DataFrame({"a": ["A", "B", "C"], "b": [28, 55, 43]})
chart = alt.Chart(source).mark_bar().encode(x="a", y="b")
print(chart.to_dict())  # paste this JSON into Sonify
```

## Design constitution

`docs/SONIFICATION_GRAMMAR.md` governs every audio decision: bounded pitch
ranges (never raw value→Hz), volume only as a secondary encoding, category as
identity (timbre/motif/chord/pan), no autoplay, clarity over musical
cleverness.

## Architecture

```text
UI state -> Sonify spec -> encoded points -> interactive render | queue playback | legend | exports
```

The Sonify spec is the single source of truth; no audio path bypasses the
compiler. Modules live under `src/` (`data`, `spec`, `transform`, `compiler`,
`audio`, `interaction`); `app.js` is the UI coordinator. All Web Audio goes
through `src/audio/player.js` and all speech through `src/audio/speech.js`.

## Running locally

No build step. Serve the repo root with any static server:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Legacy prototypes

`legacy/backend` (FastAPI static-WAV compiler) and `legacy/frontend` (React
demo) are superseded — see `legacy/README.md`. WAV export will return as an
`OfflineAudioContext` export of the compiled queue, never as the primary
output.
