import { datasets } from './src/data/datasets.js';
import { getField, extent, uniqueValues, categoryIndex } from './src/data/schema.js';
import { channelDefinitions } from './src/spec/channels.js';
import { presets } from './src/spec/defaultMappings.js';
import { midiToFrequency, normalize, pentatonicMidi } from './src/transform/scales.js';
import { orderRows } from './src/transform/transformData.js';
import { WAVEFORMS, CHORD_BANK, MOTIF_BANK, statusStateFor } from './src/audio/instruments.js';
import { ensureAudioContext, now, playTone, stopAll } from './src/audio/player.js';

let selectedDataset = datasets[0];
let fieldMappings = { ...presets[selectedDataset.id] };

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
    button.className = `option-button ${dataset.id === selectedDataset.id ? 'active' : ''}`;
    button.innerHTML = `<strong>${dataset.name}</strong><span>${dataset.description}</span>`;
    button.addEventListener('click', () => {
      selectedDataset = dataset;
      fieldMappings = { ...presets[dataset.id] };
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

    const options = selectedDataset.fields
      .filter((field) => channel.accepted.includes(field.type))
      .map((field) => `<option value="${field.key}" ${fieldMappings[channel.key] === field.key ? 'selected' : ''}>${field.label} (${field.type})</option>`)
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
      fieldMappings[channel.key] = event.target.value === 'none' ? null : event.target.value;
      renderAll({ skipControls: true });
    });

    mappingOptions.appendChild(wrapper);
  });
}

function renderAll(options = {}) {
  if (!options.skipControls) {
    renderDatasetButtons();
    renderFieldMappingControls();
  }

  chartType.textContent = `${selectedDataset.rows.length} rows · ${selectedDataset.fields.length} fields`;
  mappingFit.textContent = 'Custom grammar';
  mappingDescription.textContent = 'Each row is rendered as a small audio event. Your field mappings determine the pitch, rhythm, duration, chord, motif, pan, volume, timbre, and state-harmony cues. This is intentionally a grammar playground, not a finished chart recommendation.';

  renderVisualization();
  renderDataTable();
  renderExplanation();
}

function normalizeField(value, fieldKey) {
  return normalize(value, extent(selectedDataset.rows, fieldKey));
}

function fieldCategoryIndex(value, fieldKey) {
  return categoryIndex(selectedDataset.rows, fieldKey, value);
}

