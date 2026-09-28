import { datasets } from './src/data/datasets.js';
import { getField, extent, categoryIndex, numericValues } from './src/data/schema.js';
import { channelDefinitions } from './src/spec/channels.js';
import { presets } from './src/spec/defaultMappings.js';
import { buildSpec } from './src/spec/buildSpec.js';
import { SCALABLE_CHANNELS, defaultScale } from './src/spec/defaultScales.js';
import { RANGE_LIMITS, SCALE_TYPES, resolveDomain } from './src/transform/scales.js';
import { applyTransforms, FILTER_OPS, AGGREGATE_OPS } from './src/transform/transformData.js';
import { COMPOSITION_MODES, MODE_LABELS, MAX_OVERLAY_GROUPS, effectiveComposition, distinctGroups } from './src/compiler/composition.js';
import { validateSpec } from './src/spec/validateSpec.js';
import { compileEncodedPoints } from './src/compiler/compileEncodedPoints.js';
import { compileAudioQueue } from './src/compiler/compileAudioQueue.js';
import { compileLegendQueue } from './src/compiler/compileLegendQueue.js';
import { ensureAudioContext, playQueue, playEvents, renderPoint, renderComparison, stopAll } from './src/audio/player.js';
import { speak, speakAsync, stopSpeech } from './src/audio/speech.js';
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
  imported: null,
  scales: {},
  transforms: [],
  suggested: {},
  composition: { mode: 'sequence', field: null },
  resolved: { rows: datasets[0].rows, fields: datasets[0].fields, errors: [], steps: [] },
  activeMappings: {}
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
const scaleControls = document.getElementById('scale-controls');
const scaleMessage = document.getElementById('scale-message');
const resetScalesButton = document.getElementById('reset-scales');
const transformList = document.getElementById('transform-list');
const transformEmpty = document.getElementById('transform-empty');
const transformForm = document.getElementById('transform-form');
const transformType = document.getElementById('transform-type');
const transformFields = document.getElementById('transform-fields');
const transformMessage = document.getElementById('transform-message');
const clearTransformsButton = document.getElementById('clear-transforms');
const compositionMode = document.getElementById('composition-mode');
const compositionGroup = document.getElementById('composition-group');
const compositionDescription = document.getElementById('composition-description');
const compositionNote = document.getElementById('composition-note');

const dataTable = document.createElement('div');
dataTable.className = 'data-table-shell';

const explanation = document.createElement('div');
explanation.className = 'mapping-explanation';

let helpReturnFocus = null;
let legendToken = 0;

function init() {
  recompile();
  renderDatasetButtons();
  renderFieldMappingControls();
  insertAdditionalPanels();
  renderHelpTable();
  renderAll();

  resetScalesButton.addEventListener('click', resetScales);
  compositionMode.addEventListener('change', changeCompositionMode);
  compositionGroup.addEventListener('change', changeCompositionGroup);
  transformType.addEventListener('change', renderTransformFields);
  transformForm.addEventListener('submit', addTransform);
  clearTransformsButton.addEventListener('click', clearTransforms);
  playButton.addEventListener('click', playFromCurrent);
  stopButton.addEventListener('click', stopEverything);
  document.getElementById('legend-button').addEventListener('click', playLegend);

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
    onLegend: playLegend,
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
  const fieldKey = state.activeMappings.pitch;
  if (!fieldKey) return null;
  return { key: fieldKey, label: getField(state.resolved, fieldKey)?.label || fieldKey };
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
      const label = getField(state.resolved, detail.field)?.label || detail.field;
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
  legendToken += 1;
  stopAll();
  stopSpeech();
  announce('Stopped.');
}

