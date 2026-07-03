import { datasets } from './src/data/datasets.js';
import { getField, extent, categoryIndex } from './src/data/schema.js';
import { channelDefinitions } from './src/spec/channels.js';
import { presets } from './src/spec/defaultMappings.js';
import { buildSpec } from './src/spec/buildSpec.js';
import { validateSpec } from './src/spec/validateSpec.js';
import { compileEncodedPoints } from './src/compiler/compileEncodedPoints.js';
import { ensureAudioContext, now, schedulePoint, stopAll } from './src/audio/player.js';

const state = {
  dataset: datasets[0],
  mappings: { ...presets[datasets[0].id] },
  spec: null,
  points: [],
  currentIndex: 0
};

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

const dataTable = document.createElement('div');
dataTable.className = 'data-table-shell';

const explanation = document.createElement('div');
explanation.className = 'mapping-explanation';

function init() {
  renderDatasetButtons();
  renderFieldMappingControls();
  insertAdditionalPanels();
  renderAll();

  playButton.addEventListener('click', () => {
    stopAll();
    ensureAudioContext();
    playCombinedMapping();
  });

  stopButton.addEventListener('click', stopAll);

  tempoSlider.addEventListener('input', () => {
    tempoValue.textContent = `${Number(tempoSlider.value).toFixed(1)}x`;
  });

  prevPointButton.addEventListener('click', () => moveToIndex(state.currentIndex - 1));
  nextPointButton.addEventListener('click', () => moveToIndex(state.currentIndex + 1));
  hearPointButton.addEventListener('click', () => {
    const point = state.points[state.currentIndex];
    if (!point) return;
    stopAll();
    ensureAudioContext();
    schedulePoint(point, { start: now() + 0.05, tempo: Number(tempoSlider.value) });
  });

  copySpecButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(specText());
      copySpecButton.textContent = 'Copied!';
      setTimeout(() => { copySpecButton.textContent = 'Copy JSON'; }, 1200);
    } catch (error) {
      copySpecButton.textContent = 'Copy failed';
      setTimeout(() => { copySpecButton.textContent = 'Copy JSON'; }, 1200);
    }
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
}

function specText() {
  // data.values is bulky in the viewer but essential for a shareable spec.
  return JSON.stringify(state.spec, null, 2);
}

function moveToIndex(index) {
  const clamped = Math.max(0, Math.min(state.points.length - 1, index));
  if (clamped === state.currentIndex) return;
  state.currentIndex = clamped;
  renderPointInspector();
}

function recompile() {
  state.spec = buildSpec(state.dataset, state.mappings, { tempo: Number(tempoSlider.value) });
  const validation = validateSpec(state.spec);
  if (!validation.valid) {
    console.warn('Sonify spec validation errors:', validation.errors);
  }
  state.points = compileEncodedPoints(state.spec);
  state.currentIndex = Math.max(0, Math.min(state.points.length - 1, state.currentIndex));
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

  datasets.forEach((dataset) => {
    const button = document.createElement('button');
    button.className = `option-button ${dataset.id === state.dataset.id ? 'active' : ''}`;
    button.setAttribute('aria-pressed', String(dataset.id === state.dataset.id));
    button.innerHTML = `<strong>${dataset.name}</strong><span>${dataset.description}</span>`;
    button.addEventListener('click', () => {
      state.dataset = dataset;
      state.mappings = { ...presets[dataset.id] };
      state.currentIndex = 0;
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
}

function renderVisualization() {
  visualization.innerHTML = '';
  visualization.className = 'viz grammar-viz';

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

  const circles = points.map(({ x, y, row }) => {
    const category = colorField ? row[colorField] : '';
    const hue = colorField ? (categoryIndex(state.dataset.rows, colorField, category) * 72) % 360 : 195;
    return `<circle cx="${x}" cy="${y}" r="8" fill="hsl(${hue}, 82%, 68%)"><title>${rowLabel(row)} · ${pitchField}: ${row[pitchField]}</title></circle>`;
  }).join('');

  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const labels = points.map(({ x, row }, index) => {
    if (index % 2 === 1 && points.length > 8) return '';
    const text = timeField ? row[timeField] : index + 1;
    return `<text x="${x}" y="${height - 4}" text-anchor="middle" fill="#a7b0be" font-size="11">${text}</text>`;
  }).join('');

  visualization.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Visual preview using selected pitch and sequence fields">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#2f3a4a" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#2f3a4a" />
      <polyline points="${line}" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
      ${circles}
      ${labels}
      <text x="${pad}" y="16" fill="#7dd3fc" font-size="12">pitch: ${getField(state.dataset, pitchField)?.label || 'none'}</text>
    </svg>
  `;
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
  const point = state.points[state.currentIndex];
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

function playCombinedMapping() {
  const tempo = Number(tempoSlider.value);
  const step = 0.72 / tempo;
  const startBase = now() + 0.08;

  state.points.forEach((point, index) => {
    schedulePoint(point, { start: startBase + index * step, tempo });
  });
}

init();
