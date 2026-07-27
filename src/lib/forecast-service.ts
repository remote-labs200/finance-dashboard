/**
 * AI Forecasting Service
 *
 * Predicts future income and expenses using historical data
 * with simple time-series analysis (moving average + seasonality).
 * No external AI needed -- pure math.
 */

// --- Types ---

export interface ForecastPoint {
  month: string; // YYYY-MM
  predictedIncomeCents: number;
  predictedExpenseCents: number;
  confidence: number; // 0-1
}

export interface ForecastResult {
  forecasts: ForecastPoint[];
  averageIncomeCents: number;
  averageExpenseCents: number;
  trendDirection: 'up' | 'down' | 'stable';
  trendPercent: number;
  seasonalityStrength: number; // 0-1
}

// --- Forecasting Engine ---

/**
 * Generate a forecast for the next N months based on historical data.
 */
export function generateForecast(
  historicalData: Array<{ month: string; incomeCents: number; expenseCents: number }>,
  monthsAhead: number = 6
): ForecastResult {
  if (historicalData.length === 0) {
    return {
      forecasts: [],
      averageIncomeCents: 0,
      averageExpenseCents: 0,
      trendDirection: 'stable',
      trendPercent: 0,
      seasonalityStrength: 0,
    };
  }

  // Sort by month
  const sorted = [...historicalData].sort((a, b) => a.month.localeCompare(b.month));

  // Calculate moving averages (3-month window)
  const incomeMA = movingAverage(sorted.map((d) => d.incomeCents), 3);
  const expenseMA = movingAverage(sorted.map((d) => d.expenseCents), 3);

  // Calculate trend (linear regression on moving averages)
  const incomeTrend = linearTrend(incomeMA);
  const expenseTrend = linearTrend(expenseMA);

  // Calculate seasonality (month-over-month patterns)
  const monthPatterns = calculateSeasonality(sorted);

  // Calculate averages
  const avgIncome = average(sorted.map((d) => d.incomeCents));
  const avgExpense = average(sorted.map((d) => d.expenseCents));

  // Calculate trend direction
  const incomeChange = incomeMA.length >= 2
    ? (incomeMA[incomeMA.length - 1] - incomeMA[0]) / Math.max(Math.abs(incomeMA[0]), 1)
    : 0;
  const trendDirection: 'up' | 'down' | 'stable' =
    Math.abs(incomeChange) < 0.05 ? 'stable' : incomeChange > 0 ? 'up' : 'down';

  // Generate forecast points
  const forecasts: ForecastPoint[] = [];
  const lastMonth = sorted[sorted.length - 1].month;

  for (let i = 1; i <= monthsAhead; i++) {
    const forecastMonth = addMonths(lastMonth, i);
    const monthNum = parseInt(forecastMonth.split('-')[1], 10);

    // Base prediction from trend
    let predictedIncome = incomeTrend.slope * (sorted.length + i) + incomeTrend.intercept;
    let predictedExpense = expenseTrend.slope * (sorted.length + i) + expenseTrend.intercept;

    // Apply seasonality adjustment
    const seasonFactor = monthPatterns[monthNum] ?? 1;
    predictedIncome *= seasonFactor;
    predictedExpense *= seasonFactor;

    // Clamp to non-negative
    predictedIncome = Math.max(0, Math.round(predictedIncome));
    predictedExpense = Math.max(0, Math.round(predictedExpense));

    // Confidence decreases with distance
    const confidence = Math.max(0.3, 1 - (i * 0.1));

    forecasts.push({
      month: forecastMonth,
      predictedIncomeCents: predictedIncome,
      predictedExpenseCents: predictedExpense,
      confidence,
    });
  }

  return {
    forecasts,
    averageIncomeCents: Math.round(avgIncome),
    averageExpenseCents: Math.round(avgExpense),
    trendDirection,
    trendPercent: Math.round(Math.abs(incomeChange) * 100),
    seasonalityStrength: calculateSeasonalityStrength(monthPatterns),
  };
}

// --- Helpers ---

function movingAverage(data: number[], window: number): number[] {
  if (data.length < window) return [...data];

  const result: number[] = [];
  for (let i = window - 1; i < data.length; i++) {
    const slice = data.slice(i - window + 1, i + 1);
    result.push(average(slice));
  }
  return result;
}

function linearTrend(data: number[]): { slope: number; intercept: number } {
  if (data.length < 2) return { slope: 0, intercept: data[0] ?? 0 };

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function calculateSeasonality(
  data: Array<{ month: string; incomeCents: number }>
): Record<number, number> {
  const monthTotals: Record<number, { sum: number; count: number }> = {};

  for (const d of data) {
    const monthNum = parseInt(d.month.split('-')[1], 10);
    if (!monthTotals[monthNum]) {
      monthTotals[monthNum] = { sum: 0, count: 0 };
    }
    monthTotals[monthNum].sum += d.incomeCents;
    monthTotals[monthNum].count++;
  }

  const overallAvg = average(data.map((d) => d.incomeCents));
  if (overallAvg === 0) return {};

  const patterns: Record<number, number> = {};
  for (const [month, { sum, count }] of Object.entries(monthTotals)) {
    const avg = sum / count;
    patterns[parseInt(month, 10)] = avg / overallAvg;
  }

  return patterns;
}

function calculateSeasonalityStrength(patterns: Record<number, number>): number {
  const values = Object.values(patterns);
  if (values.length < 3) return 0;

  const avg = average(values);
  if (avg === 0) return 0;

  const variance = average(values.map((v) => (v - avg) ** 2));
  const cv = Math.sqrt(variance) / avg;

  return Math.min(1, cv * 3); // Normalize to 0-1
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function addMonths(monthStr: string, months: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + months, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
