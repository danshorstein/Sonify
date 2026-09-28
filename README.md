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

Beyond the mapping lab, the app has a declarative Sonify spec, interactive
scrubbing and point inspection, comparison anchors, queue playback with region
zoom, auditory legends, first-class Vega-Lite import with synchronized dual
(visual + audio) rendering, scale controls, composition modes, and a data
transform layer. All nine phases of `docs/SONIFY_ENGINEERING_PLAN.md` are
shipped.

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

## Shaping the sound

**Scales.** Every mapped numeric channel (pitch, duration, volume, rhythm,
quantitative pan, status) has a scale you can edit in "Shape the scales":
polarity (higher value goes higher or lower), scale type (linear, square root,
logarithmic, signed log), a bounded range, and a data domain (blank means
auto). Ranges are always bounded per the design constitution. The point
inspector shows raw and scaled values, and the legend explains reversed or
non-linear scales.

**Composition.** "Composition" chooses how rows arrange in time on Play:

- *Row sequence* - one row after another (default).
- *Group sequence* - each group plays in turn with a pause between groups.
- *Repeat by category* - each group's name is spoken, then its rows play.
- *Overlay by category* - up to four groups play together, one time step at a
  time, simplified to their main tones (timbre and pan keep them apart).

Grouped modes also reorder scrubbing so you walk a whole group at a time.

**Transforms.** "Transform the data" runs filter, sort, aggregate, and bin
steps over the rows before they are sonified. Steps run top to bottom; the data
preview, mapping choices, spec, and audio all use the transformed rows. A sort
step sets playback order. For example, a histogram is *bin* a numeric field,
then *aggregate* a count grouped by the bin: map the bin to time and the count
to pitch or rhythm. Transforms live in the spec as `transform: [...]`:

```json
{ "type": "filter", "field": "fiscalYear", "op": ">=", "value": 2022 }
{ "type": "sort", "field": "riskScore", "order": "descending" }
{ "type": "aggregate", "groupBy": ["agency"], "fields": [{ "field": "spendBillions", "op": "sum", "as": "totalSpend" }] }
{ "type": "bin", "field": "riskScore", "step": 10, "as": "riskBin" }
```

## Design constitution

`docs/SONIFICATION_GRAMMAR.md` governs every audio decision: bounded pitch
ranges (never raw value→Hz), volume only as a secondary encoding, category as
identity (timbre/motif/chord/pan), no autoplay, clarity over musical
cleverness.

## Architecture

```text
UI state -> Sonify spec -> transformed data -> encoded points -> interactive render | queue playback | legend | exports
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

## Tests

The spec, scale, transform, compiler, and composition logic are pure modules
covered by Node's built-in test runner (no dependencies):

```bash
npm test
```

Browser tests (Playwright driving real Chromium against the static app) cover
scale controls, transforms, composition modes, keyboard exploration, the
legend, and Vega-Lite import. They block the vega CDN, so they run offline.

```bash
npm install
npm run test:e2e   # set CHROMIUM_PATH if Chromium is not in a default location
```

## Legacy prototypes

`legacy/backend` (FastAPI static-WAV compiler) and `legacy/frontend` (React
demo) are superseded — see `legacy/README.md`. WAV export will return as an
`OfflineAudioContext` export of the compiled queue, never as the primary
output.
