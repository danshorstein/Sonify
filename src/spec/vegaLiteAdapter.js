// Vega-Lite -> Sonify adapter. An Altair chart is just chart.to_dict(),
// so accepting Vega-Lite JSON is Altair support.
//
// Ports the extraction logic from legacy/backend/app/sonify/vegalite.py:
// inline data.values only, mark from string or {type}, encodings from
// spec.encoding. The output feeds the exact same Sonify spec -> encoded
// points pipeline as the demo datasets; suggested mappings are defaults
// the user can override in the mapping UI.

const SUPPORTED_MARKS = ['bar', 'line', 'point', 'circle'];

const ARTICULATIONS = {
  bar: 'staccato',
  line: 'legato',
  point: 'blip',
  circle: 'blip'
};

export function extractMark(vlSpec) {
  const mark = vlSpec.mark;
  return typeof mark === 'object' && mark !== null ? mark.type : mark;
}

function normalizeType(vlType) {
  if (vlType === 'quantitative' || vlType === 'temporal') return vlType;
  if (vlType === 'nominal' || vlType === 'ordinal') return 'nominal';
  return null;
}

function sniffType(values, fieldKey) {
  const samples = values.map((row) => row[fieldKey]).filter((value) => value !== null && value !== undefined);
  if (!samples.length) return 'nominal';
  return samples.every((value) => typeof value === 'number' && Number.isFinite(value)) ? 'quantitative' : 'nominal';
}

function channelTitle(channel) {
  if (!channel) return null;
  if (typeof channel.title === 'string') return channel.title;
  if (channel.axis && typeof channel.axis.title === 'string') return channel.axis.title;
  return null;
}

function specTitle(vlSpec) {
  if (typeof vlSpec.title === 'string') return vlSpec.title;
  if (vlSpec.title && typeof vlSpec.title.text === 'string') return vlSpec.title.text;
  return null;
}

export function vegaLiteToSonify(input) {
  const vlSpec = typeof input === 'string' ? JSON.parse(input) : input;
  if (!vlSpec || typeof vlSpec !== 'object' || Array.isArray(vlSpec)) {
    throw new Error('The Vega-Lite spec must be a JSON object.');
  }

  const mark = extractMark(vlSpec);
  if (!mark) {
    throw new Error('The spec has no "mark". Layered/faceted specs are not supported yet — import a single-view chart.');
  }
  if (!SUPPORTED_MARKS.includes(mark)) {
    throw new Error(`Mark "${mark}" is not supported yet. Supported marks: ${SUPPORTED_MARKS.join(', ')}.`);
  }

  const values = vlSpec.data?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Only inline data.values is supported for now. If the chart uses data.url, inline the rows first.');
  }

  const encoding = vlSpec.encoding || {};
  if (!encoding.x?.field || !encoding.y?.field) {
    throw new Error('The spec needs encoding.x and encoding.y, each with a "field".');
  }

  const typeOf = (channel) => normalizeType(channel?.type) || sniffType(values, channel.field);
  const xType = typeOf(encoding.x);
  const yType = typeOf(encoding.y);

  // Default orientation: x -> time, y -> pitch. A horizontal chart
  // (quantitative x against a categorical/temporal y) swaps them, since
  // pitch must carry the quantitative magnitude.
  let timeChannel = encoding.x;
  let pitchChannel = encoding.y;
  let pitchType = yType;
  if (yType !== 'quantitative' && xType === 'quantitative') {
    timeChannel = encoding.y;
    pitchChannel = encoding.x;
    pitchType = xType;
  }
  if (pitchType !== 'quantitative') {
    throw new Error('At least one of encoding.x / encoding.y must be quantitative so it can map to pitch.');
  }

  const colorField = encoding.color?.field || null;
  const colorType = colorField ? typeOf(encoding.color) : null;
  const sizeField = encoding.size?.field || null;
  const sizeType = sizeField ? typeOf(encoding.size) : null;

  const titles = {};
  [['x', encoding.x], ['y', encoding.y], ['color', encoding.color], ['size', encoding.size]].forEach(([, channel]) => {
    const title = channelTitle(channel);
    if (channel?.field && title) titles[channel.field] = title;
  });
  const encodedTypes = {};
  [encoding.x, encoding.y, encoding.color, encoding.size].forEach((channel) => {
    if (channel?.field) encodedTypes[channel.field] = typeOf(channel);
  });

  const keys = [...new Set(values.flatMap((row) => Object.keys(row)))];
  const fields = keys.map((key) => ({
    key,
    label: titles[key] || key,
    type: encodedTypes[key] || sniffType(values, key)
  }));

  const mappings = {
    time: timeChannel.field,
    pitch: pitchChannel.field,
    timbre: colorType === 'nominal' ? colorField : null,
    chord: null,
    motif: null,
    duration: null,
    rhythm: null,
    volume: sizeType === 'quantitative' ? sizeField : null,
    // color doubles as pan: a redundant identity cue, per the grammar
    pan: colorType === 'nominal' ? colorField : null,
    status: null
  };

  const title = specTitle(vlSpec);
  const seriesNote = colorField ? `, series by ${colorField}` : '';

  const dataset = {
    id: 'imported',
    name: title || `Imported ${mark} chart`,
    description: `Vega-Lite ${mark} chart · ${values.length} rows${seriesNote}. Suggested mappings applied — adjust them freely.`,
    fields,
    rows: values,
    articulation: ARTICULATIONS[mark]
  };

  return {
    dataset,
    mappings,
    meta: {
      mark,
      vlSpec,
      xField: encoding.x.field,
      xType,
      colorField,
      title
    }
  };
}
