const datasets = [
  {
    id: 'bar-spending',
    name: 'Agency spending bars',
    type: 'bar',
    description: 'Discrete categories with dollar amounts. Good for testing value encodings and category identity.',
    xLabel: 'Agency',
    yLabel: 'Spend',
    data: [
      { label: 'Defense', value: 92 },
      { label: 'Health', value: 78 },
      { label: 'Education', value: 42 },
      { label: 'Energy', value: 34 },
      { label: 'Justice', value: 55 },
      { label: 'Transit', value: 61 }
    ]
  },
  {
    id: 'line-revenue',
    name: 'Time-series trend',
    type: 'line',
    description: 'A single time series. Best for testing playback time, pitch contour, legato, and trend perception.',
    xLabel: 'Quarter',
    yLabel: 'Value',
    data: [
      { label: 'Q1', value: 38 },
      { label: 'Q2', value: 44 },
      { label: 'Q3', value: 41 },
      { label: 'Q4', value: 58 },
      { label: 'Q5', value: 66 },
      { label: 'Q6', value: 62 },
      { label: 'Q7', value: 75 },
      { label: 'Q8', value: 88 }
    ]
  },
  {
    id: 'status-quality',
    name: 'Green-yellow-red state',
    type: 'status',
    description: 'Operational feedback inspired by scanner guidance: good, caution, warning, critical.',
    xLabel: 'State',
    yLabel: 'Quality',
    data: [
      { label: 'Good', value: 92, state: 'good' },
      { label: 'Caution', value: 68, state: 'caution' },
      { label: 'Warning', value: 44, state: 'warning' },
      { label: 'Critical', value: 22, state: 'critical' }
    ]
  }
];

const mappings = [
  {
    id: 'value-pitch',
    name: 'Value → pitch',
    fit: 'Strong',
    description: 'Higher values become higher musical pitches in a bounded pentatonic scale. This is the closest audio equivalent to y-axis height.',
    play: playValuePitch
  },
  {
    id: 'value-duration',
    name: 'Value → duration',
    fit: 'Medium',
    description: 'Higher values last longer. Useful as a redundant magnitude cue, but slower than pitch for quick comparison.',
    play: playValueDuration
  },
  {
    id: 'count-rhythm',
    name: 'Value/count → rhythm density',
    fit: 'Strong for counts',
    description: 'Higher values produce denser pulse clusters. This is especially promising for histograms and counts.',
    play: playRhythmDensity
  },
  {
    id: 'category-chords',
    name: 'Category → chord identity',
    fit: 'Experimental strong',
    description: 'Each category gets a short chord identity over a shared tonal center. This tests category-as-harmony instead of category-as-timbre.',
    play: playCategoryChords
  },
  {
    id: 'motif-identity',
    name: 'Category → short motif',
    fit: 'Experimental',
    description: 'Each category receives a small 3-note signature before its value tone. This is like an audio version of visual shape.',
    play: playMotifIdentity
  },
  {
    id: 'state-valence',
    name: 'Status → musical valence loop',
    fit: 'Excellent for state',
    description: 'Green/yellow/red state becomes a short repeating musical phrase: consonant when good, suspended when cautionary, darker when warning.',
    play: playStateValence
  }
];

let selectedDataset = datasets[0];
let selectedMapping = mappings[0];
let audioContext = null;
let scheduledTimers = [];
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

function init() {
  renderDatasetButtons();
  renderMappingButtons();
  renderAll();

  playButton.addEventListener('click', () => {
    stopAll();
    ensureAudioContext();
    selectedMapping.play(selectedDataset, Number(tempoSlider.value));
  });

  stopButton.addEventListener('click', stopAll);

  tempoSlider.addEventListener('input', () => {
    tempoValue.textContent = `${Number(tempoSlider.value).toFixed(1)}x`;
  });
}

function renderDatasetButtons() {
  datasetOptions.innerHTML = '';

  datasets.forEach((dataset) => {
    const button = document.createElement('button');
    button.className = `option-button ${dataset.id === selectedDataset.id ? 'active' : ''}`;
    button.innerHTML = `<strong>${dataset.name}</strong><span>${dataset.description}</span>`;
    button.addEventListener('click', () => {
      selectedDataset = dataset;
      renderAll();
    });
    datasetOptions.appendChild(button);
  });
}

