/**
 * US Federal Tax Estimation Engine
 *
 * Computes estimated quarterly taxes for self-employed freelancers.
 * Based on 2024/2025 IRS tax brackets and self-employment tax rules.
 *
 * Key components:
 * 1. Self-Employment Tax (Social Security + Medicare)
 * 2. Federal Income Tax (progressive brackets)
 * 3. Quarterly estimated payment calculation
 * 4. Safe harbor rule (90% current year or 100% prior year)
 */

// --- Types ---

export type FilingStatus = 'single' | 'married_joint' | 'head_of_household';

export interface TaxInputs {
  /** Year-to-date net self-employment income in cents */
  ytdIncomeCents: number;
  /** Year-to-date deductible expenses in cents */
  ytdDeductionsCents: number;
  /** Prior year total tax liability in cents (for safe harbor) */
  priorYearTaxCents?: number;
  /** Filing status */
  filingStatus: FilingStatus;
  /** Tax year (e.g., 2024) */
  taxYear: number;
  /** Current quarter (1-4) */
  currentQuarter: 1 | 2 | 3 | 4;
  /** State tax rate (0-1 as decimal, e.g., 0.05 for 5%) - optional */
  stateRate?: number;
}

export interface TaxEstimate {
  /** Estimated annual self-employment tax in cents */
  selfEmploymentTaxCents: number;
  /** Deductible half of SE tax */
  seTaxDeductionCents: number;
  /** Taxable income after standard deduction and SE deduction */
  taxableIncomeCents: number;
  /** Federal income tax in cents */
  federalIncomeTaxCents: number;
  /** State income tax in cents (if applicable) */
  stateIncomeTaxCents: number;
  /** Total estimated annual tax */
  totalEstimatedTaxCents: number;
  /** Quarterly payment amount */
  quarterlyPaymentCents: number;
  /** Amount already paid this year (0 for now) */
  alreadyPaidCents: number;
  /** Remaining balance */
  remainingBalanceCents: number;
  /** Safe harbor minimum (100% or 110% of prior year) */
  safeHarborCents: number;
  /** Whether safe harbor applies */
  usesSafeHarbor: boolean;
  /** Effective combined tax rate */
  effectiveRate: number;
  /** Breakdown of what each dollar goes to */
  breakdown: {
    socialSecurityCents: number;
    medicareCents: number;
    additionalMedicareCents: number;
    federalIncomeCents: number;
    stateIncomeCents: number;
  };
}

// --- 2024 Tax Brackets ---

const FEDERAL_BRACKETS_2024: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 11_600, rate: 0.10 },
    { min: 11_600, max: 47_150, rate: 0.12 },
    { min: 47_150, max: 100_525, rate: 0.22 },
    { min: 100_525, max: 191_950, rate: 0.24 },
    { min: 191_950, max: 243_725, rate: 0.32 },
    { min: 243_725, max: 609_350, rate: 0.35 },
    { min: 609_350, max: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { min: 0, max: 23_200, rate: 0.10 },
    { min: 23_200, max: 94_300, rate: 0.12 },
    { min: 94_300, max: 201_050, rate: 0.22 },
    { min: 201_050, max: 383_900, rate: 0.24 },
    { min: 383_900, max: 487_450, rate: 0.32 },
    { min: 487_450, max: 731_200, rate: 0.35 },
    { min: 731_200, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 16_550, rate: 0.10 },
    { min: 16_550, max: 63_100, rate: 0.12 },
    { min: 63_100, max: 100_500, rate: 0.22 },
    { min: 100_500, max: 191_950, rate: 0.24 },
    { min: 191_950, max: 243_700, rate: 0.32 },
    { min: 243_700, max: 609_350, rate: 0.35 },
    { min: 609_350, max: Infinity, rate: 0.37 },
  ],
};

// Standard deductions 2024 (in dollars)
const STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14_600,
  married_joint: 29_200,
  head_of_household: 21_900,
};

