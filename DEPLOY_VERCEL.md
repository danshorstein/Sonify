# Deploy Sonify Grammar Lab to Vercel

The current deployable prototype is a static frontend-only Grammar Lab.

It uses:

- `index.html`
- `styles.css`
- `app.js`
- browser Web Audio API

No Python backend is required for this first Vercel deployment.

## Recommended Vercel settings

When importing the GitHub repository into Vercel:

- Framework Preset: `Other`
- Root Directory: `.`
- Build Command: leave empty
- Output Directory: leave empty or `.`
- Install Command: leave empty

The FastAPI backend under `backend/` is experimental and not required for the static Grammar Lab deployment.

## What works in the Vercel demo

The deployed app lets users:

- choose sample datasets
- compare visual and audio grammar choices
- play browser-generated sonifications
- test value-to-pitch encoding
- test value-to-duration encoding
- test rhythm-density encoding
- test chord identity encoding
- test motif identity encoding
- test green/yellow/red state-valence loops

## Future deployment options

Later, Sonify can add:

1. A hosted FastAPI backend on Railway, Render, Fly.io, or similar.
2. Vercel serverless endpoints for lightweight synthesis.
3. A SCAMP-based renderer for local/Jupyter experiments.
4. A full React/Vite app once the grammar lab direction stabilizes.