function renderMappingButtons() {
  mappingOptions.innerHTML = '';

  mappings.forEach((mapping) => {
    const button = document.createElement('button');
    button.className = `option-button ${mapping.id === selectedMapping.id ? 'active' : ''}`;
    button.innerHTML = `<strong>${mapping.name}</strong><span>${mapping.fit}</span>`;
    button.addEventListener('click', () => {
      selectedMapping = mapping;
      renderAll();
    });
    mappingOptions.appendChild(button);
  });
}

function renderAll() {
  renderDatasetButtons();
  renderMappingButtons();
  chartType.textContent = selectedDataset.type;
  mappingFit.textContent = selectedMapping.fit;
  mappingDescription.textContent = selectedMapping.description;
  renderVisualization(selectedDataset);
}

function renderVisualization(dataset) {
  visualization.innerHTML = '';
  visualization.className = `viz ${dataset.type === 'status' ? 'status-viz' : ''}`;

  if (dataset.type === 'line') {
    renderLine(dataset);
    return;
  }

  if (dataset.type === 'status') {
    renderStatus(dataset);
    return;
  }

  renderBars(dataset);
}

function renderBars(dataset) {
  const max = Math.max(...dataset.data.map((d) => d.value));

  dataset.data.forEach((d) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(12, (d.value / max) * 220)}px`;
    bar.title = `${d.label}: ${d.value}`;
    bar.textContent = d.label.slice(0, 3);
    visualization.appendChild(bar);
  });
}

function renderLine(dataset) {
  const width = 640;
  const height = 250;
  const pad = 20;
  const values = dataset.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const points = dataset.data.map((d, index) => {
    const x = pad + (index / (dataset.data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((d.value - min) / (max - min)) * (height - pad * 2);
    return `${x},${y}`;
  });

  visualization.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart showing selected time series">
      <polyline points="${points.join(' ')}" fill="none" stroke="#7dd3fc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map((point) => {
        const [x, y] = point.split(',');
        return `<circle cx="${x}" cy="${y}" r="5" fill="#c084fc" />`;
      }).join('')}
    </svg>
  `;
}

