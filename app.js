import { datasets } from './src/data/datasets.js';
import { getField, extent, categoryIndex } from './src/data/schema.js';
import { channelDefinitions } from './src/spec/channels.js';
import { presets } from './src/spec/defaultMappings.js';
import { buildSpec } from './src/spec/buildSpec.js';
import { validateSpec } from './src/spec/validateSpec.js';
import { compileEncodedPoints } from './src/compiler/compileEncodedPoints.js';
import { compileAudioQueue } from './src/compiler/compileAudioQueue.js';
import { ensureAudioContext, playQueue, renderPoint, renderComparison, stopAll } from './src/audio/player.js';
import { speak, stopSpeech } from './src/audio/speech.js';
import { bindExplorer, CONTROLS } from './src/interaction/navigation.js';
import { vegaLiteToSonify } from './src/spec/vegaLiteAdapter.js';
import { exampleSpecs } from './src/spec/examples.js';

const state = {
  dataset: datasets[0],
  mappings: { ...presets[datasets[0].id] },
  spec: null,
  points: [],
  currentIndex: 0,
  anchorIndex: null,
  region: null,
  zoomed: false,
  vizXs: [],
  lastScrubAudioAt: 0,
  imported: null
};

// vega-embed view state for imported charts (Amendment 4 dual rendering).
let vegaView = null;
let vegaEmbedded = null; // which import the current view renders
let vegaRenderToken = 0;
let vegaPointXs = []; // canvas-relative x px per encoded point

const datasetOptions = document.getElementById('dataset-options');
const mappingOptions = document.getElementById('mapping-options');
const visualization = document.getElementById('visualization');
const chartType = document.getElementById('chart-type');
const mappingFit = document.getElementById('mapping-fit');
const mappingDescription = document.getElementById('mapping-description');
const playButton = document.getElementById('play-button');
const stopButton = document.getElementById('stop-button');
const tempoSlider = document.getElementById('tempo-slider');
const tempoValue = document.getElementById('tempo-value');
const specJson = document.getElementById('spec-json');
const copySpecButton = document.getElementById('copy-spec');
const downloadSpecButton = document.getElementById('download-spec');
const pointInspector = document.getElementById('point-inspector');
const pointPosition = document.getElementById('point-position');
const prevPointButton = document.getElementById('prev-point');
const nextPointButton = document.getElementById('next-point');
const hearPointButton = document.getElementById('hear-point');
const speakPointButton = document.getElementById('speak-point');
const anchorPointButton = document.getElementById('anchor-point');
const comparePointButton = document.getElementById('compare-point');
const anchorStatus = document.getElementById('anchor-status');
const announcer = document.getElementById('announcer');
const helpButton = document.getElementById('help-button');
const exampleButtons = document.getElementById('example-buttons');
const vlInput = document.getElementById('vl-input');
const importButton = document.getElementById('import-vl');
const importError = document.getElementById('import-error');
const helpOverlay = document.getElementById('help-overlay');
const helpTableBody = document.querySelector('#help-table tbody');
const closeHelpButton = document.getElementById('close-help');

const dataTable = document.createElement('div');
dataTable.className = 'data-table-shell';

const explanation = document.createElement('div');
explanation.className = 'mapping-explanation';

let helpReturnFocus = null;

