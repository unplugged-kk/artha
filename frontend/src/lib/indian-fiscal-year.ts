/**
 * The Indian financial year: 1 April to 31 March.
 *
 * One definition, in one place. Any component tempted to write
 * `date.getMonth() >= 3` is asking this module instead, because a boundary
 * that is right in one place and wrong in another is how a "this financial
 * year" figure stops matching the year it names.
 *
 * A fiscal year is *labelled by the calendar year it begins in*: FY 2026 runs
 * from 1 April 2026 to 31 March 2027. That is the convention the Indian
 * government, the exchanges and every Indian payslip use, and it is why the
 * label reads "2026-27" rather than "2026".
 *
 * Dates are calendar dates, not instants. Artha stores them as `YYYY-MM-DD`,
 * and a `Date` argument is read in **UTC** — the same convention the budget
 * date helpers use — so a timestamp near midnight cannot land in a different
 * financial year depending on where the reader's machine happens to be. A
 * caller holding a true instant that must be judged in India's own zone should
 * convert it to the Indian calendar date first (the trading calendar's
 * `Asia/Kolkata` helpers do exactly that); this module answers the calendar
 * question only.
 */

/** April. Both the month the Indian financial year starts and its whole point. */
const FISCAL_YEAR_START_MONTH = 4;

export interface FiscalYearRange {
  startDate: string;
  endDate: string;
}

/**
 * The calendar date of a `YYYY-MM-DD` string or a `Date`, as
 * `{ year, month, day }` in UTC, or null when it cannot be read.
 */
function calendarDate(
  input: string | Date,
): { year: number; month: number; day: number } | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return {
      year: input.getUTCFullYear(),
      month: input.getUTCMonth() + 1,
      day: input.getUTCDate(),
    };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((input ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * The financial year a date falls in, labelled by the year it starts in, or
 * null when the date cannot be read.
 *
 * On 31 March the answer is the year that is ending; on 1 April it is the year
 * that is beginning. Those two days are the whole boundary, so both are pinned
 * by tests.
 */
export function indianFiscalYearOf(input: string | Date): number | null {
  const date = calendarDate(input);
  if (!date) return null;
  return date.month >= FISCAL_YEAR_START_MONTH ? date.year : date.year - 1;
}

/** The first day of a financial year, `YYYY-04-01`. */
export function indianFiscalYearStart(fiscalYear: number): string {
  return `${String(fiscalYear).padStart(4, "0")}-04-01`;
}

/**
 * The last day of a financial year, `YYYY-03-31`.
 *
 * Deliberately a fixed date rather than a computed month length: March has 31
 * days in every year, leap or not, so the leap-year case that this convention
 * does have (29 February falling inside the year) needs no arithmetic here --
 * it is a day *within* the range, which is what the tests assert.
 */
export function indianFiscalYearEnd(fiscalYear: number): string {
  return `${String(fiscalYear + 1).padStart(4, "0")}-03-31`;
}

/** The financial year's inclusive range. */
export function indianFiscalYearRange(fiscalYear: number): FiscalYearRange {
  return {
    startDate: indianFiscalYearStart(fiscalYear),
    endDate: indianFiscalYearEnd(fiscalYear),
  };
}

/**
 * The label a reader recognises: `"2026-27"` for the year beginning April 2026.
 * The second half is the following year's last two digits, so a century reads
 * correctly (`"2099-00"`).
 */
export function indianFiscalYearLabel(fiscalYear: number): string {
  const ending = (fiscalYear + 1) % 100;
  return `${fiscalYear}-${String(ending).padStart(2, "0")}`;
}

/**
 * Whether two dates fall in the same financial year. Null when either date
 * cannot be read, so an unreadable date never answers "yes, same year".
 */
export function isSameIndianFiscalYear(
  a: string | Date,
  b: string | Date,
): boolean | null {
  const first = indianFiscalYearOf(a);
  const second = indianFiscalYearOf(b);
  if (first === null || second === null) return null;
  return first === second;
}