function renderStatus(dataset) {
  visualization.innerHTML = dataset.data.map((d) => {
    return `
      <div>
        <strong>${d.label}: ${d.value}%</strong>
        <div class="status-meter" aria-label="${d.label} quality ${d.value} percent">
          <div class="status-marker" style="left: ${d.value}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function stopAll() {
  scheduledTimers.forEach((timer) => clearTimeout(timer));
  scheduledTimers = [];

  activeNodes.forEach((node) => {
    try {
      node.stop();
    } catch (error) {
      // Node may already be stopped.
    }
  });
  activeNodes = [];
}

function schedule(callback, delaySeconds) {
  const timer = setTimeout(callback, delaySeconds * 1000);
  scheduledTimers.push(timer);
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function scaleFrequency(value, min, max) {
  const pentatonic = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72];
  const normalized = max === min ? 0.5 : (value - min) / (max - min);
  const index = Math.max(0, Math.min(pentatonic.length - 1, Math.round(normalized * (pentatonic.length - 1))));
  return midiToFrequency(pentatonic[index]);
}

function createGain(time, duration, peak = 0.18) {
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.025);
  gain.gain.setValueAtTime(peak, Math.max(time + 0.03, time + duration - 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  return gain;
}

function playTone(freq, start, duration, type = 'sine', volume = 0.18, pan = 0) {
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

function playGlide(points, start, duration, type = 'sine') {
  const values = points.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const osc = audioContext.createOscillator();
  const gain = createGain(start, duration, 0.13);

  osc.type = type;
  osc.frequency.setValueAtTime(scaleFrequency(values[0], min, max), start);

  points.forEach((point, index) => {
    const t = start + (index / (points.length - 1)) * duration;
    const freq = scaleFrequency(point.value, min, max);
    osc.frequency.linearRampToValueAtTime(freq, t);
  });

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
  activeNodes.push(osc);
}

function playChord(midiNotes, start, duration, type = 'sine', volume = 0.08) {
  midiNotes.forEach((midi) => playTone(midiToFrequency(midi), start, duration, type, volume));
}

function playValuePitch(dataset, tempo) {
  if (dataset.type === 'line') {
    playGlide(dataset.data, audioContext.currentTime + 0.08, 4.8 / tempo, 'sine');
    return;
  }

  const values = dataset.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = 0.42 / tempo;

  dataset.data.forEach((d, index) => {
    const start = audioContext.currentTime + 0.08 + index * step;
    const freq = scaleFrequency(d.value, min, max);
    playTone(freq, start, 0.28 / tempo, 'sine', 0.18);
  });
}

function playValueDuration(dataset, tempo) {
  const values = dataset.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let cursor = audioContext.currentTime + 0.08;

  dataset.data.forEach((d) => {
    const normalized = max === min ? 0.5 : (d.value - min) / (max - min);
    const duration = (0.16 + normalized * 0.55) / tempo;
    const freq = scaleFrequency(d.value, min, max);
    playTone(freq, cursor, duration, 'triangle', 0.16);
    cursor += duration + 0.08 / tempo;
  });
}

function playRhythmDensity(dataset, tempo) {
  const values = dataset.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let cursor = audioContext.currentTime + 0.08;

  dataset.data.forEach((d) => {
    const normalized = max === min ? 0.5 : (d.value - min) / (max - min);
    const pulses = 2 + Math.round(normalized * 7);
    const freq = scaleFrequency(d.value, min, max);

    for (let i = 0; i < pulses; i += 1) {
      playTone(freq, cursor + i * (0.07 / tempo), 0.045 / tempo, 'square', 0.055);
    }

    cursor += 0.75 / tempo;
  });
}

function playCategoryChords(dataset, tempo) {
  const chordBank = [
    [48, 52, 55],
    [48, 53, 57],
    [48, 55, 62],
    [48, 50, 55],
    [48, 52, 59],
    [48, 51, 58]
  ];

  const values = dataset.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = 0.78 / tempo;

  dataset.data.forEach((d, index) => {
    const start = audioContext.currentTime + 0.08 + index * step;
    const chord = chordBank[index % chordBank.length];
    playChord(chord, start, 0.32 / tempo, 'sine', 0.055);
    playTone(scaleFrequency(d.value, min, max), start + 0.34 / tempo, 0.22 / tempo, 'triangle', 0.12);
  });
}

function playMotifIdentity(dataset, tempo) {
  const motifs = [
    [60, 64, 62],
    [60, 57, 62],
    [55, 60, 67],
    [64, 62, 60],
    [60, 65, 64],
    [57, 60, 62]
  ];

  const values = dataset.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let cursor = audioContext.currentTime + 0.08;

  dataset.data.forEach((d, index) => {
    const motif = motifs[index % motifs.length];

    motif.forEach((midi, motifIndex) => {
      playTone(midiToFrequency(midi), cursor + motifIndex * (0.11 / tempo), 0.08 / tempo, 'triangle', 0.09);
    });

    playTone(scaleFrequency(d.value, min, max), cursor + 0.4 / tempo, 0.24 / tempo, 'sine', 0.15);
    cursor += 0.78 / tempo;
  });
}

function playStateValence(dataset, tempo) {
  const states = [
    { chord: [48, 52, 55, 62], type: 'sine', pulse: 0.0, volume: 0.055 },
    { chord: [48, 53, 55, 62], type: 'triangle', pulse: 0.03, volume: 0.06 },
    { chord: [45, 48, 52, 55], type: 'triangle', pulse: 0.06, volume: 0.07 },
    { chord: [46, 48, 53, 58], type: 'sawtooth', pulse: 0.08, volume: 0.055 }
  ];

  const source = dataset.type === 'status' ? dataset.data : [
    { label: 'Good', value: 90 },
    { label: 'Caution', value: 66 },
    { label: 'Warning', value: 42 },
    { label: 'Critical', value: 20 }
  ];

  source.forEach((d, index) => {
    const state = states[Math.min(index, states.length - 1)];
    const start = audioContext.currentTime + 0.08 + index * (1.05 / tempo);
    playChord(state.chord, start, 0.75 / tempo, state.type, state.volume);

    if (index > 0) {
      playTone(midiToFrequency(72 + index), start + 0.52 / tempo, 0.09 / tempo, 'square', 0.05 + state.pulse);
    }
  });
}

init();