function init() {
  renderDatasetButtons();
  renderFieldMappingControls();
  insertAdditionalPanels();
  renderHelpTable();
  renderAll();

  playButton.addEventListener('click', playFromCurrent);
  stopButton.addEventListener('click', stopEverything);

  tempoSlider.addEventListener('input', () => {
    tempoValue.textContent = `${tempo().toFixed(1)}x`;
  });

  prevPointButton.addEventListener('click', () => moveToIndex(state.currentIndex - 1));
  nextPointButton.addEventListener('click', () => moveToIndex(state.currentIndex + 1));
  hearPointButton.addEventListener('click', replayCurrentPoint);
  speakPointButton.addEventListener('click', speakCurrentPoint);
  anchorPointButton.addEventListener('click', setAnchor);
  comparePointButton.addEventListener('click', compareWithAnchor);

  copySpecButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(specText());
      copySpecButton.textContent = 'Copied!';
    } catch (error) {
      copySpecButton.textContent = 'Copy failed';
    }
    setTimeout(() => { copySpecButton.textContent = 'Copy JSON'; }, 1200);
  });

  downloadSpecButton.addEventListener('click', () => {
    const blob = new Blob([specText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sonify-spec-${state.dataset.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  exampleSpecs.forEach((example) => {
    const button = document.createElement('button');
    button.className = 'secondary-button';
    button.textContent = `Load example: ${example.label}`;
    button.addEventListener('click', () => {
      vlInput.value = JSON.stringify(example.spec, null, 2);
      importVegaLite();
    });
    exampleButtons.appendChild(button);
  });

  importButton.addEventListener('click', importVegaLite);

  window.addEventListener('resize', () => {
    if (vegaView) {
      buildVegaPointXs();
      updateCursor();
    }
  });

  helpButton.addEventListener('click', openHelp);
  closeHelpButton.addEventListener('click', closeHelp);
  helpOverlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeHelp();
    }
  });
  helpOverlay.addEventListener('click', (event) => {
    if (event.target === helpOverlay) closeHelp();
  });

  bindExplorer(visualization, {
    onStep: (delta) => moveToIndex(state.currentIndex + delta),
    onHome: () => moveToIndex(0),
    onEnd: () => moveToIndex(state.points.length - 1),
    onScrubTo: (index) => moveToIndex(index),
    indexFromX: indexFromClientX,
    onReplay: replayCurrentPoint,
    onPlayFrom: playFromCurrent,
    onStop: stopEverything,
    onExtendRegion: extendRegion,
    onZoom: toggleZoom,
    onClearRegion: clearRegion,
    onAnchor: setAnchor,
    onCompare: compareWithAnchor,
    onMax: () => jumpToExtreme('max'),
    onMin: () => jumpToExtreme('min'),
    onSpeak: speakCurrentPoint,
    onHelp: openHelp
  });
}

function tempo() {
  return Number(tempoSlider.value);
}

function specText() {
  return JSON.stringify(state.spec, null, 2);
}

function announce(text) {
  announcer.textContent = '';
  // Re-set on the next tick so repeated identical announcements are re-read.
  requestAnimationFrame(() => { announcer.textContent = text; });
}

function currentPoint() {
  return state.points[state.currentIndex] || null;
}

function pitchFieldInfo() {
  const fieldKey = state.mappings.pitch;
  if (!fieldKey) return null;
  return { key: fieldKey, label: getField(state.dataset, fieldKey)?.label || fieldKey };
}

function pointSummary(point) {
  const pitch = pitchFieldInfo();
  const parts = [`${point.index + 1} of ${state.points.length}: ${point.position.label}.`];
  if (pitch) parts.push(`${pitch.label} ${point.row[pitch.key]}.`);
  return parts.join(' ');
}

function regionBounds() {
  if (!state.region) return null;
  return {
    start: Math.min(state.region.anchor, state.region.focus),
    end: Math.max(state.region.anchor, state.region.focus)
  };
}

function moveToIndex(index, { scrubAudio = true } = {}) {
  if (!state.points.length) return;
  // While zoomed, navigation confines itself to the selected region.
  const bounds = state.zoomed ? regionBounds() : null;
  const lo = bounds ? bounds.start : 0;
  const hi = bounds ? bounds.end : state.points.length - 1;
  const clamped = Math.max(lo, Math.min(hi, index));
  if (clamped === state.currentIndex) return;
  state.currentIndex = clamped;

  renderPointInspector();
  updateCursor();
  const point = currentPoint();
  announce(pointSummary(point));

  if (scrubAudio) {
    const throttleMs = state.spec?.interaction?.scrub?.throttleMs ?? 80;
    const timestamp = performance.now();
    if (timestamp - state.lastScrubAudioAt >= throttleMs) {
      state.lastScrubAudioAt = timestamp;
      renderPoint(point, { mode: 'scrub', tempo: tempo() });
    }
  }
}

function replayCurrentPoint() {
  const point = currentPoint();
  if (!point) return;
  stopSpeech();
  renderPoint(point, { mode: 'full', tempo: tempo() });
  announce(`Replayed ${point.position.label}.`);
}

function speakCurrentPoint() {
  const point = currentPoint();
  if (!point) return;
  const details = Object.entries(point.explanation)
    .filter(([channel]) => channel !== 'pitch')
    .map(([, detail]) => {
      const label = getField(state.dataset, detail.field)?.label || detail.field;
      return `${label} ${detail.raw}`;
    });
  const seen = new Set();
  const unique = details.filter((detail) => {
    if (seen.has(detail)) return false;
    seen.add(detail);
    return true;
  });
  speak(`${pointSummary(point)} ${unique.join('. ')}.`);
}

function setAnchor() {
  const point = currentPoint();
  if (!point) return;
  state.anchorIndex = state.currentIndex;
  renderAnchorStatus();
  announce(`Anchored ${point.position.label}.`);
}

function compareWithAnchor() {
  const point = currentPoint();
  if (!point) return;
  if (state.anchorIndex === null || !state.points[state.anchorIndex]) {
    announce('No anchor set. Press A on a point first.');
    speak('No anchor set. Press A on a point first.');
    return;
  }

  const anchorPoint = state.points[state.anchorIndex];
  stopSpeech();
  const totalSeconds = renderComparison(anchorPoint, point, { tempo: tempo() });

  const pitch = pitchFieldInfo();
  let deltaText = '';
  if (pitch) {
    const from = Number(anchorPoint.row[pitch.key]);
    const to = Number(point.row[pitch.key]);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      if (from === to) {
        deltaText = `${pitch.label} unchanged at ${to}.`;
      } else if (from !== 0) {
        const pct = ((to - from) / Math.abs(from)) * 100;
        deltaText = `${pitch.label} ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)} percent.`;
      } else {
        deltaText = `${pitch.label} changed from ${from} to ${to}.`;
      }
    }
  }

  const summary = `Compared anchor ${anchorPoint.position.label} with ${point.position.label}. ${deltaText}`;
  announce(summary);
  setTimeout(() => speak(summary, { interrupt: false }), Math.max(0, totalSeconds * 1000));
}