async function playLegend() {
  if (!state.spec) return;
  stopAll();
  stopSpeech();
  ensureAudioContext();

  const token = ++legendToken;
  const queue = compileLegendQueue(state.spec, state.points);
  announce('Playing legend.');

  for (const item of queue) {
    if (token !== legendToken) return;
    if (item.kind === 'speech') {
      await speakAsync(item.text);
    } else if (item.kind === 'audio') {
      playEvents(item.events);
      await new Promise((resolve) => setTimeout(resolve, item.span * 1000 + 150));
    }
  }

  if (token === legendToken) announce('Legend finished.');
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
  state.scales = {};
  state.transforms = [];
  state.suggested = {};
  state.composition = { mode: 'sequence', field: null };
  state.currentIndex = 0;
  state.anchorIndex = null;
  state.region = null;
  state.zoomed = false;
  renderAll();
  announce(`Imported ${result.dataset.name}: ${result.dataset.rows.length} points. Suggested mappings applied. Focus the chart to explore.`);
}

// The group-by field only applies to grouped modes; overlay reads overlayBy,
// group and repeat read groupBy. Fields must still exist after transforms.
function compositionSpec() {
  const { mode, field } = state.composition;
  const usable = field && state.resolved.fields.some((candidate) => candidate.key === field) ? field : null;
  return {
    mode,
    groupBy: mode === 'group' || mode === 'repeat' ? usable : null,
    overlayBy: mode === 'overlay' ? usable : null
  };
}

// Mappings that are valid for the transformed fields. state.mappings keeps
// the user's intent, so a mapping to a field that a transform temporarily
// removes comes back when the transform is removed. While the user's field is
// missing, a suggested replacement (state.suggested) stands in; an explicit
// Off (null) is never overridden.
function activeMappingsFor(fields, suggested = state.suggested) {
  const active = {};
  const usable = (channel, key) => {
    const definition = channelDefinitions.find((candidate) => candidate.key === channel);
    const field = key && fields.find((candidate) => candidate.key === key);
    return Boolean(definition && field && definition.accepted.includes(field.type));
  };
  Object.entries(state.mappings).forEach(([channel, key]) => {
    if (usable(channel, key)) active[channel] = key;
    else if (key && usable(channel, suggested[channel])) active[channel] = suggested[channel];
  });
  return active;
}

function recompile() {
  state.resolved = applyTransforms(state.dataset.rows, state.transforms, state.dataset.fields);
  state.activeMappings = activeMappingsFor(state.resolved.fields);
  ensureCompositionField();
  state.spec = buildSpec(state.dataset, state.activeMappings, {
    tempo: tempo(),
    articulation: state.dataset.articulation,
    scales: state.scales,
    transforms: state.transforms,
    composition: compositionSpec()
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
      state.scales = {};
      state.transforms = [];
      state.suggested = {};
      state.composition = { mode: 'sequence', field: null };
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

    const options = state.resolved.fields
      .filter((field) => channel.accepted.includes(field.type))
      .map((field) => `<option value="${field.key}" ${state.activeMappings[channel.key] === field.key ? 'selected' : ''}>${field.label} (${field.type})</option>`)
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
      // A manual domain describes the old field's values, not the new one's.
      if (state.scales[channel.key]) delete state.scales[channel.key].domain;
      renderAll({ skipControls: true });
    });

    mappingOptions.appendChild(wrapper);
  });
}

const SCALE_TYPE_LABELS = { linear: 'Linear', sqrt: 'Square root', log: 'Logarithmic', symlog: 'Signed log' };
const RANGE_UNITS = { pitch: 'MIDI note', duration: 'seconds', volume: 'gain', pan: '-1 left, 1 right', rhythm: 'pulses' };
const RANGE_STEPS = { pitch: 1, duration: 0.01, volume: 0.01, pan: 0.05, rhythm: 1 };
const POLARITY_LABELS = {
  pitch: ['Higher value, higher pitch', 'Higher value, lower pitch'],
  duration: ['Higher value, longer tone', 'Higher value, shorter tone'],
  volume: ['Higher value, louder', 'Higher value, softer'],
  pan: ['Higher value, more right', 'Higher value, more left'],
  rhythm: ['Higher value, denser pulses', 'Higher value, sparser pulses'],
  status: ['Higher value, more tense', 'Higher value, more stable']
};