function renderVisualization() {
  visualization.innerHTML = '';
  visualization.className = 'viz grammar-viz';

  const pitchField = fieldMappings.pitch || selectedDataset.fields.find((field) => field.type === 'quantitative')?.key;
  const colorField = fieldMappings.timbre || fieldMappings.chord || fieldMappings.motif;
  const timeField = fieldMappings.time;
  const rows = orderRows(selectedDataset.rows, fieldMappings.time);
  const [min, max] = extent(selectedDataset.rows, pitchField);

  const width = 720;
  const height = 260;
  const pad = 26;

  const points = rows.map((row, index) => {
    const x = pad + (index / Math.max(1, rows.length - 1)) * (width - pad * 2);
    const value = Number(row[pitchField]);
    const y = height - pad - ((value - min) / Math.max(1, max - min)) * (height - pad * 2);
    return { x, y, row };
  });

  const circles = points.map(({ x, y, row }) => {
    const category = colorField ? row[colorField] : '';
    const hue = colorField ? (fieldCategoryIndex(category, colorField) * 72) % 360 : 195;
    return `<circle cx="${x}" cy="${y}" r="8" fill="hsl(${hue}, 82%, 68%)"><title>${rowLabel(row)} · ${pitchField}: ${row[pitchField]}</title></circle>`;
  }).join('');

  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const labels = points.map(({ x, row }, index) => {
    if (index % 2 === 1 && rows.length > 8) return '';
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
      <text x="${pad}" y="16" fill="#7dd3fc" font-size="12">pitch: ${getField(selectedDataset, pitchField)?.label || 'none'}</text>
    </svg>
  `;
}

function renderDataTable() {
  const rows = selectedDataset.rows;
  const headers = selectedDataset.fields.map((field) => `<th>${field.label}</th>`).join('');
  const body = rows.map((row) => {
    const cells = selectedDataset.fields.map((field) => `<td>${row[field.key]}</td>`).join('');
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
    .filter((channel) => fieldMappings[channel.key])
    .map((channel) => {
      const field = getField(selectedDataset, fieldMappings[channel.key]);
      return `<li><strong>${channel.label}</strong> uses <span>${field?.label || fieldMappings[channel.key]}</span>.</li>`;
    })
    .join('');

  explanation.innerHTML = `
    <p>This mapping is row-based: each data row becomes an audio event. The active fields are layered together rather than all using the same default note.</p>
    <ul>${items}</ul>
  `;
}

function rowLabel(row) {
  const nominal = selectedDataset.fields.find((field) => field.type === 'nominal');
  const temporal = selectedDataset.fields.find((field) => field.type === 'temporal');
  return [nominal ? row[nominal.key] : null, temporal ? row[temporal.key] : null].filter(Boolean).join(' · ');
}

// --- Mapping -> audio-event math. Formalized into src/compiler/ in Phase 2. ---

function fieldFrequency(row) {
  const field = fieldMappings.pitch;
  if (!field) return midiToFrequency(60);
  return midiToFrequency(pentatonicMidi(normalizeField(row[field], field)));
}

function fieldDuration(row, tempo) {
  const field = fieldMappings.duration;
  if (!field) return 0.28 / tempo;
  return (0.16 + normalizeField(row[field], field) * 0.48) / tempo;
}

function fieldVolume(row) {
  const field = fieldMappings.volume;
  if (!field) return 0.13;
  return 0.06 + normalizeField(row[field], field) * 0.12;
}

function fieldPan(row) {
  const field = fieldMappings.pan;
  if (!field) return 0;
  const fieldDef = getField(selectedDataset, field);
  if (fieldDef?.type === 'quantitative') return -0.75 + normalizeField(row[field], field) * 1.5;
  const values = uniqueValues(selectedDataset.rows, field);
  if (values.length <= 1) return 0;
  return -0.75 + (fieldCategoryIndex(row[field], field) / (values.length - 1)) * 1.5;
}

function fieldWaveform(row) {
  const field = fieldMappings.timbre;
  if (!field) return 'sine';
  return WAVEFORMS[fieldCategoryIndex(row[field], field) % WAVEFORMS.length];
}

function playChordForRow(row, start, tempo, pan) {
  const field = fieldMappings.chord;
  if (!field) return;

  const chord = CHORD_BANK[fieldCategoryIndex(row[field], field) % CHORD_BANK.length];
  chord.forEach((midi) => playTone(midiToFrequency(midi), start, 0.26 / tempo, 'sine', 0.035, pan));
}

function playMotifForRow(row, start, tempo, pan) {
  const field = fieldMappings.motif;
  if (!field) return 0;

  const motif = MOTIF_BANK[fieldCategoryIndex(row[field], field) % MOTIF_BANK.length];
  motif.forEach((midi, index) => {
    playTone(midiToFrequency(midi), start + index * (0.08 / tempo), 0.055 / tempo, 'triangle', 0.055, pan);
  });

  return 0.28 / tempo;
}

function playRhythmForRow(row, start, tempo, baseFreq, pan) {
  const field = fieldMappings.rhythm;
  if (!field) return;

  const pulses = 1 + Math.round(normalizeField(row[field], field) * 6);
  for (let i = 0; i < pulses; i += 1) {
    playTone(baseFreq * 2, start + i * (0.055 / tempo), 0.028 / tempo, 'square', 0.025, pan);
  }
}

function playStatusForRow(row, start, tempo, pan) {
  const field = fieldMappings.status;
  if (!field) return;

  const state = statusStateFor(normalizeField(row[field], field));
  state.chord.forEach((midi) => playTone(midiToFrequency(midi), start, 0.42 / tempo, state.wave, state.volume, pan));
}

function playCombinedMapping() {
  const tempo = Number(tempoSlider.value);
  const rows = orderRows(selectedDataset.rows, fieldMappings.time);
  const step = 0.72 / tempo;
  const startBase = now() + 0.08;

  rows.forEach((row, index) => {
    const eventStart = startBase + index * step;
    const pan = fieldPan(row);
    const motifOffset = playMotifForRow(row, eventStart, tempo, pan);
    const mainStart = eventStart + motifOffset;
    const freq = fieldFrequency(row);
    const duration = fieldDuration(row, tempo);
    const volume = fieldVolume(row);
    const wave = fieldWaveform(row);

    playChordForRow(row, mainStart, tempo, pan);
    playStatusForRow(row, mainStart, tempo, pan);
    playRhythmForRow(row, mainStart, tempo, freq, pan);
    playTone(freq, mainStart + 0.06 / tempo, duration, wave, volume, pan);
  });
}

init();
