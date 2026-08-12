/**
 * Accounting year helpers.
 *
 * Supports two fiscal modes:
 *  - "calendar" — the year runs 1 Jan – 31 Dec (default).
 *  - "fiscal" — the year runs from a configurable start month/day.
 *
 * These functions let the dashboard and reports scope "this year",
 * year-to-date, and monthly windows to the user's configured accounting
 * year instead of always assuming a calendar year.
 */

export interface AccountingYearPrefs {
  /** "calendar" or "fiscal" */
  fyType: string;
  /** 1–12, only used when fyType === "fiscal" */
  startMonth: number;
  /** 1–31, only used when fyType === "fiscal" */
  startDay: number;
}

export interface YearWindow {
  /** Human label, e.g. "2025" for calendar or "2025–26" for fiscal. */
  label: string;
  /** First day of the year window, YYYY-MM-DD. */
  start: string;
  /** Last day of the year window, YYYY-MM-DD. */
  end: string;
  /** The calendar year the window's start date falls in. */
  startYear: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Compute the accounting-year window that contains `date`.
 *
 * For fiscal years the window starts on the configured month/day of the
 * year prior (or the same year, depending on where the start falls) so that
 * the returned window always wraps the given date.
 */
export function accountingYearWindow(
  prefs: AccountingYearPrefs,
  date: Date,
): YearWindow {
  const { fyType, startMonth, startDay } = prefs;

  if (fyType !== "fiscal") {
    const year = date.getFullYear();
    return {
      label: String(year),
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      startYear: year,
    };
  }

  const sm = Math.min(12, Math.max(1, startMonth || 1));
  const sd = Math.min(31, Math.max(1, startDay || 1));
  const year = date.getFullYear();

  // Candidate window starts on (year-1)-sm-sd and wraps around into year.
  // Check whether `date` falls inside it; if not, the window begins in the
  // same year.
  const startYear =
    date.getMonth() + 1 < sm ||
    (date.getMonth() + 1 === sm && date.getDate() < sd)
      ? year - 1
      : year;

  const startDate = `${startYear}-${pad(sm)}-${pad(
    Math.min(sd, daysInMonth(startYear, sm)),
  )}`;
  const endYear = startYear + 1;
  const endDate = `${endYear}-${pad(sm)}-${pad(
    Math.min(sd, daysInMonth(endYear, sm)) - 1,
  )}`;

  return {
    label: `${startYear}–${String(endYear).slice(2)}`,
    start: startDate,
    end: endDate,
    startYear,
  };
}

/**
 * Parse stored preference strings into AccountingYearPrefs.
 */
export function parseAccountingYearPrefs(
  fyType: string | null | undefined,
  startMonth: string | null | undefined,
  startDay: string | null | undefined,
): AccountingYearPrefs {
  return {
    fyType: fyType || "calendar",
    startMonth: parseInt(startMonth || "1", 10) || 1,
    startDay: parseInt(startDay || "1", 10) || 1,
  };
}
