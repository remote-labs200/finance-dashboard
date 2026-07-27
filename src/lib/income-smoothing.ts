/**
 * Income Smoothing Engine
 *
 * Computes a stable "safe pay-yourself" amount for freelancers with
 * irregular income, and identifies dry-month buffer needs.
 *
 * Key concepts:
 * 1. Safe Pay: The maximum amount a freelancer can reliably pay themselves each month
 * 2. Buffer: The reserve needed to cover dry months
 * 3. Monthly Projection: 12-month cash flow forecast
 */

// --- Types ---

export interface MonthlyIncome {
  /** Month in YYYY-MM format */
  month: string;
  /** Net income for the month in cents (income - expenses, before tax set-aside) */
  netIncomeCents: number;
  /** Gross income for the month in cents */
  grossIncomeCents: number;
  /** Total expenses for the month in cents */
  expensesCents: number;
}

export interface SmoothingResult {
  /** Recommended safe monthly pay-yourself amount in cents */
  safePayCents: number;
  /** Monthly income volatility (standard deviation as % of mean) */
  volatilityPercent: number;
  /** Average monthly income in cents */
  averageMonthlyIncomeCents: number;
  /** Median monthly income in cents */
  medianMonthlyIncomeCents: number;
  /** Minimum monthly income in cents (worst month) */
  minMonthlyIncomeCents: number;
  /** Maximum monthly income in cents (best month) */
  maxMonthlyIncomeCents: number;
  /** Recommended buffer amount in cents */
  bufferRequiredCents: number;
  /** Current buffer health: months of expenses covered */
  bufferHealthMonths: number;
  /** 12-month projection with smoothing applied */
  projections: MonthProjection[];
  /** Dry months that need buffer coverage */
  dryMonths: DryMonth[];
  /** Tax set-aside per month in cents */
  monthlyTaxSetAsideCents: number;
}

export interface MonthProjection {
  /** Month in YYYY-MM format */
  month: string;
  /** Actual or projected net income in cents */
  projectedIncomeCents: number;
  /** Safe pay amount in cents */
  safePayCents: number;
  /** Tax set-aside in cents */
  taxSetAsideCents: number;
  /** Remaining after pay + tax in cents */
  surplusCents: number;
  /** Running buffer balance in cents */
  bufferBalanceCents: number;
  /** Whether this is a dry month (income < safe pay) */
  isDryMonth: boolean;
  /** Whether this is projected (future) vs actual */
  isProjected: boolean;
}

export interface DryMonth {
  month: string;
  /** How much short in cents */
  shortfallCents: number;
  /** How much to set aside in good months to cover this */
  recommendedMonthlySavingsCents: number;
}

export interface SmoothingInputs {
  /** Historical monthly incomes (at least 3 months) */
  monthlyIncomes: MonthlyIncome[];
  /** Monthly tax set-aside percentage (e.g., 0.25 for 25%) */
  taxSetAsideRate?: number;
  /** Fixed monthly obligations in cents (rent, insurance, etc.) */
  fixedMonthlyObligationsCents?: number;
  /** Desired buffer months (default: 3) */
  desiredBufferMonths?: number;
  /** Number of months to project forward */
  projectionMonths?: number;
}

// --- Core Functions ---

/**
 * Calculate the standard deviation of an array of numbers
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate the median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Get month string (YYYY-MM) from a date
 */
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Add months to a YYYY-MM string
 */
function addMonths(monthKey: string, n: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + n, 1);
  return getMonthKey(date);
}

/**
 * Compute income smoothing result from historical data
 */