// --- Constants ---

const SS_RATE = 0.124; // Social Security: 12.4%
const SS_WAGE_BASE_2024 = 168_600; // Max earnings subject to SS
const MEDICARE_RATE = 0.029; // Medicare: 2.9%
const ADDITIONAL_MEDICARE_THRESHOLD_2024 = 200_000; // Additional 0.9% above this (single)
const SE_TAX_MULTIPLIER = 0.9235; // 1 - (1/2 * 0.153) approximation

// --- Core Functions ---

/**
 * Calculate self-employment tax from net SE income
 */
export function calculateSelfEmploymentTax(
  netSEIncomeDollars: number,
  taxYear: number = 2024
): {
  totalSETax: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  seTaxDeduction: number;
} {
  // Step 1: 92.35% of net SE income is subject to SE tax
  const taxableSEIncome = netSEIncomeDollars * SE_TAX_MULTIPLIER;

  // Step 2: Social Security (12.4% up to wage base)
  const ssTaxable = Math.min(taxableSEIncome, SS_WAGE_BASE_2024);
  const socialSecurity = ssTaxable * SS_RATE;

  // Step 3: Medicare (2.9% on all, plus 0.9% additional above threshold)
  const medicare = taxableSEIncome * MEDICARE_RATE;
  const additionalMedicare = taxableSEIncome > ADDITIONAL_MEDICARE_THRESHOLD_2024
    ? (taxableSEIncome - ADDITIONAL_MEDICARE_THRESHOLD_2024) * 0.009
    : 0;

  const totalSETax = socialSecurity + medicare + additionalMedicare;

  // Step 4: Deductible half of SE tax (for income tax purposes)
  const seTaxDeduction = totalSETax / 2;

  return {
    totalSETax,
    socialSecurity,
    medicare,
    additionalMedicare,
    seTaxDeduction,
  };
}

/**
 * Calculate federal income tax from taxable income
 */
export function calculateFederalIncomeTax(
  taxableIncomeDollars: number,
  filingStatus: FilingStatus,
  taxYear: number = 2024
): number {
  const brackets = FEDERAL_BRACKETS_2024[filingStatus];
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncomeDollars <= bracket.min) break;
    const taxableInBracket = Math.min(
      taxableIncomeDollars,
      bracket.max
    ) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return tax;
}

/**
 * Calculate full tax estimate for a freelancer
 */
