/**
 * Parse a currency string like "1,250.00" or "1250.00" into cents.
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Format cents to display currency string.
 * e.g., 125000 -> "$1,250.00"
 */
export function formatCurrency(amountCents: number, currencyCode: string = 'USD'): string {
  const amount = amountCents / 100;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const symbol = getCurrencySymbol(currencyCode);
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${symbol}${formatted}`;
}

export function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '\u20AC',
    GBP: '\u00A3',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '\u00A5',
  };
  return symbols[code] ?? `${code} `;
}

/**
 * Format ISO date string to short display.
 * e.g., "2024-03-15" -> "Mar 15"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format ISO date string to long display.
 * e.g., "2024-03-15" -> "March 15, 2024"
 */
export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get month name from 1-12
 */
export function getMonthName(month: number): string {
  return new Date(2024, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

/**
 * Get the current quarter (1-4) from a month
 */
export function getQuarter(month: number): 1 | 2 | 3 | 4 {
  return Math.ceil(month / 3) as 1 | 2 | 3 | 4;
}

/**
 * Quarterly due dates for US estimated taxes (2024/2025)
 */
export function getQuarterlyDueDates(year: number): Array<{ quarter: number; dueDate: string; label: string }> {
  return [
    { quarter: 1, dueDate: `${year}-04-15`, label: 'Q1 (Jan-Mar)' },
    { quarter: 2, dueDate: `${year}-06-15`, label: 'Q2 (Apr-May)' },
    { quarter: 3, dueDate: `${year}-09-15`, label: 'Q3 (Jun-Aug)' },
    { quarter: 4, dueDate: `${year + 1}-01-15`, label: 'Q4 (Sep-Dec)' },
  ];
}

/**
 * Days until a due date (negative if overdue)
 */
export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
