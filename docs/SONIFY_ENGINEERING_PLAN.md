# Sonify Engineering Plan: Erie-Inspired Sonification Workbench

## Purpose

This document captures the proposed engineering direction for evolving Sonify from a promising prototype into a more durable sonification workbench.

The goal is not to immediately rebuild Sonify around Erie or Altair/Vega-Lite. The goal is to create a clear internal architecture that can support:

- Erie-level audio encodings
- Declarative sonification specs
- Data transforms and scale controls
- Auditory legends
- Timeline playback
- Interactive scrubbing and keyboard/mouse exploration
- Future Altair/Vega-Lite import/export
- Optional future Erie compatibility

---

## Current State

The current app already has a strong base:

- Multi-field demo datasets
- Declarative-ish channel definitions
- Preset mappings per dataset
- Audio channels for time, pitch, timbre, chord, motif, duration, rhythm, volume, pan, and status
- Web Audio playback
- Visual preview and data table

The main issue is architectural: dataset definitions, UI state, scale logic, audio compilation, and audio playback are mostly co-located. That makes the prototype harder to extend safely.

---

## First Principles

### 1. Sonification is a compiler problem

Sonification should not be treated as a single `play()` function. It should be a staged compilation process:

```text
raw data
  -> transformed data
  -> semantic fields
  -> audio encodings
  -> scaled audio values
  -> encoded points
  -> audio queue or on-demand rendered point
  -> Web Audio / Web Speech output
```

Each stage should be inspectable.

### 2. Users need both playback and exploration

There are two different modes:

```text
Timeline playback
  Press Play -> rows play left-to-right over time

Interactive exploration
  Scroll / arrow keys / drag -> move through rows manually and hear the selected point on demand
```

A simple “Play dataset” button is useful, but it should not be the only interaction.

### 3. The app should produce a spec, not just hold UI state

The central model should be a declarative Sonify spec:

```text
UI selections -> Sonify spec -> encoded points -> audio queue/player
```

This makes the app easier to debug, save, share, import, export, and eventually connect to Altair/Vega-Lite or Erie.

### 4. Altair/Vega-Lite is useful for data semantics, not sufficient for audio

Altair/Vega-Lite can provide excellent ideas and structures for:

- field types
- data transforms
- encodings
- scales
- domains/ranges

But Sonify still needs its own audio-native grammar for rhythm, timbre, speech, motif, auditory legends, repeat, scrub interaction, and composition.

### 5. Erie is the benchmark for sonification grammar

Erie provides the right conceptual reference:

- tone
- encoding
- scale descriptions
- Web Audio/Web Speech rendering
- sequence/overlay/repeat composition
- auditory legends
- audio queue compiler

For now, use Erie as a reference architecture before depending on it directly.

---

## Erie-Level Encoding Coverage

The plan should cover at least the practical base level of Erie-style audio encoding.

| Erie concept | Sonify target support | Priority |
|---|---|---:|
| time | sequence position / playback order / scrub axis | P0 |
| time2 | event end / interval end | P2 |
| duration | tone length | P0 |
| pitch | numeric -> MIDI/frequency | P0 |
| loudness | numeric -> gain | P0 |
| pan | category/numeric -> stereo left/right | P0 |
| timbre | category -> waveform/instrument | P0 |
| tapSpeed | numeric -> pulse rate | P1 |
| tapCount | numeric -> pulse count | P1 |
| speechBefore | spoken labels before row/group/legend | P1 |
| speechAfter | spoken summary after row/group | P2 |
| repeat | group/repeat by category | P1 |
| sequence | play streams one after another | P0 |
| overlay | play streams together | P1 |
| scale descriptions | auditory legends | P0/P1 |
| modulationIndex | FM synth parameter | P2 |
| harmonicity | AM/FM harmonic relationship | P2 |
| postReverb | reverb/spatial effect | P2 |
| filters | envelope, compressor, distortion, low/high-pass | P2 |
| sampling | sampled instruments/audio files | P2 |