function jumpToExtreme(kind) {
  const pitch = pitchFieldInfo();
  if (!pitch || !state.points.length) {
    announce('No pitch field mapped.');
    return;
  }

  let bestIndex = 0;
  state.points.forEach((point, index) => {
    const value = Number(point.row[pitch.key]);
    const best = Number(state.points[bestIndex].row[pitch.key]);
    if (kind === 'max' ? value > best : value < best) bestIndex = index;
  });

  state.currentIndex = bestIndex;
  renderPointInspector();
  updateCursor();
  const point = currentPoint();
  renderPoint(point, { mode: 'full', tempo: tempo() });
  const text = `${kind === 'max' ? 'Maximum' : 'Minimum'} ${pitch.label}: ${point.row[pitch.key]}, at ${point.position.label}.`;
  announce(text);
  speak(text);
}

function stopEverything() {
  stopAll();
  stopSpeech();
  announce('Stopped.');
}

function extendRegion(direction) {
  if (!state.points.length) return;
  if (state.zoomed) {
    announce('Clear the zoom with X before changing the selection.');
    return;
  }

  if (!state.region) {
    const focus = Math.max(0, Math.min(state.points.length - 1, state.currentIndex + direction));
    state.region = { anchor: state.currentIndex, focus };
  } else {
    state.region.focus = Math.max(0, Math.min(state.points.length - 1, state.region.focus + direction));
  }

  moveToIndex(state.region.focus);
  updateRegionVisual();
  const bounds = regionBounds();
  announce(`Selected points ${bounds.start + 1} to ${bounds.end + 1} of ${state.points.length}. Press Z to zoom.`);
}