export function estimateAnnualTax(inputs: TaxInputs): TaxEstimate {
  const {
    ytdIncomeCents,
    ytdDeductionsCents,
    priorYearTaxCents,
    filingStatus,
    taxYear,
    currentQuarter,
    stateRate = 0,
  } = inputs;

  // Convert cents to dollars for calculations
  const grossIncomeDollars = ytdIncomeCents / 100;
  const deductionsDollars = ytdDeductionsCents / 100;

  // Step 1: Self-Employment Tax
  const seResult = calculateSelfEmploymentTax(grossIncomeDollars, taxYear);

  // Step 2: Taxable Income
  const standardDeduction = STANDARD_DEDUCTION_2024[filingStatus];
  const taxableIncomeDollars = Math.max(
    0,
    grossIncomeDollars
    - standardDeduction
    - seResult.seTaxDeduction
    - deductionsDollars
  );

  // Step 3: Federal Income Tax
  const federalIncomeTax = calculateFederalIncomeTax(
    taxableIncomeDollars,
    filingStatus,
    taxYear
  );

  // Step 4: State Income Tax (if applicable)
  const stateIncomeTax = taxableIncomeDollars * stateRate;

  // Step 5: Total Annual Estimate
  const totalAnnualTax = seResult.totalSETax + federalIncomeTax + stateIncomeTax;

  // Step 6: Quarterly Payment
  const quarterlyPayment = totalAnnualTax / 4;

  // Step 7: Safe Harbor Check
  // For 2024: pay 100% of prior year tax (110% if AGI > $150k single/$300k joint)
  const agi = grossIncomeDollars;
  const priorYearThreshold = filingStatus === 'single' ? 150_000 : 300_000;
  const safeHarborRate = agi > priorYearThreshold ? 1.10 : 1.00;
  const priorYearTax = (priorYearTaxCents ?? 0) / 100;
  const safeHarborAmount = priorYearTax * safeHarborRate;

  const usesSafeHarbor = priorYearTaxCents !== undefined && totalAnnualTax > safeHarborAmount;

  // Step 8: Effective Rate
  const effectiveRate = grossIncomeDollars > 0
    ? (totalAnnualTax / grossIncomeDollars) * 100
    : 0;

  return {
    selfEmploymentTaxCents: Math.round(seResult.totalSETax * 100),
    seTaxDeductionCents: Math.round(seResult.seTaxDeduction * 100),
    taxableIncomeCents: Math.round(taxableIncomeDollars * 100),
    federalIncomeTaxCents: Math.round(federalIncomeTax * 100),
    stateIncomeTaxCents: Math.round(stateIncomeTax * 100),
    totalEstimatedTaxCents: Math.round(totalAnnualTax * 100),
    quarterlyPaymentCents: Math.round(quarterlyPayment * 100),
    alreadyPaidCents: 0,
    remainingBalanceCents: Math.round(quarterlyPayment * 100),
    safeHarborCents: Math.round(safeHarborAmount * 100),
    usesSafeHarbor,
    effectiveRate,
    breakdown: {
      socialSecurityCents: Math.round(seResult.socialSecurity * 100),
      medicareCents: Math.round(seResult.medicare * 100),
      additionalMedicareCents: Math.round(seResult.additionalMedicare * 100),
      federalIncomeCents: Math.round(federalIncomeTax * 100),
      stateIncomeCents: Math.round(stateIncomeTax * 100),
    },
  };
}

/**
 * Get quarterly due dates for US estimated taxes
 */
export function getQuarterlyDueDates(year: number): Array<{
  quarter: number;
  dueDate: string;
  period: string;
  label: string;
}> {
  return [
    {
      quarter: 1,
      dueDate: `${year}-04-15`,
      period: `${year}-01-01 to ${year}-03-31`,
      label: 'Q1 (Jan-Mar)',
    },
    {
      quarter: 2,
      dueDate: `${year}-06-15`,
      period: `${year}-04-01 to ${year}-05-31`,
      label: 'Q2 (Apr-May)',
    },
    {
      quarter: 3,
      dueDate: `${year}-09-15`,
      period: `${year}-06-01 to ${year}-08-31`,
      label: 'Q3 (Jun-Aug)',
    },
    {
      quarter: 4,
      dueDate: `${year + 1}-01-15`,
      period: `${year}-09-01 to ${year}-12-31`,
      label: 'Q4 (Sep-Dec)',
    },
  ];
}

/**
 * Calculate days until next tax deadline
 */
export function daysUntilNextDeadline(
  currentDate: Date = new Date()
): { dueDate: string; daysRemaining: number; quarter: number } | null {
  const year = currentDate.getFullYear();
  const deadlines = getQuarterlyDueDates(year);
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  for (const deadline of deadlines) {
    const due = new Date(deadline.dueDate + 'T00:00:00');
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      return {
        dueDate: deadline.dueDate,
        daysRemaining: diffDays,
        quarter: deadline.quarter,
      };
    }
  }

  // All deadlines passed for this year, return Q1 of next year
  const nextYearDeadlines = getQuarterlyDueDates(year + 1);
  const nextDue = new Date(nextYearDeadlines[0].dueDate + 'T00:00:00');
  const diffDays = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    dueDate: nextYearDeadlines[0].dueDate,
    daysRemaining: diffDays,
    quarter: 1,
  };
}
