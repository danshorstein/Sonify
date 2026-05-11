const datasets = [
  {
    id: 'agency-spending',
    name: 'Federal agency spending by fiscal year',
    description: 'A richer public-finance style dataset with time, agency, mission category, spending, growth, risk, confidence, and transaction volume.',
    fields: [
      { key: 'fiscalYear', label: 'Fiscal Year', type: 'temporal' },
      { key: 'agency', label: 'Agency', type: 'nominal' },
      { key: 'mission', label: 'Mission', type: 'nominal' },
      { key: 'spendBillions', label: 'Spend ($B)', type: 'quantitative' },
      { key: 'growthPct', label: 'YoY Growth %', type: 'quantitative' },
      { key: 'riskScore', label: 'Risk Score', type: 'quantitative' },
      { key: 'confidence', label: 'Confidence %', type: 'quantitative' },
      { key: 'transactionsK', label: 'Transactions (K)', type: 'quantitative' }
    ],
    rows: [
      { fiscalYear: 2021, agency: 'Defense', mission: 'Security', spendBillions: 705, growthPct: 2.9, riskScore: 61, confidence: 84, transactionsK: 980 },
      { fiscalYear: 2021, agency: 'Health', mission: 'Care', spendBillions: 1310, growthPct: 8.7, riskScore: 74, confidence: 76, transactionsK: 1220 },
      { fiscalYear: 2021, agency: 'Education', mission: 'Learning', spendBillions: 182, growthPct: 5.1, riskScore: 42, confidence: 88, transactionsK: 410 },
      { fiscalYear: 2021, agency: 'Energy', mission: 'Infrastructure', spendBillions: 49, growthPct: 3.3, riskScore: 37, confidence: 91, transactionsK: 170 },
      { fiscalYear: 2022, agency: 'Defense', mission: 'Security', spendBillions: 742, growthPct: 5.2, riskScore: 64, confidence: 82, transactionsK: 1010 },
      { fiscalYear: 2022, agency: 'Health', mission: 'Care', spendBillions: 1398, growthPct: 6.7, riskScore: 78, confidence: 73, transactionsK: 1285 },
      { fiscalYear: 2022, agency: 'Education', mission: 'Learning', spendBillions: 205, growthPct: 12.6, riskScore: 48, confidence: 85, transactionsK: 450 },
      { fiscalYear: 2022, agency: 'Energy', mission: 'Infrastructure', spendBillions: 57, growthPct: 16.3, riskScore: 44, confidence: 79, transactionsK: 185 },
      { fiscalYear: 2023, agency: 'Defense', mission: 'Security', spendBillions: 781, growthPct: 5.3, riskScore: 66, confidence: 81, transactionsK: 1045 },
      { fiscalYear: 2023, agency: 'Health', mission: 'Care', spendBillions: 1512, growthPct: 8.2, riskScore: 83, confidence: 69, transactionsK: 1375 },
      { fiscalYear: 2023, agency: 'Education', mission: 'Learning', spendBillions: 198, growthPct: -3.4, riskScore: 39, confidence: 90, transactionsK: 430 },
      { fiscalYear: 2023, agency: 'Energy', mission: 'Infrastructure', spendBillions: 69, growthPct: 21.1, riskScore: 52, confidence: 72, transactionsK: 210 }
    ]
  },
  {
    id: 'ai-monitoring',
    name: 'AI model monitoring runs',
    description: 'A model observability dataset: run order, model, task family, accuracy, hallucination risk, latency, cost, confidence, and volume.',
    fields: [
      { key: 'run', label: 'Run', type: 'temporal' },
      { key: 'model', label: 'Model', type: 'nominal' },
      { key: 'task', label: 'Task', type: 'nominal' },
      { key: 'accuracy', label: 'Accuracy %', type: 'quantitative' },
      { key: 'hallucinationRisk', label: 'Hallucination Risk', type: 'quantitative' },
      { key: 'latencyMs', label: 'Latency ms', type: 'quantitative' },
      { key: 'costUsd', label: 'Cost $', type: 'quantitative' },
      { key: 'confidence', label: 'Confidence %', type: 'quantitative' },
      { key: 'volume', label: 'Volume', type: 'quantitative' }
    ],
    rows: [
      { run: 1, model: 'Orion', task: 'Extract', accuracy: 86, hallucinationRisk: 28, latencyMs: 880, costUsd: 12, confidence: 81, volume: 130 },
      { run: 2, model: 'Orion', task: 'Reason', accuracy: 82, hallucinationRisk: 41, latencyMs: 1240, costUsd: 18, confidence: 74, volume: 118 },
      { run: 3, model: 'Nova', task: 'Extract', accuracy: 91, hallucinationRisk: 19, latencyMs: 710, costUsd: 9, confidence: 88, volume: 145 },
      { run: 4, model: 'Nova', task: 'Reason', accuracy: 87, hallucinationRisk: 33, latencyMs: 980, costUsd: 14, confidence: 80, volume: 136 },
      { run: 5, model: 'Lyra', task: 'Extract', accuracy: 79, hallucinationRisk: 52, latencyMs: 650, costUsd: 7, confidence: 68, volume: 160 },
      { run: 6, model: 'Lyra', task: 'Reason', accuracy: 74, hallucinationRisk: 63, latencyMs: 820, costUsd: 10, confidence: 59, volume: 152 },
      { run: 7, model: 'Orion', task: 'Classify', accuracy: 89, hallucinationRisk: 23, latencyMs: 930, costUsd: 11, confidence: 84, volume: 141 },
      { run: 8, model: 'Nova', task: 'Classify', accuracy: 94, hallucinationRisk: 15, latencyMs: 760, costUsd: 10, confidence: 91, volume: 148 }
    ]
  },
  {
    id: 'startup-metrics',
    name: 'Startup operating metrics',
    description: 'A SaaS-style dataset with month, product line, revenue, churn, support load, NPS, risk, and confidence.',
    fields: [
      { key: 'month', label: 'Month', type: 'temporal' },
      { key: 'product', label: 'Product', type: 'nominal' },
      { key: 'market', label: 'Market', type: 'nominal' },
      { key: 'mrr', label: 'MRR ($K)', type: 'quantitative' },
      { key: 'churnPct', label: 'Churn %', type: 'quantitative' },
      { key: 'supportTickets', label: 'Support Tickets', type: 'quantitative' },
      { key: 'nps', label: 'NPS', type: 'quantitative' },
      { key: 'riskScore', label: 'Risk Score', type: 'quantitative' },
      { key: 'confidence', label: 'Confidence %', type: 'quantitative' }
    ],
    rows: [
      { month: 1, product: 'Core', market: 'Enterprise', mrr: 112, churnPct: 3.2, supportTickets: 84, nps: 51, riskScore: 36, confidence: 86 },
      { month: 2, product: 'Core', market: 'Enterprise', mrr: 119, churnPct: 3.5, supportTickets: 91, nps: 49, riskScore: 39, confidence: 84 },
      { month: 3, product: 'Core', market: 'Enterprise', mrr: 130, churnPct: 2.9, supportTickets: 88, nps: 56, riskScore: 32, confidence: 89 },
      { month: 4, product: 'AI Add-on', market: 'Midmarket', mrr: 38, churnPct: 6.1, supportTickets: 116, nps: 37, riskScore: 66, confidence: 72 },
      { month: 5, product: 'AI Add-on', market: 'Midmarket', mrr: 54, churnPct: 5.4, supportTickets: 142, nps: 42, riskScore: 61, confidence: 75 },
      { month: 6, product: 'AI Add-on', market: 'Midmarket', mrr: 73, churnPct: 4.7, supportTickets: 155, nps: 45, riskScore: 55, confidence: 77 },
      { month: 7, product: 'Services', market: 'Public Sector', mrr: 46, churnPct: 2.1, supportTickets: 52, nps: 63, riskScore: 28, confidence: 91 },
      { month: 8, product: 'Services', market: 'Public Sector', mrr: 51, churnPct: 2.3, supportTickets: 61, nps: 61, riskScore: 31, confidence: 89 }
    ]
  }
];