function toggleZoom() {
  if (!state.region) {
    announce('No region selected. Use Shift with arrow keys to select a region first.');
    return;
  }

  state.zoomed = !state.zoomed;
  const bounds = regionBounds();
  if (state.zoomed) {
    moveToIndex(Math.max(bounds.start, Math.min(bounds.end, state.currentIndex)), { scrubAudio: false });
    announce(`Zoomed into points ${bounds.start + 1} to ${bounds.end + 1}. Playback is dilated. Press Enter to play, X to zoom out.`);
  } else {
    announce('Zoomed out.');
  }
  updateRegionVisual();
}

function clearRegion() {
  if (!state.region && !state.zoomed) return;
  state.region = null;
  state.zoomed = false;
  updateRegionVisual();
  announce('Selection cleared.');
}

function openHelp() {
  helpReturnFocus = document.activeElement;
  helpOverlay.hidden = false;
  closeHelpButton.focus();
}

function closeHelp() {
  helpOverlay.hidden = true;
  if (helpReturnFocus && typeof helpReturnFocus.focus === 'function') helpReturnFocus.focus();
  helpReturnFocus = null;
}

function renderHelpTable() {
  helpTableBody.innerHTML = CONTROLS.map((control) => `
    <tr><td><kbd>${control.keys}</kbd></td><td>${control.action}</td></tr>
  `).join('');
}

function renderAnchorStatus() {
  const anchorPoint = state.anchorIndex !== null ? state.points[state.anchorIndex] : null;
  anchorStatus.textContent = anchorPoint
    ? `Anchor: ${anchorPoint.position.label} (point ${anchorPoint.index + 1}). Press C on any point to compare.`
    : 'No anchor set. Press A on a point to bookmark it for comparison.';
}

function importVegaLite() {
  importError.textContent = '';
  const text = vlInput.value.trim();
  if (!text) {
    importError.textContent = 'Paste a Vega-Lite JSON spec first.';
    return;
  }

  let result;
  try {
    result = vegaLiteToSonify(text);
  } catch (error) {
    importError.textContent = error instanceof SyntaxError ? `Not valid JSON: ${error.message}` : error.message;
    announce(`Import failed. ${importError.textContent}`);
    return;
  }

  stopAll();
  state.imported = result;
  state.dataset = result.dataset;
  state.mappings = { ...result.mappings };
  state.currentIndex = 0;
  state.anchorIndex = null;
  state.region = null;
  state.zoomed = false;
  renderAll();
  announce(`Imported ${result.dataset.name}: ${result.dataset.rows.length} points. Suggested mappings applied. Focus the chart to explore.`);
}

function recompile() {
  state.spec = buildSpec(state.dataset, state.mappings, {
    tempo: tempo(),
    articulation: state.dataset.articulation
  });
  const validation = validateSpec(state.spec);
  if (!validation.valid) {
    console.warn('Sonify spec validation errors:', validation.errors);
  }
  state.points = compileEncodedPoints(state.spec);
  state.currentIndex = Math.max(0, Math.min(state.points.length - 1, state.currentIndex));
  if (state.anchorIndex !== null && state.anchorIndex >= state.points.length) state.anchorIndex = null;
  if (state.region && (state.region.anchor >= state.points.length || state.region.focus >= state.points.length)) {
    state.region = null;
    state.zoomed = false;
  }
}

