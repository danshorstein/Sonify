# Sonify

Prototype platform for turning Vega-Lite and Altair charts into accessible audio.

## What this is

Sonify treats chart specifications as declarative data encodings and compiles them into audio encodings. The initial prototype supports:

- Vega-Lite JSON input
- Altair wrapper support through `chart.to_dict()`
- Bar chart sonification
- Single-line chart sonification
- Multi-line chart sonification with simultaneous tracks
- Direct WAV synthesis using NumPy/SciPy
- FastAPI backend
- React/Vite frontend demo

## Vision

Charts already encode data visually through channels such as x, y, color, size, and mark type. Sonify maps those same concepts to sound:

| Vega-Lite channel | Audio channel |
| --- | --- |
| x | time / playback order |
| y | pitch |
| color | timbre / waveform |
| size | volume |
| detail | separate audio stream |
| mark | sonification recipe |

The long-term goal is an accessibility-oriented layer that can sonify web charts, dashboards, and Altair/Vega-Lite graphics.

## Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open:

```text
http://localhost:8000/docs
```

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The app expects the backend at `http://localhost:8000`.

## Python Altair usage

```python
import altair as alt
import pandas as pd
from sonify_altair import SonifiedAltairChart

source = pd.DataFrame({
    "a": ["A", "B", "C", "D", "E"],
    "b": [28, 55, 43, 91, 81]
})

chart = alt.Chart(source).mark_bar().encode(x="a", y="b")

SonifiedAltairChart(chart).display().sonify(autoplay=True)
```

## Current limitations

- Inline Vega-Lite data only
- No external Vega-Lite data URLs yet
- Bar and line charts only
- Browser extension not implemented yet
- Narration is deterministic, not AI-generated
- WAV files are generated server-side and stored locally

## Roadmap

1. More chart types: scatter, histogram, stacked bar, area, heatmap
2. Interactive controls: solo/mute tracks, slow down, hover-to-hear
3. WebAudio synthesis for real-time browser playback
4. Chrome extension that detects Vega/Vega-Lite charts on pages
5. Rich accessibility descriptions and keyboard navigation
