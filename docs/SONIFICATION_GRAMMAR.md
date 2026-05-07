# Sonification Grammar

Sonify explores how data semantics can be encoded as sound. This document is the design constitution for the project.

The goal is not to turn charts into random sounds or songs. The goal is to use musical and auditory perception to make data more understandable, accessible, and testable.

## Core Principle

Encode based on perceptual fit, not novelty.

A good sonification should help a listener understand structure, trend, magnitude, identity, relationship, state, or anomaly. Musical complexity is useful only when it improves comprehension.

## Visual Grammar Recap

Visualization systems such as Vega-Lite and Altair encode data through channels such as:

| Visual channel | Typical role |
| --- | --- |
| x | time, sequence, independent variable |
| y | quantitative value |
| color | category, group, status |
| size | magnitude, importance |
| shape | category marker |
| opacity | confidence, density, emphasis |
| mark | bar, line, point, area, text |
| tooltip/text | label, exact value, explanation |

Sonify should treat these as data semantics, not as literal visual properties.

## Audio Grammar

Audio has its own channels:

| Audio channel | Common use |
| --- | --- |
| time | temporal position, sequence |
| pitch/register | quantitative magnitude, ordered value |
| timbre/instrument | identity, category, voice |
| chord/harmony | relationship, state, category identity |
| motif | category identity, recurring event |
| rhythm/density | count, frequency, distribution |
| duration | magnitude, emphasis, interval |
| articulation | continuous vs. discrete structure |
| loudness | salience, secondary magnitude only |
| pan/spatial position | separation, redundant identity cue |
| texture/noise | uncertainty, confidence, volatility |
| speech/voice | labels, summaries, accessibility explanation |

## Data Role Mappings

| Data role | Strong audio candidates | Experimental candidates |
| --- | --- | --- |
| temporal | playback time | tempo, rhythmic cycle |
| quantitative value | pitch/register | duration, brightness, loudness |
| count | rhythm density | repeated pulses, segment duration |
| nominal category | timbre, motif, chord, voice | pan, rhythm signature |
| ordinal category | sequence, pitch step | mode shift |
| group/series | track/layer, timbre, motif | chord family, pan |
| uncertainty | shimmer, noise, chord spread | suspended chord, reverb |
| anomaly | accent, percussion, dissonance | spoken warning |
| relationship | harmony/dissonance | counterpoint |
| hierarchy | bass vs. melody | register layers |
| missingness | silence/rest | dropout/noise break |
| importance | accent/duration | loudness |
| state/status/risk | musical valence, adaptive loop, consonance/tension | speech, tempo shift |

## Core Rules

1. Use audio time for temporal data unless intentionally overridden.
2. Use pitch/register for ordered quantitative magnitude, bounded and scaled.
3. Use identity encodings for categories: timbre, motif, chord, voice, rhythm, or pan.
4. Use articulation to distinguish continuous vs. discrete marks.
5. Use rhythm and density for counts and distributions.
6. Use harmony, dissonance, and suspension for relationships, uncertainty, and anomalies.
7. Use volume only as a secondary or redundant encoding.
8. Use narration and data tables as first-class accessibility outputs.
9. Do not autoplay in accessibility contexts.
10. Prefer clarity over musical cleverness.

## Mark Mappings

| Visual mark | Audio mark |
| --- | --- |
| bar | staccato note, pulse, struck tone, short chord |
| line | legato contour, continuous pitch curve, melodic phrase |
| point | short blip, pluck, click |
| area | sustained pad, drone, filled texture |
| histogram | pulse clusters, rhythm density, repeated grains |
| heatmap | texture scan, density field, pitch/register grid |
| rule/reference line | steady drone, boundary cue |
| text/label | speech, sung label, narrated cue |
| error band | shimmer, chord spread, noisy halo |

## Identity Encodings

Category should not be reduced to timbre only. Category means identity, and identity can be encoded in multiple ways.

| Encoding | Example | Strength |
| --- | --- | --- |
| timbre | bell vs. pluck vs. pad | fast recognition, simple |
| chord | Cmaj/C vs. F/C vs. Gsus/C | harmonic relationship, expressive |
| motif | three-to-five note signature | memorable, learnable |
| rhythm | long-short-short pattern | strong for event streams |
| voice | spoken or sung label | explicit, accessible |
| pan | left/center/right | useful redundant cue |
| hybrid | timbre + motif + pan | strong but can overload |

## Chord and Harmony Doctrine

Use harmony for relationships and states, not random decoration.

| Data meaning | Harmonic treatment |
| --- | --- |
| stable/normal | consonant triad/add9 |
| negative/declining | minor quality |
| uncertain | suspended chord, unresolved cadence |
| anomalous | dissonance, tritone, sharp accent |
| high confidence | full stable chord |
| low confidence | open chord, shimmer, spread |
| part-to-whole | arpeggiated chord/stack |
| shared context | pedal tone with changing upper harmony |

## State and Valence Encoding

Some data represents system state rather than chart structure: quality, safety, risk, model confidence, scanner angle, or operational health.

For these cases, use adaptive musical loops or earcons.

| State | Audio treatment |
| --- | --- |
| good/green | stable, consonant, relaxed loop |
| caution/yellow | suspended, slightly faster, mildly unresolved |
| warning/orange | minor, denser rhythm, more texture |
| critical/red | dissonant cue, sharper transient, optional speech |

For continuous operational feedback, use short adaptive musical loops rather than isolated tones.

## Anti-Patterns

- Raw numeric value directly to Hz.
- Too many simultaneous categories.
- Volume-only critical meaning.
- Autoplay by default.
- Unbounded pitch ranges.
- Harsh square/saw waves without filtering or softening.
- Speech labels on every data point.
- Musical complexity that hides the data.

## Playground Experiments

The first Sonify app should test grammar choices before hardening the library.

Suggested experiments:

1. Bar chart value encoding: pitch vs. duration vs. rhythm density vs. hybrid.
2. Category identity: timbre vs. chord vs. motif vs. voice vs. pan.
3. Time series: staccato notes vs. legato contour vs. continuous glide.
4. Multi-series line chart: timbre identity vs. chord identity vs. motif intro.
5. State feedback: green/yellow/red musical valence loops.

The purpose is to collect feedback about perceptual clarity, listening comfort, and accessibility usefulness.