---

## Target Architecture

```text
/
  index.html
  styles.css
  grammar-lab.css
  app.js                         # UI coordinator only

  src/
    data/
      datasets.js                 # demo datasets
      schema.js                   # field/type helpers

    spec/
      channels.js                 # channel definitions
      defaultMappings.js          # presets per dataset
      buildSpec.js                # UI state -> Sonify spec
      validateSpec.js             # basic validation
      vegaLiteAdapter.js          # future Altair/Vega-Lite bridge

    transform/
      transformData.js            # filter/sort/group/bin/calculate
      scales.js                   # normalization, scale functions, polarity

    compiler/
      compileEncodedPoints.js     # spec -> navigable encoded points
      compileAudioQueue.js        # encoded points -> scheduled playback queue
      compileLegendQueue.js       # spec -> speech/audio legend queue

    audio/
      player.js                   # queue/point -> Web Audio
      speech.js                   # Web Speech helpers
      instruments.js              # oscillator/chord/motif/timbre definitions

    interaction/
      navigation.js               # current index, keyboard, wheel, pointer
      scrubber.js                 # interactive exploration behavior

    ui/
      renderDatasets.js
      renderMappings.js
      renderScales.js
      renderVisualization.js
      renderInspector.js
      renderQueueInspector.js
```

Initial implementation can remain vanilla JavaScript. No need to move to React or TypeScript yet.

---

## Core Data Model: Sonify Spec

Example target spec:

```js
{
  version: "0.1",
  datasetId: "agency-spending",

  data: {
    values: [],
    fields: []
  },

  transform: [],

  tone: {
    continued: false,
    defaultWaveform: "sine",
    envelope: {
      attack: 0.025,
      release: 0.08
    }
  },

  encoding: {
    time: {
      field: "fiscalYear",
      type: "temporal",
      sort: "ascending"
    },

    pitch: {
      field: "spendBillions",
      type: "quantitative",
      scale: {
        domain: "auto",
        range: [48, 72],
        rangeType: "midi",
        scaleType: "linear",
        polarity: "positive",
        clamp: true
      }
    },

    timbre: {
      field: "agency",
      type: "nominal",
      scale: {
        range: ["sine", "triangle", "square", "sawtooth"]
      }
    },

    loudness: {
      field: "confidence",
      type: "quantitative",
      scale: {
        domain: "auto",
        range: [0.06, 0.18],
        scaleType: "linear",
        polarity: "positive"
      }
    },

    pan: {
      field: "agency",
      type: "nominal",
      scale: {
        range: [-0.75, 0.75]
      }
    },

    rhythm: {
      field: "transactionsK",
      type: "quantitative",
      scale: {
        domain: "auto",
        range: [1, 7],
        output: "pulseCount"
      }
    },

    status: {
      field: "riskScore",
      type: "quantitative",
      scale: {
        domain: "auto",
        thresholds: [0.25, 0.5, 0.75, 1.0]
      }
    }
  },

  composition: {
    mode: "sequence",
    stepSeconds: 0.72,
    groupBy: null,
    overlayBy: null
  },

  interaction: {
    mode: "scrub",
    scrub: {
      input: ["wheel", "keyboard", "pointer"],
      trigger: "onStep",
      repeatCurrentOnSpace: true,
      speakLabels: "onDemand",
      throttleMs: 80,
      stopPreviousOnMove: true
    }
  },

  legend: {
    enabled: true,
    includeSpeech: true,
    includeExamples: true
  },

  config: {
    tempo: 1,
    maxDurationSeconds: 30
  }
}
```

---

## Encoded Points

Instead of only compiling a fixed queue, Sonify should compile a navigable set of encoded points.

```text
Sonify spec
  -> transformed rows
  -> encoded points
  -> two render paths:
       1. schedule timeline playback
       2. render selected point on demand
```

Example encoded point:

```js
{
  index: 4,
  row: {
    fiscalYear: 2022,
    agency: "Defense",
    spendBillions: 742
  },

  position: {
    sequenceIndex: 4,
    normalizedX: 0.36,
    label: "2022 · Defense"
  },

  audio: {
    pitchHz: 392,
    midi: 67,
    duration: 0.32,
    gain: 0.11,
    pan: -0.75,
    waveform: "sine",
    pulseCount: 5,
    motif: [60, 64, 62],
    chord: [48, 52, 55, 60],
    statusState: "medium-risk"
  },

  explanation: {
    pitch: {
      field: "spendBillions",
      raw: 742,
      scaled: 67
    },
    loudness: {
      field: "confidence",
      raw: 82,
      scaled: 0.11
    }
  }
}
```

This lets the user move forward, backward, jump, replay, or scrub interactively.

---

## Interactive Exploration

Interactive exploration should be a first-class feature.

### MVP controls

| Control | Behavior |
|---|---|
| Right arrow | Next row |
| Left arrow | Previous row |
| Shift + arrow | Jump 5 rows |
| Home | First row |
| End | Last row |
| Mouse wheel | Move forward/backward through rows |
| Click visual point | Jump to row |
| Drag/scrub over chart | Continuously preview rows |
| Space | Replay current point |
| Enter | Play from current point onward |
| L | Play legend |
| S | Speak current data values |
| Esc | Stop all audio |

### Wheel behavior

```js
let currentIndex = 0;

visualization.addEventListener("wheel", (event) => {
  event.preventDefault();

  const direction = Math.sign(event.deltaY);
  const nextIndex = clamp(currentIndex + direction, 0, encodedPoints.length - 1);

  if (nextIndex !== currentIndex) {
    currentIndex = nextIndex;
    renderPoint(encodedPoints[currentIndex], { mode: "scrub" });
    updateCursor(currentIndex);
    updateInspector(currentIndex);
  }
});
```

Use throttling/debouncing so scroll events do not create excessive overlapping audio.

---

## Playback Engine Modes

The player should expose a small API:

```js
playQueue(queue)
stopAll()
renderPoint(encodedPoint, options = {})
speak(text)
```

### Timeline playback

```text
encoded points -> scheduled queue -> playQueue(queue)
```

### Interactive playback

```text
current index -> encoded point -> renderPoint(point)
```

### Optional future modes

```js
renderComparison(previousPoint, currentPoint)
renderRange(startIndex, endIndex)
```

---

## Scale Engine

Core function:

```js
createScale({
  field,
  type,
  domain,
  range,
  scaleType,
  polarity,
  clamp
}, rows)
```

Returns:

```js
(value) => scaledValue
```

### MVP scale types

| Scale | Priority | Notes |
|---|---:|---|
| linear | P0 | default |
| sqrt | P1 | useful for skewed values |
| log | P1 | useful for spending/cost |
| ordinal/category | P0 | maps categories to waveforms/motifs |
| threshold | P1 | status/risk |
| symlog | P2 | later |

---

## Auditory Legends

A sonification without a legend is like a chart without axes.

Add:

```js
compileLegendQueue(spec)
```

Example legend queue:

```js
[
  {
    kind: "speech",
    text: "Spend is mapped to pitch."
  },
  {
    kind: "speech",
    text: "Lowest spend, 49 billion dollars, sounds like this."
  },
  {
    kind: "tone",
    role: "legend-min",
    channel: "pitch",
    frequency: 130.81,
    duration: 0.4
  },
  {
    kind: "speech",
    text: "Highest spend, 1512 billion dollars, sounds like this."
  },
  {
    kind: "tone",
    role: "legend-max",
    channel: "pitch",
    frequency: 523.25,
    duration: 0.4
  }
]
```

### MVP legend support