export function computeSmoothing(inputs: SmoothingInputs): SmoothingResult {
  const {
    monthlyIncomes,
    taxSetAsideRate = 0.25,
    fixedMonthlyObligationsCents = 0,
    desiredBufferMonths = 3,
    projectionMonths = 12,
  } = inputs;

  if (monthlyIncomes.length === 0) {
    return emptyResult();
  }

  // Extract net incomes in cents
  const netIncomes = monthlyIncomes.map((m) => m.netIncomeCents);
  const grossIncomes = monthlyIncomes.map((m) => m.grossIncomeCents);

  // Core statistics
  const avgMonthlyIncome = netIncomes.reduce((a, b) => a + b, 0) / netIncomes.length;
  const medianMonthlyIncome = median(netIncomes);
  const minIncome = Math.min(...netIncomes);
  const maxIncome = Math.max(...netIncomes);

  // Volatility: coefficient of variation
  const stdDev = standardDeviation(netIncomes);
  const volatilityPercent = avgMonthlyIncome > 0
    ? (stdDev / avgMonthlyIncome) * 100
    : 0;

  // --- Safe Pay Calculation ---
  // Strategy: Use a blend of median (robust to outliers) and a safety margin
  // based on volatility. Higher volatility = more conservative safe pay.

  const volatilityFactor = Math.max(0.7, 1 - (volatilityPercent / 200));
  const safePayRaw = medianMonthlyIncome * volatilityFactor;

  // Apply tax set-aside
  const monthlyTaxSetAside = avgMonthlyIncome * taxSetAsideRate;

  // Safe pay after tax set-aside and fixed obligations
  const safePay = Math.max(
    0,
    safePayRaw - monthlyTaxSetAside - fixedMonthlyObligationsCents
  );

  // --- Buffer Calculation ---
  // Buffer = how much we need to cover dry months
  const dryMonthShortfalls = netIncomes
    .filter((income) => income < safePay + monthlyTaxSetAside)
    .map((income) => (safePay + monthlyTaxSetAside) - income);

  const avgShortfall = dryMonthShortfalls.length > 0
    ? dryMonthShortfalls.reduce((a, b) => a + b, 0) / dryMonthShortfalls.length
    : 0;

  const bufferRequired = avgShortfall * desiredBufferMonths;

  // Buffer health: how many months of expenses the current buffer covers
  const avgMonthlyExpenses = monthlyIncomes.length > 0
    ? monthlyIncomes.reduce((a, m) => a + m.expensesCents, 0) / monthlyIncomes.length
    : 0;
  const bufferHealthMonths = avgMonthlyExpenses > 0
    ? bufferRequired / avgMonthlyExpenses
    : 0;

  // --- 12-Month Projection ---
  const lastMonth = monthlyIncomes.length > 0
    ? monthlyIncomes[monthlyIncomes.length - 1].month
    : getMonthKey(new Date());

  const projections: MonthProjection[] = [];
  let bufferBalance = 0;
  const now = new Date();
  const currentMonthKey = getMonthKey(now);

  // First, project existing months
  for (let i = 0; i < monthlyIncomes.length; i++) {
    const m = monthlyIncomes[i];
    const income = m.netIncomeCents;
    const isDry = income < safePay + monthlyTaxSetAside;
    const surplus = income - safePay - monthlyTaxSetAside;

    if (!isDry) {
      bufferBalance += surplus;
    } else {
      bufferBalance += surplus; // surplus is negative, so this subtracts
    }
    bufferBalance = Math.max(0, bufferBalance); // Can't go below 0

    projections.push({
      month: m.month,
      projectedIncomeCents: income,
      safePayCents: safePay,
      taxSetAsideCents: monthlyTaxSetAside,
      surplusCents: surplus,
      bufferBalanceCents: bufferBalance,
      isDryMonth: isDry,
      isProjected: false,
    });
  }

  // Then, project future months
  for (let i = 1; i <= projectionMonths; i++) {
    const futureMonth = addMonths(lastMonth, i);
    // Use average as projection for future months
    const projectedIncome = avgMonthlyIncome;
    const isDry = projectedIncome < safePay + monthlyTaxSetAside;
    const surplus = projectedIncome - safePay - monthlyTaxSetAside;

    if (!isDry) {
      bufferBalance += surplus;
    } else {
      bufferBalance += surplus;
    }
    bufferBalance = Math.max(0, bufferBalance);

    projections.push({
      month: futureMonth,
      projectedIncomeCents: Math.round(projectedIncome),
      safePayCents: safePay,
      taxSetAsideCents: monthlyTaxSetAside,
      surplusCents: Math.round(surplus),
      bufferBalanceCents: Math.round(bufferBalance),
      isDryMonth: isDry,
      isProjected: true,
    });
  }

  // --- Identify Dry Months ---
  const dryMonths: DryMonth[] = [];
  const monthsBelowThreshold = monthlyIncomes.filter(
    (m) => m.netIncomeCents < safePay + monthlyTaxSetAside
  );

  if (monthsBelowThreshold.length > 0) {
    const totalShortfall = monthsBelowThreshold.reduce(
      (acc, m) => acc + (safePay + monthlyTaxSetAside - m.netIncomeCents),
      0
    );
    const recommendedMonthlySavings = totalShortfall / monthlyIncomes.length;

    for (const m of monthsBelowThreshold) {
      dryMonths.push({
        month: m.month,
        shortfallCents: safePay + monthlyTaxSetAside - m.netIncomeCents,
        recommendedMonthlySavingsCents: Math.round(recommendedMonthlySavings),
      });
    }
  }

  return {
    safePayCents: Math.round(safePay),
    volatilityPercent: Math.round(volatilityPercent * 10) / 10,
    averageMonthlyIncomeCents: Math.round(avgMonthlyIncome),
    medianMonthlyIncomeCents: Math.round(medianMonthlyIncome),
    minMonthlyIncomeCents: minIncome,
    maxMonthlyIncomeCents: maxIncome,
    bufferRequiredCents: Math.round(bufferRequired),
    bufferHealthMonths: Math.round(bufferHealthMonths * 10) / 10,
    projections,
    dryMonths,
    monthlyTaxSetAsideCents: Math.round(monthlyTaxSetAside),
  };
}

