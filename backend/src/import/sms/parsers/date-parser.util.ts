/**
 * Utility for parsing dates found in Indian bank SMS messages into YYYY-MM-DD format.
 */

const MONTH_MAP: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

/**
 * Normalizes 2-digit or 4-digit year into a 4-digit year string.
 */
function normalizeYear(yearStr: string): string {
  if (yearStr.length === 2) {
    const y = parseInt(yearStr, 10);
    // Standard century pivot: 70-99 -> 19xx, 00-69 -> 20xx
    return y >= 70 ? `19${yearStr}` : `20${yearStr}`;
  }
  return yearStr;
}

/**
 * Formats day and month with leading zero and validates ranges.
 */
function toIsoDate(
  yearStr: string,
  monthStr: string,
  dayStr: string,
): string | null {
  const year = parseInt(normalizeYear(yearStr), 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 2000 || year > 2099) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Basic day of month validation
  const maxDays = new Date(year, month, 0).getDate();
  if (day > maxDays) return null;

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Extracts a date from an Indian bank SMS string.
 * Supported patterns:
 *   - "14-09-26", "14-09-2026", "14/09/26", "14/09/2026"
 *   - "14-Sep-26", "14-Sep-2026", "14/Sep/26"
 *   - "14Sep26", "14Sep2026"
 *   - "2026-09-14"
 */
export function extractTransactionDate(message: string): string | null {
  if (!message) return null;

  // 1. ISO format: 2026-09-14
  const isoMatch = message.match(
    /\b(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/,
  );
  if (isoMatch) {
    return toIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  // 2. Month name with hyphens or slashes or spaces: "14-Sep-26", "14-Sep-2026", "14 Sep 2026"
  const alphaMatch = message.match(
    /\b([0-2]?\d|3[01])[-/ ](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-/ ](\d{2}|\d{4})\b/i,
  );
  if (alphaMatch) {
    const day = alphaMatch[1];
    const month = MONTH_MAP[alphaMatch[2].toUpperCase()];
    const year = alphaMatch[3];
    return toIsoDate(year, month, day);
  }

  // 3. Compact month name: "14Sep26", "14Sep2026"
  const compactAlphaMatch = message.match(
    /\b([0-2]?\d|3[01])(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2}|\d{4})\b/i,
  );
  if (compactAlphaMatch) {
    const day = compactAlphaMatch[1];
    const month = MONTH_MAP[compactAlphaMatch[2].toUpperCase()];
    const year = compactAlphaMatch[3];
    return toIsoDate(year, month, day);
  }

  // 4. Numeric Indian format: "14-09-26", "14-09-2026", "14/09/26", "14/09/2026"
  const numericMatch = message.match(
    /\b([0-2]?\d|3[01])[-/](0[1-9]|1[0-2])[-/](\d{2}|\d{4})\b/,
  );
  if (numericMatch) {
    const day = numericMatch[1];
    const month = numericMatch[2];
    const year = numericMatch[3];
    return toIsoDate(year, month, day);
  }

  return null;
}

/**
 * Returns extracted transaction date, or today's date in YYYY-MM-DD if none is found.
 */
export function extractDateOrDefaultToday(message: string): string {
  const extracted = extractTransactionDate(message);
  if (extracted) return extracted;

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
