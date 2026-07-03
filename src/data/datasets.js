export const datasets = [
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