| Channel | Legend behavior |
|---|---|
| Pitch | play min/max |
| Duration | play short/long |
| Loudness | play soft/loud |
| Pan | play left/right |
| Timbre | play each category waveform |
| Motif | play each category motif |
| Rhythm | play low/high pulse density |
| Status | play low/high tension |

---

## Composition Modes

### Mode 1: row sequence

```text
row 1 -> row 2 -> row 3
```

Already exists conceptually.

### Mode 2: group sequence

```text
Defense rows -> Health rows -> Education rows
```

### Mode 3: repeat by category with speech

```text
"Defense"
play Defense sequence

"Health"
play Health sequence
```

### Mode 4: overlay by category

```text
Defense + Health + Education at same timeline
```

Use carefully because it can become muddy.

---

## Transform Layer

Start small.

```js
[
  {
    type: "filter",
    field: "fiscalYear",
    op: ">=",
    value: 2022
  },
  {
    type: "sort",
    field: "riskScore",
    order: "descending"
  },
  {
    type: "aggregate",
    groupBy: ["agency"],
    fields: [
      { field: "spendBillions", op: "sum", as: "totalSpend" },
      { field: "riskScore", op: "mean", as: "avgRisk" }
    ]
  }
]
```

MVP transforms:

- filter
- sort
- aggregate
- bin
- calculate later

---

## Altair / Vega-Lite Integration Path

Design for this, but do not implement first.

Future adapter:

```js
vegaLiteToSonifySpec(vegaSpec, options)
```

Suggested mappings:

| Vega-Lite | Sonify |
|---|---|
| x | time |
| y | pitch |
| color | timbre |
| size | duration or loudness |
| shape | motif |
| opacity | confidence/noise |
| row / column | groupBy / repeat |
| tooltip | speech |
| transform | transform |

These should be suggestions, not forced mappings.

---

## Erie Integration Path

Use Erie in stages:

### Stage 1: Reference architecture

Borrow:

- spec vocabulary
- channel model
- scale descriptions
- queue compiler idea
- sequence/overlay/repeat concepts

### Stage 2: Compatibility experiment

Create a simple utility that exports a basic Sonify spec to Erie-like format for simple pitch/time/loudness cases.

### Stage 3: Optional dependency

Only consider using Erie directly once the API maturity and integration cost are understood.

---

## Implementation Phases

### Phase 1: Refactor without changing behavior

Goal: modularize the current app while preserving the existing experience.

Tasks:

1. Move datasets into `src/data/datasets.js`.
2. Move channel definitions into `src/spec/channels.js`.
3. Move presets into `src/spec/defaultMappings.js`.
4. Move scale helpers into `src/transform/scales.js`.
5. Move audio helpers into `src/audio/player.js`.
6. Keep `app.js` as UI coordinator.

Acceptance criteria:

- Same datasets show.
- Same mappings work.
- Play/stop works.
- Visual preview still renders.
- No feature regression.

### Phase 2: Add Sonify Spec and Encoded Points

Goal: stop using raw `fieldMappings` as the central model.

Tasks:

1. Add `buildSpec(dataset, fieldMappings, config)`.
2. Add `validateSpec(spec)`.
3. Add `compileEncodedPoints(spec)`.
4. Add a point inspector.
5. Add spec JSON viewer/export.

Acceptance criteria:

- Current UI generates a valid spec.
- Spec can be displayed as JSON.
- Encoded points can be inspected.

### Phase 3: Interactive point renderer

Goal: let users move through data manually.

Tasks:

1. Add `renderPoint(encodedPoint)`.
2. Add current index state.
3. Add left/right arrow navigation.
4. Add scroll wheel navigation.
5. Add visual cursor.
6. Add point detail panel.

Acceptance criteria:

- User can move forward and backward.
- User can hear the selected point on demand.
- Space replays current point.
- Visual cursor and data detail stay in sync.

### Phase 4: Timeline queue playback

Goal: make Play use the same encoded points.

Tasks:

1. Add `compileAudioQueue(encodedPoints, spec)`.
2. Add `playQueue(queue)`.
3. Update Play button to play from current index.
4. Add Stop behavior that handles queued and interactive audio.

Acceptance criteria:

- Play works from the beginning or current point.
- Stop works reliably.
- Timeline playback and interactive rendering use the same encoded values.

### Phase 5: Auditory legends

Goal: make the sonification understandable.

Tasks:

1. Add `compileLegendQueue(spec)`.
2. Add Play Legend button.
3. Add speech support.
4. Add examples for pitch, duration, loudness, pan, timbre, rhythm, and status.

Acceptance criteria:

- User can hear min/max pitch.
- User can hear category timbres/motifs.
- Speech explains mappings.

### Phase 6: Scale controls

Goal: let users shape mappings.

Tasks:

1. Add polarity toggle.
2. Add linear/log/sqrt selector.
3. Add range controls.
4. Add domain controls.
5. Reflect scale changes immediately in encoded points.

Acceptance criteria:

- Higher/lower polarity works.
- Log/sqrt changes output.
- User can make pitch range narrower/wider.
- Inspector shows raw and scaled values.

### Phase 7: Composition modes

Goal: add Erie-style structure.

Tasks:

1. Add group-by selector.
2. Add row sequence mode.
3. Add group sequence mode.
4. Add repeat-by-category mode with speech.
5. Add cautious overlay mode.

Acceptance criteria:

- Can play agency-by-agency/product-by-product/model-by-model.
- Speech announces groups.
- Overlay mode works without breaking stop/play.

### Phase 8: Transform layer

Goal: support analytical workflows.

Tasks:

1. Add filter transform.
2. Add sort transform.
3. Add aggregate transform.
4. Add bin transform.
5. Update data preview to show transformed data.

Acceptance criteria:

- User can filter rows.
- User can sort playback order.
- User can aggregate by category.
- Sonification uses transformed data.

### Phase 9: Altair/Vega-Lite adapter

Goal: support declarative chart/data workflows.

Tasks:

1. Add Vega-Lite JSON paste/import.
2. Parse data, transform, and encoding.
3. Suggest Sonify mappings.
4. Allow override.
5. Compile to Sonify spec.

Acceptance criteria:

- A simple Altair-generated Vega-Lite spec imports.
- x, y, color, and size become suggested audio mappings.
- Transforms are preserved where possible.
- User can play the resulting sonification.

---

## Recommended First PR

Title:

```text
Refactor Sonify into spec, scale, compiler, and audio modules
```

Scope:

- No major UI redesign.
- No Erie dependency yet.
- No Altair import yet.
- No composition modes yet.
- Preserve current behavior.

Files to add:

```text
src/data/datasets.js
src/spec/channels.js
src/spec/defaultMappings.js
src/spec/buildSpec.js
src/transform/scales.js
src/compiler/compileEncodedPoints.js
src/audio/player.js
```

Behavioral goal:

```text
dataset + field mappings
  -> Sonify spec
  -> encoded points
  -> timeline playback or interactive rendering
```

---

## Open Decision Points

| Decision | Recommendation |
|---|---|
| Use Erie directly now? | No, use as reference first |
| Keep vanilla JS or move to React? | Keep vanilla JS for this refactor |
| Add TypeScript now? | Not yet |
| Make Altair/Vega-Lite first-class now? | Design for it, implement later |
| First feature after modular refactor? | Interactive scrubbing + point inspector |
| Next feature after that? | Auditory legend + scale controls |
| Main architecture | Sonify spec -> encoded points -> queue/player |

---

## Product Vision

Sonify should become an interactive sonification workbench:

```text
Choose or import data
Map fields to audio channels
Hear a legend
Play the whole dataset
Scrub through the dataset with wheel/keyboard/mouse
Inspect each point
Adjust scales and mappings
Save/share the sonification spec
```

The key shift is from a passive “play dataset” toy to an exploratory audio interface where the user can move through data intentionally.