const channelDefinitions = [
  { key: 'time', label: 'Time / sequence', accepted: ['temporal', 'quantitative', 'nominal'], description: 'Controls the order in which rows are heard. This is the audio equivalent of the x-axis.' },
  { key: 'pitch', label: 'Pitch / register', accepted: ['quantitative'], description: 'Maps numeric magnitude to a bounded pentatonic pitch range.' },
  { key: 'timbre', label: 'Timbre / waveform', accepted: ['nominal'], description: 'Maps categories to oscillator character: sine, triangle, square, or sawtooth.' },
  { key: 'chord', label: 'Chord identity', accepted: ['nominal'], description: 'Maps categories to short chord identities over a shared tonal center.' },
  { key: 'motif', label: 'Motif identity', accepted: ['nominal'], description: 'Maps categories to a short melodic signature before the value tone.' },
  { key: 'duration', label: 'Duration', accepted: ['quantitative'], description: 'Maps numeric magnitude to how long the main tone lasts.' },
  { key: 'rhythm', label: 'Rhythm density', accepted: ['quantitative'], description: 'Maps numeric magnitude to pulse density layered around the main tone.' },
  { key: 'volume', label: 'Volume / salience', accepted: ['quantitative'], description: 'Maps numeric magnitude to loudness. Used gently because volume is a weak primary data channel.' },
  { key: 'pan', label: 'Stereo pan', accepted: ['quantitative', 'nominal'], description: 'Maps values or categories left-to-right as a redundant separation cue.' },
  { key: 'status', label: 'Status harmony', accepted: ['quantitative'], description: 'Maps a numeric risk/status field to stable, suspended, minor, or tense harmonic cues.' }
];