function insertAdditionalPanels() {
  const tablePanel = document.createElement('section');
  tablePanel.className = 'panel';
  tablePanel.innerHTML = '<h2>Data preview</h2>';
  tablePanel.appendChild(dataTable);

  const explanationPanel = document.createElement('section');
  explanationPanel.className = 'panel';
  explanationPanel.innerHTML = '<h2>Current audio interpretation</h2>';
  explanationPanel.appendChild(explanation);

  const mappingTablePanel = document.querySelector('[aria-labelledby="mapping-table-title"]');
  mappingTablePanel.parentNode.insertBefore(explanationPanel, mappingTablePanel);
  mappingTablePanel.parentNode.insertBefore(tablePanel, explanationPanel);
}

function renderDatasetButtons() {
  datasetOptions.innerHTML = '';

  const selectable = [...datasets];
  if (state.imported) selectable.push(state.imported.dataset);

  selectable.forEach((dataset) => {
    const button = document.createElement('button');
    button.className = `option-button ${dataset.id === state.dataset.id ? 'active' : ''}`;
    button.setAttribute('aria-pressed', String(dataset.id === state.dataset.id));
    button.innerHTML = `<strong>${dataset.name}</strong><span>${dataset.description}</span>`;
    button.addEventListener('click', () => {
      state.dataset = dataset;
      state.mappings = dataset.id === 'imported' ? { ...state.imported.mappings } : { ...presets[dataset.id] };
      state.currentIndex = 0;
      state.anchorIndex = null;
      state.region = null;
      state.zoomed = false;
      renderAll();
    });
    datasetOptions.appendChild(button);
  });
}

function renderFieldMappingControls() {
  mappingOptions.innerHTML = '';
  mappingOptions.classList.add('mapping-grid');

  channelDefinitions.forEach((channel) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'mapping-control';

    const options = state.dataset.fields
      .filter((field) => channel.accepted.includes(field.type))
      .map((field) => `<option value="${field.key}" ${state.mappings[channel.key] === field.key ? 'selected' : ''}>${field.label} (${field.type})</option>`)
      .join('');

    wrapper.innerHTML = `
      <span class="mapping-label">${channel.label}</span>
      <select data-channel="${channel.key}">
        <option value="none">Off</option>
        ${options}
      </select>
      <small>${channel.description}</small>
    `;

    const select = wrapper.querySelector('select');
    select.addEventListener('change', (event) => {
      state.mappings[channel.key] = event.target.value === 'none' ? null : event.target.value;
      renderAll({ skipControls: true });
    });

    mappingOptions.appendChild(wrapper);
  });
}

function renderAll(options = {}) {
  recompile();

  if (!options.skipControls) {
    renderDatasetButtons();
    renderFieldMappingControls();
  }

  chartType.textContent = `${state.dataset.rows.length} rows · ${state.dataset.fields.length} fields`;
  mappingFit.textContent = 'Custom grammar';
  mappingDescription.textContent = 'Each row is rendered as a small audio event. Your field mappings determine the pitch, rhythm, duration, chord, motif, pan, volume, timbre, and state-harmony cues. This is intentionally a grammar playground, not a finished chart recommendation.';

  renderVisualization();
  renderDataTable();
  renderExplanation();
  renderSpecViewer();
  renderPointInspector();
  renderAnchorStatus();
}

