export type GrammarRecipe =
  | 'bar_pitch'
  | 'bar_duration'
  | 'category_chords'
  | 'category_motifs'
  | 'line_contour'
  | 'multi_series_timbre'
  | 'state_valence_loop';

export type ExampleDataset = {
  id: string;
  title: string;
  description: string;
  spec: Record<string, unknown>;
  recommendedRecipes: GrammarRecipe[];
  fields: {
    x?: string;
    y?: string;
    category?: string;
    time?: string;
    value?: string;
    state?: string;
  };
};

export const examples: ExampleDataset[] = [
  {
    id: 'bar-basic',
    title: 'Bar chart: category values',
    description: 'A simple discrete comparison. Good for testing whether value should map to pitch, duration, or category identity.',
    fields: { x: 'category', y: 'value', category: 'category' },
    recommendedRecipes: ['bar_pitch', 'bar_duration', 'category_chords', 'category_motifs'],
    spec: {
      '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
      data: {
        values: [
          { category: 'A', value: 28 },
          { category: 'B', value: 55 },
          { category: 'C', value: 43 },
          { category: 'D', value: 91 },
          { category: 'E', value: 81 },
          { category: 'F', value: 53 },
          { category: 'G', value: 19 },
          { category: 'H', value: 87 },
          { category: 'I', value: 52 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'category', type: 'nominal', legend: null },
      },
    },
  },
  {
    id: 'line-financial',
    title: 'Time series: financial trend',
    description: 'A monthly value over time. Good for testing the core rule that time should map to audio time and value should map to pitch contour.',
    fields: { time: 'month', value: 'amount' },
    recommendedRecipes: ['line_contour'],
    spec: {
      '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
      data: {
        values: [
          { month: '2024-01-01', amount: 42 },
          { month: '2024-02-01', amount: 48 },
          { month: '2024-03-01', amount: 51 },
          { month: '2024-04-01', amount: 47 },
          { month: '2024-05-01', amount: 62 },
          { month: '2024-06-01', amount: 73 },
          { month: '2024-07-01', amount: 69 },
          { month: '2024-08-01', amount: 76 },
          { month: '2024-09-01', amount: 84 },
          { month: '2024-10-01', amount: 79 },
          { month: '2024-11-01', amount: 88 },
          { month: '2024-12-01', amount: 95 },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'month', type: 'temporal', title: 'Month' },
        y: { field: 'amount', type: 'quantitative', title: 'Amount' },
      },
    },
  },
  {
    id: 'multi-agency',
    title: 'Multi-series: agency spending',
    description: 'Three agencies across fiscal years. Good for testing category identity through timbre while value remains pitch.',
    fields: { time: 'fiscalYear', value: 'spend', category: 'agency' },
    recommendedRecipes: ['multi_series_timbre', 'category_chords', 'category_motifs'],
    spec: {
      '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
      data: {
        values: [
          { fiscalYear: '2020', agency: 'Defense', spend: 720 },
          { fiscalYear: '2021', agency: 'Defense', spend: 742 },
          { fiscalYear: '2022', agency: 'Defense', spend: 766 },
          { fiscalYear: '2023', agency: 'Defense', spend: 816 },
          { fiscalYear: '2024', agency: 'Defense', spend: 842 },
          { fiscalYear: '2020', agency: 'Health', spend: 128 },
          { fiscalYear: '2021', agency: 'Health', spend: 146 },
          { fiscalYear: '2022', agency: 'Health', spend: 161 },
          { fiscalYear: '2023', agency: 'Health', spend: 154 },
          { fiscalYear: '2024', agency: 'Health', spend: 172 },
          { fiscalYear: '2020', agency: 'Education', spend: 68 },
          { fiscalYear: '2021', agency: 'Education', spend: 72 },
          { fiscalYear: '2022', agency: 'Education', spend: 89 },
          { fiscalYear: '2023', agency: 'Education', spend: 83 },
          { fiscalYear: '2024', agency: 'Education', spend: 95 },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'fiscalYear', type: 'ordinal', title: 'Fiscal Year' },
        y: { field: 'spend', type: 'quantitative', title: 'Spend' },
        color: { field: 'agency', type: 'nominal' },
      },
    },
  },
  {
    id: 'state-feedback',
    title: 'State feedback: green to red status',
    description: 'A real-time quality/status example inspired by musical scanner feedback. Good for testing adaptive musical valence.',
    fields: { state: 'quality', time: 'step' },
    recommendedRecipes: ['state_valence_loop'],
    spec: {
      '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
      data: {
        values: [
          { step: 1, quality: 0.94, status: 'good' },
          { step: 2, quality: 0.89, status: 'good' },
          { step: 3, quality: 0.72, status: 'caution' },
          { step: 4, quality: 0.58, status: 'caution' },
          { step: 5, quality: 0.36, status: 'warning' },
          { step: 6, quality: 0.22, status: 'critical' },
          { step: 7, quality: 0.68, status: 'caution' },
          { step: 8, quality: 0.91, status: 'good' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'step', type: 'ordinal' },
        y: { field: 'quality', type: 'quantitative', scale: { domain: [0, 1] } },
        color: { field: 'status', type: 'nominal' },
      },
    },
  },
];

export const recipeDescriptions: Record<GrammarRecipe, string> = {
  bar_pitch: 'Bar value → pitch. Higher bars become higher notes. Category order controls sequence.',
  bar_duration: 'Bar value → duration. Higher bars sustain longer, avoiding pitch as the primary channel.',
  category_chords: 'Category identity → chord. Categories get harmonic identities over a shared tonal center.',
  category_motifs: 'Category identity → short motif. Each category gets a small melodic signature.',
  line_contour: 'Time → playback time; value → continuous pitch contour. This is the core line-chart grammar.',
  multi_series_timbre: 'Series/category → timbre; value → pitch. Multiple lines play together with different voices.',
  state_valence_loop: 'State/status → musical valence. Good states are stable; caution states are suspended; warning states are tense.',
};
