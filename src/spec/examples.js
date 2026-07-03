// Bundled Vega-Lite example specs, one per supported mark family.
// Each is exactly what Altair's chart.to_dict() would emit.

export const exampleSpecs = [
  {
    id: 'example-bar',
    label: 'Bar chart',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: 'Monthly sales',
      mark: 'bar',
      data: {
        values: [
          { month: 'Jan', sales: 28 },
          { month: 'Feb', sales: 43 },
          { month: 'Mar', sales: 55 },
          { month: 'Apr', sales: 47 },
          { month: 'May', sales: 61 },
          { month: 'Jun', sales: 58 },
          { month: 'Jul', sales: 74 },
          { month: 'Aug', sales: 69 }
        ]
      },
      encoding: {
        x: { field: 'month', type: 'ordinal', sort: null },
        y: { field: 'sales', type: 'quantitative' }
      }
    }
  },
  {
    id: 'example-line',
    label: 'Multi-series line',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: 'Weekly site visits by channel',
      mark: 'line',
      data: {
        values: [
          { week: 1, channel: 'Search', visits: 420 },
          { week: 2, channel: 'Search', visits: 480 },
          { week: 3, channel: 'Search', visits: 465 },
          { week: 4, channel: 'Search', visits: 540 },
          { week: 5, channel: 'Search', visits: 610 },
          { week: 6, channel: 'Search', visits: 655 },
          { week: 1, channel: 'Social', visits: 180 },
          { week: 2, channel: 'Social', visits: 260 },
          { week: 3, channel: 'Social', visits: 310 },
          { week: 4, channel: 'Social', visits: 275 },
          { week: 5, channel: 'Social', visits: 340 },
          { week: 6, channel: 'Social', visits: 415 }
        ]
      },
      encoding: {
        x: { field: 'week', type: 'quantitative' },
        y: { field: 'visits', type: 'quantitative' },
        color: { field: 'channel', type: 'nominal' }
      }
    }
  },
  {
    id: 'example-scatter',
    label: 'Scatter plot',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: 'Cars: horsepower vs efficiency',
      mark: 'circle',
      data: {
        values: [
          { horsepower: 68, mpg: 33.5, weight: 2145, origin: 'Japan' },
          { horsepower: 75, mpg: 30.1, weight: 2264, origin: 'Japan' },
          { horsepower: 88, mpg: 27.4, weight: 2670, origin: 'Japan' },
          { horsepower: 90, mpg: 24.8, weight: 2870, origin: 'Europe' },
          { horsepower: 110, mpg: 21.5, weight: 3060, origin: 'Europe' },
          { horsepower: 130, mpg: 18.9, weight: 3504, origin: 'USA' },
          { horsepower: 150, mpg: 15.2, weight: 3892, origin: 'USA' },
          { horsepower: 165, mpg: 14.4, weight: 4141, origin: 'USA' },
          { horsepower: 193, mpg: 11.3, weight: 4732, origin: 'USA' },
          { horsepower: 215, mpg: 10.8, weight: 4615, origin: 'USA' }
        ]
      },
      encoding: {
        x: { field: 'horsepower', type: 'quantitative' },
        y: { field: 'mpg', type: 'quantitative' },
        color: { field: 'origin', type: 'nominal' },
        size: { field: 'weight', type: 'quantitative' }
      }
    }
  }
];