const presets = {
  'agency-spending': {
    time: 'fiscalYear', pitch: 'spendBillions', timbre: 'agency', chord: 'mission', motif: 'agency', duration: 'growthPct', rhythm: 'transactionsK', volume: 'confidence', pan: 'agency', status: 'riskScore'
  },
  'ai-monitoring': {
    time: 'run', pitch: 'accuracy', timbre: 'model', chord: 'task', motif: 'model', duration: 'latencyMs', rhythm: 'volume', volume: 'confidence', pan: 'model', status: 'hallucinationRisk'
  },
  'startup-metrics': {
    time: 'month', pitch: 'mrr', timbre: 'product', chord: 'market', motif: 'product', duration: 'churnPct', rhythm: 'supportTickets', volume: 'confidence', pan: 'product', status: 'riskScore'
  }
};

let selectedDataset = datasets[0];
let fieldMappings = { ...presets[selectedDataset.id] };
let audioContext = null;
let activeNodes = [];

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

function getField(key) {
  return selectedDataset.fields.find((field) => field.key === key);
}

function getNumericValues(fieldKey) {
  return selectedDataset.rows.map((row) => Number(row[fieldKey])).filter((value) => Number.isFinite(value));
}

function extent(fieldKey) {
  const values = getNumericValues(fieldKey);
  if (!values.length) return [0, 1];
  return [Math.min(...values), Math.max(...values)];
}

function normalize(value, fieldKey) {
  const [min, max] = extent(fieldKey);
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (Number(value) - min) / (max - min)));
}

function uniqueValues(fieldKey) {
  return [...new Set(selectedDataset.rows.map((row) => row[fieldKey]))];
}

function categoryIndex(value, fieldKey) {
  const values = uniqueValues(fieldKey);
  return Math.max(0, values.indexOf(value));
}

function renderVisualization() {
  visualization.innerHTML = '';
  visualization.className = 'viz grammar-viz';

  const pitchField = fieldMappings.pitch || selectedDataset.fields.find((field) => field.type === 'quantitative')?.key;
  const colorField = fieldMappings.timbre || fieldMappings.chord || fieldMappings.motif;
  const timeField = fieldMappings.time;
  const rows = orderedRows();
  const [min, max] = extent(pitchField);

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
    const hue = colorField ? (categoryIndex(category, colorField) * 72) % 360 : 195;
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
      <text x="${pad}" y="16" fill="#7dd3fc" font-size="12">pitch: ${getField(pitchField)?.label || 'none'}</text>
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
      const field = getField(fieldMappings[channel.key]);
      return `<li><strong>${channel.label}</strong> uses <span>${field?.label || fieldMappings[channel.key]}</span>.</li>`;
    })
    .join('');

  explanation.innerHTML = `
    <p>This mapping is row-based: each data row becomes an audio event. The active fields are layered together rather than all using the same default note.</p>
    <ul>${items}</ul>
  `;
}

function orderedRows() {
  const rows = [...selectedDataset.rows];
  const timeField = fieldMappings.time;
  if (!timeField) return rows;

  return rows.sort((a, b) => {
    const av = a[timeField];
    const bv = b[timeField];
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  });
}

function rowLabel(row) {
  const nominal = selectedDataset.fields.find((field) => field.type === 'nominal');
  const temporal = selectedDataset.fields.find((field) => field.type === 'temporal');
  return [nominal ? row[nominal.key] : null, temporal ? row[temporal.key] : null].filter(Boolean).join(' · ');
}

function ensureAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function stopAll() {
  activeNodes.forEach((node) => {
    try { node.stop(); } catch (error) { /* already stopped */ }
  });
  activeNodes = [];
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function fieldFrequency(row) {
  const field = fieldMappings.pitch;
  if (!field) return midiToFrequency(60);
  const scale = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72];
  const n = normalize(row[field], field);
  const index = Math.max(0, Math.min(scale.length - 1, Math.round(n * (scale.length - 1))));
  return midiToFrequency(scale[index]);
}