function effectiveScale(channel) {
  return { ...defaultScale(channel), ...(state.scales[channel] || {}) };
}

function patchScale(channel, patch) {
  state.scales[channel] = { ...(state.scales[channel] || {}), ...patch };
}

function scaledChannels() {
  return SCALABLE_CHANNELS.filter((channel) => {
    const key = state.activeMappings[channel];
    if (!key) return false;
    // Nominal pan spreads categories evenly; there is no numeric scale to shape.
    if (channel === 'pan') return getField(state.resolved, key)?.type === 'quantitative';
    return true;
  });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function numberOrNull(raw) {
  return raw === '' || raw === null || raw === undefined || !Number.isFinite(Number(raw)) ? null : Number(raw);
}

function renderScaleControls() {
  const channels = scaledChannels();

  if (!channels.length) {
    scaleControls.innerHTML = '<p class="description scale-empty">Map a numeric field to pitch, duration, volume, rhythm, pan, or status to shape its scale.</p>';
    return;
  }

  scaleControls.innerHTML = channels.map((channel) => {
    const definition = channelDefinitions.find((candidate) => candidate.key === channel);
    const field = getField(state.resolved, state.activeMappings[channel]);
    const scale = effectiveScale(channel);
    const [autoMin, autoMax] = resolveDomain('auto', numericValues(state.resolved.rows, field.key));
    const domain = Array.isArray(scale.domain) ? scale.domain : [null, null];
    const id = (name) => `scale-${channel}-${name}`;
    const [positiveLabel, negativeLabel] = POLARITY_LABELS[channel];

    const rangeRow = scale.range ? `
      <div class="scale-row">
        <span class="scale-row-label" id="${id('range-label')}">Range (${RANGE_UNITS[channel]})</span>
        <div class="scale-pair" role="group" aria-labelledby="${id('range-label')}">
          <input id="${id('range-low')}" type="number" data-channel="${channel}" data-role="range-low" aria-label="${definition.label} range low"
            min="${RANGE_LIMITS[channel][0]}" max="${RANGE_LIMITS[channel][1]}" step="${RANGE_STEPS[channel]}" value="${scale.range[0]}" />
          <span aria-hidden="true">to</span>
          <input id="${id('range-high')}" type="number" data-channel="${channel}" data-role="range-high" aria-label="${definition.label} range high"
            min="${RANGE_LIMITS[channel][0]}" max="${RANGE_LIMITS[channel][1]}" step="${RANGE_STEPS[channel]}" value="${scale.range[1]}" />
        </div>
      </div>` : '';

    return `
      <fieldset class="scale-card">
        <legend>${escapeHtml(definition.label)} <span>${escapeHtml(field.label)}</span></legend>
        <div class="scale-row">
          <label for="${id('polarity')}">Polarity</label>
          <select id="${id('polarity')}" data-channel="${channel}" data-role="polarity">
            <option value="positive" ${scale.polarity !== 'negative' ? 'selected' : ''}>${positiveLabel}</option>
            <option value="negative" ${scale.polarity === 'negative' ? 'selected' : ''}>${negativeLabel}</option>
          </select>
        </div>
        <div class="scale-row">
          <label for="${id('type')}">Scale type</label>
          <select id="${id('type')}" data-channel="${channel}" data-role="type">
            ${SCALE_TYPES.map((type) => `<option value="${type}" ${scale.scaleType === type ? 'selected' : ''}>${SCALE_TYPE_LABELS[type]}</option>`).join('')}
          </select>
        </div>
        ${rangeRow}
        <div class="scale-row">
          <span class="scale-row-label" id="${id('domain-label')}">Domain (data values)</span>
          <div class="scale-pair" role="group" aria-labelledby="${id('domain-label')}">
            <input id="${id('domain-min')}" type="number" step="any" data-channel="${channel}" data-role="domain-min" aria-label="${definition.label} domain minimum, auto is ${autoMin}"
              placeholder="auto ${autoMin}" value="${domain[0] ?? ''}" />
            <span aria-hidden="true">to</span>
            <input id="${id('domain-max')}" type="number" step="any" data-channel="${channel}" data-role="domain-max" aria-label="${definition.label} domain maximum, auto is ${autoMax}"
              placeholder="auto ${autoMax}" value="${domain[1] ?? ''}" />
          </div>
        </div>
      </fieldset>`;
  }).join('');

  scaleControls.querySelectorAll('select, input').forEach((control) => {
    control.addEventListener('change', () => handleScaleChange(control));
  });
}

function handleScaleChange(control) {
  const { channel, role } = control.dataset;
  const label = channelDefinitions.find((candidate) => candidate.key === channel).label;
  scaleMessage.textContent = '';
  let message = '';

  if (role === 'polarity') {
    patchScale(channel, { polarity: control.value });
    message = `${label} polarity: ${control.selectedOptions[0].textContent}.`;
  } else if (role === 'type') {
    patchScale(channel, { scaleType: control.value });
    message = `${label} scale type: ${SCALE_TYPE_LABELS[control.value]}.`;
  } else if (role === 'range-low' || role === 'range-high') {
    const which = role === 'range-low' ? 0 : 1;
    const limits = RANGE_LIMITS[channel];
    const range = [...effectiveScale(channel).range];
    const typed = numberOrNull(control.value);
    let value = typed ?? range[which];
    if (channel === 'pitch' || channel === 'rhythm') value = Math.round(value);
    value = Math.max(limits[0], Math.min(limits[1], value));
    range[which] = value;
    // Keep low <= high by moving the other bound rather than rejecting the edit.
    if (range[0] > range[1]) range[1 - which] = value;
    patchScale(channel, { range });
    // Write clamped values back in place; re-rendering here would steal focus.
    document.getElementById(`scale-${channel}-range-low`).value = range[0];
    document.getElementById(`scale-${channel}-range-high`).value = range[1];
    message = `${label} range ${range[0]} to ${range[1]} ${RANGE_UNITS[channel]}.`;
    if (value !== typed) message += ` Adjusted to stay within ${limits[0]} to ${limits[1]}.`;
  } else {
    const min = numberOrNull(document.getElementById(`scale-${channel}-domain-min`).value);
    const max = numberOrNull(document.getElementById(`scale-${channel}-domain-max`).value);
    if (min !== null && max !== null && min >= max) {
      // scaleMessage is a role="alert" region; it announces itself.
      scaleMessage.textContent = `${label} domain minimum must be below the maximum.`;
      return;
    }
    if (min === null && max === null) {
      const { domain, ...rest } = state.scales[channel] || {};
      state.scales[channel] = rest;
      message = `${label} domain: auto.`;
    } else {
      patchScale(channel, { domain: [min, max] });
      message = `${label} domain: ${min ?? 'auto'} to ${max ?? 'auto'}.`;
    }
  }

  applyScaleChange(message);
}

function applyScaleChange(message) {
  renderAll({ skipControls: true, skipScaleControls: true });
  announce(message);
  const point = currentPoint();
  if (point) renderPoint(point, { mode: 'scrub', tempo: tempo() });
}

function resetScales() {
  state.scales = {};
  scaleMessage.textContent = '';
  renderAll({ skipControls: true });
  announce('Scales reset to defaults.');
}

function fieldOptions(fields, predicate = () => true, selected = null) {
  return fields
    .filter(predicate)
    .map((field) => `<option value="${escapeHtml(field.key)}" ${field.key === selected ? 'selected' : ''}>${escapeHtml(field.label)} (${field.type})</option>`)
    .join('');
}

function renderTransformPanel() {
  const { steps } = state.resolved;
  transformList.innerHTML = '';
  state.transforms.forEach((transform, index) => {
    const step = steps[index];
    const item = document.createElement('li');
    if (step?.error) item.className = 'transform-error';
    const text = document.createElement('span');
    text.textContent = `${index + 1}. ${step?.description || transform.type}`;
    const status = document.createElement('span');
    status.className = 'transform-rows';
    status.textContent = step?.error ? 'skipped: invalid' : `${step?.rowCount ?? 0} rows`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary-button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove step ${index + 1}: ${step?.description || transform.type}`);
    remove.addEventListener('click', () => removeTransform(index));
    item.append(text, status, remove);
    transformList.appendChild(item);
  });
  transformEmpty.hidden = state.transforms.length > 0;
  clearTransformsButton.disabled = state.transforms.length === 0;
  renderTransformFields();
}

function renderTransformFields() {
  const fields = state.resolved.fields;
  const type = transformType.value;
  const numeric = (field) => field.type === 'quantitative';

  if (type === 'filter') {
    transformFields.innerHTML = `
      <div class="scale-row"><label for="tf-field">Field</label><select id="tf-field">${fieldOptions(fields)}</select></div>
      <div class="scale-row"><label for="tf-op">Condition</label>
        <select id="tf-op">${FILTER_OPS.map((op) => `<option value="${op}">${op === 'contains' ? 'contains' : op}</option>`).join('')}</select></div>
      <div class="scale-row"><label for="tf-value">Value</label><input id="tf-value" type="text" autocomplete="off" /></div>`;
  } else if (type === 'sort') {
    transformFields.innerHTML = `
      <div class="scale-row"><label for="tf-field">Field</label><select id="tf-field">${fieldOptions(fields)}</select></div>
      <div class="scale-row"><label for="tf-order">Order</label>
        <select id="tf-order"><option value="ascending">Ascending</option><option value="descending">Descending</option></select></div>`;
  } else if (type === 'aggregate') {
    const checks = fields
      .map((field) => `<label><input type="checkbox" name="tf-group" value="${escapeHtml(field.key)}" /> ${escapeHtml(field.label)}</label>`)
      .join('');
    transformFields.innerHTML = `
      <fieldset class="transform-checks"><legend>Group by</legend>${checks || '<span class="scale-empty">No groupable fields</span>'}</fieldset>
      <div class="scale-row"><label for="tf-agg-op">Summarize with</label>
        <select id="tf-agg-op">${AGGREGATE_OPS.map((op) => `<option value="${op}">${op}</option>`).join('')}</select></div>
      <div class="scale-row"><label for="tf-agg-field">Of field</label><select id="tf-agg-field">${fieldOptions(fields, numeric)}</select></div>`;
    const op = document.getElementById('tf-agg-op');
    const measure = document.getElementById('tf-agg-field');
    const sync = () => { measure.disabled = op.value === 'count'; };
    op.addEventListener('change', sync);
    sync();
  } else {
    transformFields.innerHTML = `
      <div class="scale-row"><label for="tf-field">Field</label><select id="tf-field">${fieldOptions(fields, numeric)}</select></div>
      <div class="scale-row"><label for="tf-bins">Approximate number of bins</label><input id="tf-bins" type="number" min="2" max="50" step="1" value="8" /></div>
      <div class="scale-row"><label for="tf-step">Or exact bin width (optional)</label><input id="tf-step" type="number" min="0" step="any" placeholder="auto" /></div>`;
  }
}

function uniqueFieldKey(base) {
  const taken = new Set(state.resolved.fields.map((field) => field.key));
  let key = base;
  let suffix = 2;
  while (taken.has(key)) key = `${base}_${suffix++}`;
  return key;
}

function readTransformForm() {
  const type = transformType.value;
  const value = (id) => document.getElementById(id)?.value;

  if (type === 'filter') {
    const field = state.resolved.fields.find((candidate) => candidate.key === value('tf-field'));
    const raw = value('tf-value').trim();
    const asNumber = raw !== '' && Number.isFinite(Number(raw)) && field?.type !== 'nominal';
    return { type, field: field?.key, op: value('tf-op'), value: asNumber ? Number(raw) : raw };
  }
  if (type === 'sort') return { type, field: value('tf-field'), order: value('tf-order') };
  if (type === 'aggregate') {
    const groupBy = [...transformForm.querySelectorAll('input[name="tf-group"]:checked')].map((box) => box.value);
    const op = value('tf-agg-op');
    const field = value('tf-agg-field');
    const as = uniqueFieldKey(op === 'count' ? 'count' : `${op}_${field}`);
    return { type, groupBy, fields: [op === 'count' ? { op, as } : { field, op, as }] };
  }
  const field = value('tf-field');
  const step = Number(value('tf-step'));
  const bin = { type, field, as: uniqueFieldKey(`bin_${field}`) };
  if (step > 0) bin.step = step;
  else bin.maxbins = Math.max(2, Math.min(50, Math.round(Number(value('tf-bins')) || 8)));
  return bin;
}

// transformMessage is a role="alert" region; it announces itself.
function transformFail(message) {
  transformMessage.textContent = message;
}

// After an aggregate, time and pitch usually lose their fields. Point them at
// the new grouping and measure so the sonification stays audible.
function suggestMappingsAfter(transform, previouslyActive) {
  if (transform.type !== 'aggregate') return [];
  const fields = applyTransforms(state.dataset.rows, [...state.transforms, transform], state.dataset.fields).fields;
  const active = activeMappingsFor(fields, {});
  const suggested = [];
  const groupField = transform.groupBy[0];
  const measure = transform.fields[0].as;
  // Only repair channels the user had in use; never turn on ones they left Off.
  if (!active.time && previouslyActive.includes('time') && groupField) { state.suggested.time = groupField; suggested.push('time'); }
  if (!active.pitch && previouslyActive.includes('pitch')) { state.suggested.pitch = measure; suggested.push('pitch'); }
  return suggested;
}

function addTransform(event) {
  event.preventDefault();
  transformMessage.textContent = '';
  const transform = readTransformForm();

  const candidate = applyTransforms(state.dataset.rows, [...state.transforms, transform], state.dataset.fields);
  const error = candidate.errors[candidate.errors.length - 1];
  if (error) return transformFail(error);
  if (candidate.rows.length === 0) return transformFail('That transform would leave no rows, so it was not added.');

  const before = Object.keys(activeMappingsFor(state.resolved.fields));
  const suggested = suggestMappingsAfter(transform, before);
  state.transforms.push(transform);
  resetPosition();
  renderAll();

  const dropped = before.filter((channel) => !state.activeMappings[channel]);
  const notes = [];
  if (suggested.length) notes.push(`Mapped ${suggested.join(' and ')} to the new fields.`);
  const stillDropped = dropped.filter((channel) => !suggested.includes(channel));
  if (stillDropped.length) notes.push(`Unmapped ${stillDropped.join(', ')} because those fields no longer exist; they return if you remove this step, or choose new fields above.`);
  announce(`Added ${state.resolved.steps[state.transforms.length - 1].description}. ${state.resolved.rows.length} rows. ${notes.join(' ')}`.trim());
}

function removeTransform(index) {
  transformMessage.textContent = '';
  state.transforms.splice(index, 1);
  resetPosition();
  renderAll();
  announce(`Removed step ${index + 1}. ${state.resolved.rows.length} rows.`);
  transformType.focus();
}

function clearTransforms() {
  if (!state.transforms.length) return;
  transformMessage.textContent = '';
  state.transforms = [];
  resetPosition();
  renderAll();
  announce(`Transforms cleared. ${state.resolved.rows.length} rows.`);
}

// Row indexes mean something different after the transformed data changes.
function resetPosition() {
  stopAll();
  state.currentIndex = 0;
  state.anchorIndex = null;
  state.region = null;
  state.zoomed = false;
}

const MODE_DESCRIPTIONS = {
  sequence: 'Rows play one after another in the order shown in the data preview.',
  group: 'All rows of one group play, a short pause, then the next group. Scrubbing walks group by group.',
  repeat: 'Each group\'s name is spoken, then its rows play, so you always know which group you are hearing.',
  overlay: `Groups play together, one time step at a time. Limited to ${MAX_OVERLAY_GROUPS} groups and simplified to each voice's main tone so the mix stays clear; timbre and pan keep groups apart.`
};

function groupableFields() {
  return state.resolved.fields.filter((field) => field.type === 'nominal');
}

// Keep the group-by field usable after transforms or a mode switch: prefer
// the timbre field, then the first category field.
function ensureCompositionField() {
  const fields = groupableFields();
  if (state.composition.mode === 'sequence' || fields.some((field) => field.key === state.composition.field)) return;
  const timbre = state.activeMappings.timbre;
  state.composition.field = (fields.find((field) => field.key === timbre) || fields[0])?.key || null;
}

function renderComposition() {
  const fields = groupableFields();
  const { mode } = state.composition;

  compositionMode.innerHTML = COMPOSITION_MODES
    .map((candidate) => `<option value="${candidate}" ${candidate === mode ? 'selected' : ''}>${MODE_LABELS[candidate]}</option>`)
    .join('');
  compositionGroup.innerHTML = fields.length
    ? fields.map((field) => `<option value="${escapeHtml(field.key)}" ${field.key === state.composition.field ? 'selected' : ''}>${escapeHtml(field.label)}</option>`).join('')
    : '<option value="">No category fields</option>';
  compositionGroup.disabled = mode === 'sequence' || !fields.length;
  compositionDescription.textContent = MODE_DESCRIPTIONS[mode];
  compositionNote.classList.add('composition-note');
  compositionNote.textContent = compositionFallbackNote();
}

// Why playback differs from the chosen mode (no group field, too many groups
// for an overlay), so the fallback is never a silent surprise.
function compositionFallbackNote() {
  const spec = compositionSpec();
  if (spec.mode === 'sequence') return '';
  const field = spec.groupBy || spec.overlayBy;
  const groupCount = field ? new Set(state.resolved.rows.map((row) => String(row[field]))).size : 0;
  return effectiveComposition(spec, groupCount, Boolean(field)).note || '';
}

function changeCompositionMode() {
  state.composition.mode = compositionMode.value;
  applyCompositionChange(`Playback mode: ${MODE_LABELS[state.composition.mode]}.`);
}

function changeCompositionGroup() {
  state.composition.field = compositionGroup.value || null;
  const label = state.resolved.fields.find((field) => field.key === state.composition.field)?.label;
  applyCompositionChange(`Grouping by ${label}.`);
}

function applyCompositionChange(message) {
  resetPosition();
  renderAll({ skipControls: true, skipScaleControls: true });
  const note = compositionNote.textContent;
  announce(`${message} ${state.points.length} points.${note ? ` ${note}` : ''}`);
}

function renderAll(options = {}) {
  recompile();

  if (!options.skipControls) {
    renderDatasetButtons();
    renderFieldMappingControls();
  }
  if (!options.skipScaleControls) renderScaleControls();
  if (!options.skipControls) renderTransformPanel();
  renderComposition();

  const transformed = state.transforms.length > 0;
  chartType.textContent = `${state.resolved.rows.length} rows · ${state.resolved.fields.length} fields${transformed ? ` (from ${state.dataset.rows.length} rows)` : ''}`;
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

  const pitchField = state.activeMappings.pitch || state.resolved.fields.find((field) => field.type === 'quantitative')?.key;
  const colorField = state.activeMappings.timbre || state.activeMappings.chord || state.activeMappings.motif;
  const timeField = state.activeMappings.time;
  const [min, max] = extent(state.resolved.rows, pitchField);

  const width = 720;
  const height = 260;
  const pad = 26;

  // Overlay aligns groups on shared time steps; every other mode lays points
  // out in playback order.
  const overlayView = activeCompositionMode() === 'overlay';
  const points = state.points.map((point, index) => {
    const unit = overlayView
      ? point.position.slot / Math.max(1, point.position.slotCount - 1)
      : index / Math.max(1, state.points.length - 1);
    const x = pad + unit * (width - pad * 2);
    const value = Number(point.row[pitchField]);
    const y = height - pad - ((value - min) / Math.max(1, max - min)) * (height - pad * 2);
    return { x, y, row: point.row, group: point.position.group };
  });

  state.vizXs = points.map((point) => point.x);

  const circles = points.map(({ x, y, row }, index) => {
    const category = colorField ? row[colorField] : '';
    const hue = colorField ? (categoryIndex(state.resolved.rows, colorField, category) * 72) % 360 : 195;
    return `<circle class="viz-point" data-index="${index}" cx="${x}" cy="${y}" r="8" fill="hsl(${hue}, 82%, 68%)"><title>${rowLabel(row)} · ${pitchField}: ${row[pitchField]}</title></circle>`;
  }).join('');

  // One line per group so grouped playback does not draw a line between groups.
  const runs = [];
  points.forEach((point) => {
    const last = runs[runs.length - 1];
    if (last && last.group === point.group) last.points.push(point);
    else runs.push({ group: point.group, points: [point] });
  });
  const lines = runs
    .map((run) => `<polyline points="${run.points.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />`)
    .join('');
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
      ${lines}
      <line id="viz-cursor" class="viz-cursor" x1="0" y1="${pad}" x2="0" y2="${height - pad}" stroke="#f8fafc" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.9" />
      ${circles}
      ${labels}
      <text x="${pad}" y="16" fill="#7dd3fc" font-size="12">pitch: ${getField(state.resolved, pitchField)?.label || 'none'}</text>
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
  const rows = state.resolved.rows;
  const headers = state.resolved.fields.map((field) => `<th>${field.label}</th>`).join('');
  const body = rows.map((row) => {
    const cells = state.resolved.fields.map((field) => `<td>${row[field.key] ?? ''}</td>`).join('');
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
    .filter((channel) => state.activeMappings[channel.key])
    .map((channel) => {
      const field = getField(state.resolved, state.activeMappings[channel.key]);
      return `<li><strong>${channel.label}</strong> uses <span>${field?.label || state.activeMappings[channel.key]}</span>.</li>`;
    })
    .join('');

  const mode = activeCompositionMode();
  const modeLine = mode === 'sequence' ? '' : `<p><strong>Playback:</strong> ${MODE_LABELS[mode]}, grouped by ${escapeHtml(getField(state.resolved, state.spec.composition.groupBy || state.spec.composition.overlayBy)?.label || '')}.</p>`;

  explanation.innerHTML = `
    <p>This mapping is row-based: each data row becomes an audio event. The active fields are layered together rather than all using the same default note.</p>
    <ul>${items}</ul>
    ${modeLine}
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
  const nominal = state.resolved.fields.find((field) => field.type === 'nominal');
  const temporal = state.resolved.fields.find((field) => field.type === 'temporal');
  return [nominal ? row[nominal.key] : null, temporal ? row[temporal.key] : null].filter(Boolean).join(' · ');
}

// What playback will do given the compiled points, after fallbacks.
function activeCompositionMode() {
  const groups = distinctGroups(state.points);
  const grouped = groups.length > 0 && state.points.every((point) => point.position.group !== undefined);
  return grouped ? effectiveComposition(state.spec.composition, groups.length, true).mode : 'sequence';
}

function playFromCurrent() {
  if (!state.points.length) return;
  stopSpeech();
  ensureAudioContext();

  const bounds = state.zoomed ? regionBounds() : null;
  const queue = compileAudioQueue(state.points, state.spec, {
    fromIndex: state.currentIndex,
    region: bounds,
    dilate: state.zoomed,
    tempo: tempo()
  });

  playQueue(queue, {
    tempo: tempo(),
    onStep: (index) => {
      state.currentIndex = index;
      renderPointInspector();
      updateCursor();
    },
    // Group names are spoken (not announced via aria-live) so they line up
    // with the audio instead of queueing behind screen-reader output.
    onSpeech: (text) => speak(text, { interrupt: false }),
    onDone: () => announce('Finished.')
  });

  announce(bounds
    ? `Playing zoomed region from point ${state.currentIndex + 1}.`
    : `Playing from point ${state.currentIndex + 1} of ${state.points.length}.`);
}

init();