function renderVisualization() {
  // Imported charts get true dual rendering: the real Vega-Lite chart with a
  // synchronized audio cursor. Demo datasets keep the hand-rolled preview.
  if (state.dataset.id === 'imported' && window.vegaEmbed) {
    renderVegaChart();
    return;
  }

  vegaView = null;
  vegaEmbedded = null;
  vegaRenderToken += 1;

  visualization.innerHTML = '';
  visualization.classList.add('grammar-viz');
  visualization.classList.remove('vega-host');

  const pitchField = state.mappings.pitch || state.dataset.fields.find((field) => field.type === 'quantitative')?.key;
  const colorField = state.mappings.timbre || state.mappings.chord || state.mappings.motif;
  const timeField = state.mappings.time;
  const [min, max] = extent(state.dataset.rows, pitchField);

  const width = 720;
  const height = 260;
  const pad = 26;

  const points = state.points.map((point, index) => {
    const x = pad + (index / Math.max(1, state.points.length - 1)) * (width - pad * 2);
    const value = Number(point.row[pitchField]);
    const y = height - pad - ((value - min) / Math.max(1, max - min)) * (height - pad * 2);
    return { x, y, row: point.row };
  });

  state.vizXs = points.map((point) => point.x);

  const circles = points.map(({ x, y, row }, index) => {
    const category = colorField ? row[colorField] : '';
    const hue = colorField ? (categoryIndex(state.dataset.rows, colorField, category) * 72) % 360 : 195;
    return `<circle class="viz-point" data-index="${index}" cx="${x}" cy="${y}" r="8" fill="hsl(${hue}, 82%, 68%)"><title>${rowLabel(row)} · ${pitchField}: ${row[pitchField]}</title></circle>`;
  }).join('');

  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const labels = points.map(({ x, row }, index) => {
    if (index % 2 === 1 && points.length > 8) return '';
    const text = timeField ? row[timeField] : index + 1;
    return `<text x="${x}" y="${height - 4}" text-anchor="middle" fill="#a7b0be" font-size="11">${text}</text>`;
  }).join('');

  visualization.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#2f3a4a" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#2f3a4a" />
      <rect id="viz-region" y="${pad}" height="${height - pad * 2}" fill="rgba(125, 211, 252, 0.14)" stroke="rgba(125, 211, 252, 0.5)" stroke-dasharray="3 3" visibility="hidden" />
      <polyline points="${line}" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
      <line id="viz-cursor" class="viz-cursor" x1="0" y1="${pad}" x2="0" y2="${height - pad}" stroke="#f8fafc" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.9" />
      ${circles}
      ${labels}
      <text x="${pad}" y="16" fill="#7dd3fc" font-size="12">pitch: ${getField(state.dataset, pitchField)?.label || 'none'}</text>
    </svg>
  `;

  updateCursor();
  updateRegionVisual();
}

async function renderVegaChart() {
  const imported = state.imported;
  // Re-embedding is only needed when the imported chart itself changes;
  // mapping tweaks just re-sync the cursor.
  if (vegaEmbedded === imported && vegaView) {
    buildVegaPointXs();
    updateCursor();
    return;
  }

  const token = ++vegaRenderToken;
  visualization.classList.remove('grammar-viz');
  visualization.classList.add('vega-host');
  visualization.innerHTML = `
    <div id="vega-chart"></div>
    <div id="vega-cursor" class="vega-cursor" hidden></div>
  `;

  const vlSpec = { width: 'container', height: 240, ...imported.meta.vlSpec };

  try {
    const result = await window.vegaEmbed(visualization.querySelector('#vega-chart'), vlSpec, {
      actions: false,
      tooltip: false,
      config: {
        background: 'transparent',
        axis: { labelColor: '#a7b0be', titleColor: '#a7b0be', gridColor: '#2f3a4a', domainColor: '#2f3a4a', tickColor: '#2f3a4a' },
        legend: { labelColor: '#a7b0be', titleColor: '#a7b0be' },
        title: { color: '#f8fafc' },
        view: { stroke: '#2f3a4a' }
      }
    });
    if (token !== vegaRenderToken) {
      result.view.finalize();
      return;
    }
    vegaView = result.view;
    vegaEmbedded = imported;
    vegaView.addEventListener('click', (event, item) => {
      const index = indexFromDatum(item?.datum);
      if (index !== null) moveToIndex(index);
    });
    buildVegaPointXs();
    updateCursor();
  } catch (error) {
    console.warn('vega-embed failed; falling back to the built-in preview.', error);
    if (token === vegaRenderToken) {
      vegaView = null;
      vegaEmbedded = null;
      visualization.classList.remove('vega-host');
      renderFallbackPreview();
    }
  }
}

function renderFallbackPreview() {
  // Reuse the SVG preview path without re-entering the vega branch.
  const dataset = state.dataset;
  state.dataset = { ...dataset, id: `${dataset.id}-fallback` };
  try {
    renderVisualization();
  } finally {
    state.dataset = dataset;
  }
}

function buildVegaPointXs() {
  vegaPointXs = [];
  if (!vegaView || !state.imported) return;

  try {
    const meta = state.imported.meta;
    const scale = vegaView.scale('x');
    const bandOffset = typeof scale.bandwidth === 'function' ? scale.bandwidth() / 2 : 0;

    vegaPointXs = state.points.map((point) => {
      let value = point.row[meta.xField];
      if (meta.xType === 'temporal' && !(value instanceof Date)) {
        const asDate = new Date(value);
        if (!Number.isNaN(+asDate)) value = asDate;
      }
      const px = scale(value);
      return Number.isFinite(px) ? px + bandOffset : null;
    });
  } catch (error) {
    console.warn('Could not compute chart cursor positions.', error);
    vegaPointXs = [];
  }
}

function vegaCanvasElement() {
  return visualization.querySelector('#vega-chart canvas, #vega-chart svg');
}

function updateVegaCursor() {
  const cursor = visualization.querySelector('#vega-cursor');
  const canvas = vegaCanvasElement();
  if (!cursor || !canvas || !vegaView) return;

  const px = vegaPointXs[state.currentIndex];
  if (px === null || px === undefined) {
    cursor.hidden = true;
    return;
  }

  const origin = vegaView.origin();
  const canvasRect = canvas.getBoundingClientRect();
  const hostRect = visualization.getBoundingClientRect();

  cursor.hidden = false;
  cursor.style.left = `${canvasRect.left - hostRect.left + origin[0] + px - 1}px`;
  cursor.style.top = `${canvasRect.top - hostRect.top + origin[1]}px`;
  cursor.style.height = `${vegaView.height()}px`;
}

function indexFromDatum(datum) {
  if (!datum || !state.imported) return null;

  const meta = state.imported.meta;
  const matches = (rowValue, datumValue, type) => {
    if (type === 'temporal') {
      const a = +new Date(rowValue);
      const b = datumValue instanceof Date ? +datumValue : +new Date(datumValue);
      if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
    }
    return String(rowValue) === String(datumValue) || Number(rowValue) === Number(datumValue);
  };

  for (const point of state.points) {
    if (!matches(point.row[meta.xField], datum[meta.xField], meta.xType)) continue;
    if (meta.colorField && String(point.row[meta.colorField]) !== String(datum[meta.colorField])) continue;
    return point.index;
  }
  return null;
}

function updateRegionVisual() {
  const rect = visualization.querySelector('#viz-region');
  if (!rect) return;

  const bounds = regionBounds();
  if (!bounds || !state.vizXs.length) {
    rect.setAttribute('visibility', 'hidden');
    return;
  }

  const startX = state.vizXs[bounds.start];
  const endX = state.vizXs[bounds.end];
  rect.setAttribute('x', startX - 8);
  rect.setAttribute('width', Math.max(16, endX - startX + 16));
  rect.setAttribute('visibility', 'visible');
  rect.setAttribute('fill', state.zoomed ? 'rgba(192, 132, 252, 0.16)' : 'rgba(125, 211, 252, 0.14)');
}

function updateCursor() {
  if (vegaView) {
    updateVegaCursor();
    return;
  }

  const svg = visualization.querySelector('svg');
  if (!svg) return;

  const cursor = svg.querySelector('#viz-cursor');
  const x = state.vizXs[state.currentIndex];
  if (cursor && x !== undefined) {
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
  }

  svg.querySelectorAll('.viz-point').forEach((circle) => {
    circle.classList.toggle('current', Number(circle.dataset.index) === state.currentIndex);
  });
}

function indexFromClientX(clientX) {
  if (vegaView) {
    const canvas = vegaCanvasElement();
    if (!canvas || !vegaPointXs.length) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - vegaView.origin()[0];

    let best = null;
    let bestDistance = Infinity;
    vegaPointXs.forEach((candidate, index) => {
      if (candidate === null || candidate === undefined) return;
      const distance = Math.abs(candidate - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  const svg = visualization.querySelector('svg');
  if (!svg || !state.vizXs.length) return null;

  const rect = svg.getBoundingClientRect();
  if (!rect.width) return null;
  const x = ((clientX - rect.left) / rect.width) * 720;

  let best = 0;
  let bestDistance = Infinity;
  state.vizXs.forEach((candidate, index) => {
    const distance = Math.abs(candidate - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

function renderDataTable() {
  const rows = state.dataset.rows;
  const headers = state.dataset.fields.map((field) => `<th>${field.label}</th>`).join('');
  const body = rows.map((row) => {
    const cells = state.dataset.fields.map((field) => `<td>${row[field.key]}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  dataTable.innerHTML = `
    <div class="table-wrap compact-table">
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function renderExplanation() {
  const items = channelDefinitions
    .filter((channel) => state.mappings[channel.key])
    .map((channel) => {
      const field = getField(state.dataset, state.mappings[channel.key]);
      return `<li><strong>${channel.label}</strong> uses <span>${field?.label || state.mappings[channel.key]}</span>.</li>`;
    })
    .join('');

  explanation.innerHTML = `
    <p>This mapping is row-based: each data row becomes an audio event. The active fields are layered together rather than all using the same default note.</p>
    <ul>${items}</ul>
  `;
}

function renderSpecViewer() {
  specJson.textContent = specText();
}

function renderPointInspector() {
  const point = currentPoint();
  if (!point) {
    pointInspector.innerHTML = '<p class="description">No encoded points.</p>';
    pointPosition.textContent = '';
    return;
  }

  pointPosition.textContent = `${point.index + 1} of ${state.points.length} · ${point.position.label}`;
  prevPointButton.disabled = point.index === 0;
  nextPointButton.disabled = point.index === state.points.length - 1;

  const channelRows = Object.entries(point.explanation).map(([channel, detail]) => `
    <tr>
      <td>${channel}</td>
      <td>${detail.field}</td>
      <td>${detail.raw}</td>
      <td>${detail.scaled}</td>
    </tr>
  `).join('');

  pointInspector.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Channel</th><th>Field</th><th>Raw</th><th>Scaled</th></tr></thead>
        <tbody>${channelRows}</tbody>
      </table>
    </div>
  `;
}

function rowLabel(row) {
  const nominal = state.dataset.fields.find((field) => field.type === 'nominal');
  const temporal = state.dataset.fields.find((field) => field.type === 'temporal');
  return [nominal ? row[nominal.key] : null, temporal ? row[temporal.key] : null].filter(Boolean).join(' · ');
}

function playFromCurrent() {
  if (!state.points.length) return;
  stopSpeech();
  ensureAudioContext();

  const bounds = state.zoomed ? regionBounds() : null;
  const queue = compileAudioQueue(state.points, state.spec, {
    fromIndex: state.currentIndex,
    region: bounds,
    dilate: state.zoomed
  });

  playQueue(queue, {
    tempo: tempo(),
    onStep: (index) => {
      state.currentIndex = index;
      renderPointInspector();
      updateCursor();
    },
    onDone: () => announce('Finished.')
  });

  announce(bounds
    ? `Playing zoomed region from point ${state.currentIndex + 1}.`
    : `Playing from point ${state.currentIndex + 1} of ${state.points.length}.`);
}

init();