function fieldDuration(row, tempo) {
  const field = fieldMappings.duration;
  if (!field) return 0.28 / tempo;
  return (0.16 + normalize(row[field], field) * 0.48) / tempo;
}

function fieldVolume(row) {
  const field = fieldMappings.volume;
  if (!field) return 0.13;
  return 0.06 + normalize(row[field], field) * 0.12;
}

function fieldPan(row) {
  const field = fieldMappings.pan;
  if (!field) return 0;
  const fieldDef = getField(field);
  if (fieldDef?.type === 'quantitative') return -0.75 + normalize(row[field], field) * 1.5;
  const values = uniqueValues(field);
  if (values.length <= 1) return 0;
  return -0.75 + (categoryIndex(row[field], field) / (values.length - 1)) * 1.5;
}

function fieldWaveform(row) {
  const field = fieldMappings.timbre;
  if (!field) return 'sine';
  const waves = ['sine', 'triangle', 'square', 'sawtooth'];
  return waves[categoryIndex(row[field], field) % waves.length];
}

function createGain(time, duration, peak = 0.13) {
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.025);
  gain.gain.setValueAtTime(Math.max(0.0002, peak), Math.max(time + 0.03, time + duration - 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  return gain;
}

function playTone(freq, start, duration, type = 'sine', volume = 0.13, pan = 0) {
  const osc = audioContext.createOscillator();
  const gain = createGain(start, duration, volume);
  const panner = audioContext.createStereoPanner();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  panner.pan.setValueAtTime(pan, start);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioContext.destination);

  osc.start(start);
  osc.stop(start + duration + 0.02);
  activeNodes.push(osc);
}

function playChordForRow(row, start, tempo, pan) {
  const field = fieldMappings.chord;
  if (!field) return;

  const chordBank = [
    [48, 52, 55, 60],
    [48, 53, 57, 60],
    [48, 55, 62, 65],
    [48, 50, 55, 60],
    [48, 51, 55, 58],
    [48, 52, 59, 64]
  ];

  const chord = chordBank[categoryIndex(row[field], field) % chordBank.length];
  chord.forEach((midi) => playTone(midiToFrequency(midi), start, 0.26 / tempo, 'sine', 0.035, pan));
}

function playMotifForRow(row, start, tempo, pan) {
  const field = fieldMappings.motif;
  if (!field) return 0;

  const motifs = [
    [60, 64, 62],
    [60, 57, 62],
    [55, 60, 67],
    [64, 62, 60],
    [60, 65, 64],
    [57, 60, 62]
  ];

  const motif = motifs[categoryIndex(row[field], field) % motifs.length];
  motif.forEach((midi, index) => {
    playTone(midiToFrequency(midi), start + index * (0.08 / tempo), 0.055 / tempo, 'triangle', 0.055, pan);
  });

  return 0.28 / tempo;
}

function playRhythmForRow(row, start, tempo, baseFreq, pan) {
  const field = fieldMappings.rhythm;
  if (!field) return;

  const pulses = 1 + Math.round(normalize(row[field], field) * 6);
  for (let i = 0; i < pulses; i += 1) {
    playTone(baseFreq * 2, start + i * (0.055 / tempo), 0.028 / tempo, 'square', 0.025, pan);
  }
}

function playStatusForRow(row, start, tempo, pan) {
  const field = fieldMappings.status;
  if (!field) return;

  const n = normalize(row[field], field);
  const states = [
    { threshold: 0.25, chord: [43, 48, 52, 55], wave: 'sine', volume: 0.025 },
    { threshold: 0.5, chord: [43, 48, 53, 55], wave: 'triangle', volume: 0.03 },
    { threshold: 0.75, chord: [43, 46, 50, 55], wave: 'triangle', volume: 0.035 },
    { threshold: 1, chord: [43, 46, 49, 54], wave: 'sawtooth', volume: 0.03 }
  ];

  const state = states.find((candidate) => n <= candidate.threshold) || states[states.length - 1];
  state.chord.forEach((midi) => playTone(midiToFrequency(midi), start, 0.42 / tempo, state.wave, state.volume, pan));
}

function playCombinedMapping() {
  const tempo = Number(tempoSlider.value);
  const rows = orderedRows();
  const step = 0.72 / tempo;
  const startBase = audioContext.currentTime + 0.08;

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