/**
 * Get monthly income data from transactions for a given period
 */
export function aggregateMonthlyIncomes(
  transactions: Array<{
    amountCents: number;
    date: string;
  }>,
  startDate: string,
  endDate: string
): MonthlyIncome[] {
  const monthlyMap = new Map<string, MonthlyIncome>();

  for (const txn of transactions) {
    const month = txn.date.substring(0, 7); // YYYY-MM

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        month,
        netIncomeCents: 0,
        grossIncomeCents: 0,
        expensesCents: 0,
      });
    }

    const entry = monthlyMap.get(month)!;
    if (txn.amountCents > 0) {
      entry.grossIncomeCents += txn.amountCents;
      entry.netIncomeCents += txn.amountCents;
    } else {
      entry.expensesCents += Math.abs(txn.amountCents);
      entry.netIncomeCents += txn.amountCents; // This subtracts
    }
  }

  // Sort by month
  return Array.from(monthlyMap.values())
    .filter((m) => m.month >= startDate && m.month <= endDate)
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Generate an empty result for when there's no data
 */
function emptyResult(): SmoothingResult {
  return {
    safePayCents: 0,
    volatilityPercent: 0,
    averageMonthlyIncomeCents: 0,
    medianMonthlyIncomeCents: 0,
    minMonthlyIncomeCents: 0,
    maxMonthlyIncomeCents: 0,
    bufferRequiredCents: 0,
    bufferHealthMonths: 0,
    projections: [],
    dryMonths: [],
    monthlyTaxSetAsideCents: 0,
  };
}

/**
 * Get a human-readable summary of the smoothing result
 */
export function getSmoothingSummary(result: SmoothingResult): {
  safePayMonthly: string;
  volatility: string;
  bufferNeeded: string;
  status: 'healthy' | 'caution' | 'warning' | 'critical';
  statusMessage: string;
} {
  const formatDollars = (cents: number) => {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  let status: 'healthy' | 'caution' | 'warning' | 'critical' = 'healthy';
  let statusMessage = 'Your income is stable. You can confidently pay yourself the recommended amount.';

  if (result.volatilityPercent > 60) {
    status = 'critical';
    statusMessage = 'High income volatility. Consider building a larger buffer before increasing your pay.';
  } else if (result.volatilityPercent > 40) {
    status = 'warning';
    statusMessage = 'Moderate income swings detected. Keep a healthy buffer for dry months.';
  } else if (result.volatilityPercent > 20) {
    status = 'caution';
    statusMessage = 'Some income variation. Your smoothing plan looks solid.';
  }

  return {
    safePayMonthly: formatDollars(result.safePayCents),
    volatility: `${result.volatilityPercent}%`,
    bufferNeeded: formatDollars(result.bufferRequiredCents),
    status,
    statusMessage,
  };
}
