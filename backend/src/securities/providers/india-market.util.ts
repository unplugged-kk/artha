/**
 * The one place India's market clock is defined.
 *
 * Everything that needs to know when the Indian market is open, or which
 * calendar day an instant falls on in India, reads it from here -- the AMFI NAV
 * provider, the trading-day check and (later) the holiday calendar. Scattering
 * `"Asia/Kolkata"` or a `+05:30` across services is how a market ends up open in
 * one code path and closed in another.
 *
 * **Why a fixed offset is correct here and not a hack.** India has observed a
 * single timezone (UTC+05:30) with no daylight saving since 1945, so the offset
 * is a property of the market, not a guess about the runtime. The exchanges
 * themselves are the authority for the session window (NSE/BSE regular session
 * 09:15-15:30 IST), and a holiday is what makes a weekday a non-trading day --
 * see `isIndianTradingDay`.
 *
 * The rule this module exists to enforce, from the time-series contract: an
 * instant is stored in UTC, a calendar day is derived in the *market's* zone,
 * and the server's local zone is never consulted.
 */

/** The IANA zone every Indian venue quotes its session in. */
export const INDIA_MARKET_TIMEZONE = "Asia/Kolkata";

/** India Standard Time offset from UTC. Fixed: India has no DST. */
export const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** NSE/BSE regular session, as local wall-clock time. */
export const NSE_SESSION = {
  openTime: "09:15:00",
  closeTime: "15:30:00",
} as const;

/** The calendar date (`YYYY-MM-DD`) an instant falls on in India. */
export function istCalendarDate(instant: Date): string {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The session window for one Indian trading date, as epoch seconds.
 *
 * `date` is the market's own calendar date (`YYYY-MM-DD`); the result is the
 * instant that date's session opened and closed, which is what the quote shape
 * carries (`regularSession`). Returns null for a date that is not a real
 * calendar day rather than inventing one.
 */
export function istSessionEpochs(
  date: string,
): { start: number; end: number } | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  if (Number.isNaN(utcMidnight)) return null;
  // Reject a date the calendar does not have rather than letting Date.UTC roll
  // it forward: 2026-02-30 becomes March, and 2026-13-01 becomes January 2027.
  const roundTrip = new Date(utcMidnight);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }

  const startMinutes = 9 * 60 + 15;
  const endMinutes = 15 * 60 + 30;
  const dayStart = utcMidnight - IST_OFFSET_MINUTES * 60_000;
  return {
    start: Math.floor((dayStart + startMinutes * 60_000) / 1000),
    end: Math.floor((dayStart + endMinutes * 60_000) / 1000),
  };
}

/**
 * Whether an Indian exchange trades on a calendar date.
 *
 * Weekends are closed. **Holidays are not yet modelled** -- that is the
 * remaining Phase 2 work, and it lands here as a table plus an override list
 * rather than in a caller, so every consumer inherits it at once. Until then
 * this answers the weekend question only, which is why it is deliberately named
 * for what it does and does not claim to know.
 */
export function isIndianWeekday(date: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const utc = Date.UTC(year, month - 1, day);
  if (Number.isNaN(utc)) return false;
  const roundTrip = new Date(utc);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return false;
  }
  const weekday = roundTrip.getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

// ---------------------------------------------------------------------------
// Indian trading calendar
// ---------------------------------------------------------------------------

/** A full-day closure of the Indian exchanges. */
export interface MarketHoliday {
  /** `YYYY-MM-DD`. */
  date: string;
  name: string;
}

/**
 * Statutory national closures. These three fall on the same date every year and
 * the exchanges are shut for the whole session, so they are the only closures
 * that can be stated without a source.
 *
 * Nothing else is encoded here on purpose. India's remaining market holidays
 * move with the lunar calendar (Holi, Good Friday, Eid, Diwali, Muhurat...), and
 * a date recalled rather than sourced is an *invented* holiday -- worse than an
 * uncurated one, because it silently mis-dates a settlement and nobody can tell
 * it was a guess. `INDIAN_CALENDAR_SOURCE` names where the variable list comes
 * from, and `indianCalendarComplete` is how a caller learns whether it has been
 * curated yet.
 */
const FIXED_NATIONAL_CLOSURES: readonly {
  month: number;
  day: number;
  name: string;
}[] = [
  { month: 1, day: 26, name: "Republic Day" },
  { month: 8, day: 15, name: "Independence Day" },
  { month: 10, day: 2, name: "Gandhi Jayanti" },
];

/** Where the variable-date closures are published: the curation source. */
export const INDIAN_CALENDAR_SOURCE =
  "NSE/BSE published annual trading-holiday list";

/**
 * Variable-date closures by year, once curated.
 *
 * Empty until someone transcribes the exchanges' published list. Entries here
 * are data, not logic: adding a year is what flips `indianCalendarComplete`.
 */
const VARIABLE_CLOSURES: Record<number, readonly MarketHoliday[]> = {};

/**
 * Whether the variable-date list for a year has been curated.
 *
 * `false` means an "open" verdict rests on the weekday and the statutory
 * closures alone: it is "no *known* closure", not a claim that the exchange
 * traded. Callers that must not assume (anything that writes a settlement row)
 * can read this rather than trusting the verdict blindly.
 */
export function indianCalendarComplete(year: number): boolean {
  return VARIABLE_CLOSURES[year] !== undefined;
}

export type IndiaMarketDay =
  | { kind: "weekend"; tradingDay: false }
  | { kind: "holiday"; tradingDay: false; name: string }
  | { kind: "trading"; tradingDay: true; calendarComplete: boolean };

/** The calendar day parts of a strictly-formed `YYYY-MM-DD`, or null. */
function parseCalendarDate(
  date: string,
): { year: number; month: number; day: number } | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const utc = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utc);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** The name of the closure on `date`, or null when none is known. */
export function indianHolidayName(date: string): string | null {
  const parts = parseCalendarDate(date);
  if (!parts) return null;

  for (const closure of FIXED_NATIONAL_CLOSURES) {
    if (parts.month === closure.month && parts.day === closure.day) {
      return closure.name;
    }
  }

  const curated = VARIABLE_CLOSURES[parts.year] ?? [];
  return curated.find((holiday) => holiday.date === date)?.name ?? null;
}

/**
 * What the Indian market does on a calendar date: shut for the weekend, shut for
 * a known closure, or open as far as the calendar knows.
 *
 * Returns null for a date that is not a real calendar day, so a caller cannot
 * mistake a malformed input for a trading day.
 */
export function indianMarketDay(date: string): IndiaMarketDay | null {
  const parts = parseCalendarDate(date);
  if (!parts) return null;

  const utc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const weekday = new Date(utc).getUTCDay();
  if (weekday === 0 || weekday === 6) {
    return { kind: "weekend", tradingDay: false };
  }

  const holiday = indianHolidayName(date);
  if (holiday) return { kind: "holiday", tradingDay: false, name: holiday };

  return {
    kind: "trading",
    tradingDay: true,
    calendarComplete: indianCalendarComplete(parts.year),
  };
}

/** ISO date `days` away from `date`, or null when `date` is malformed. */
function shiftDate(date: string, days: number): string | null {
  const parts = parseCalendarDate(date);
  if (!parts) return null;
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) + days * 86_400_000,
  );
  return shifted.toISOString().slice(0, 10);
}

/** Bounded so a malformed calendar can never spin a caller forever. */
const TRADING_DAY_SEARCH_LIMIT = 30;

/**
 * The next Indian trading day after `date` (or including it with
 * `inclusive: true`), or null when the search runs past the bound.
 *
 * It skips weekends and *known* closures. An uncurated variable holiday is not
 * skipped, because it is not known -- `indianCalendarComplete` is what tells a
 * caller whether that caveat applies to the year in question.
 */
export function nextIndianTradingDay(
  date: string,
  { inclusive = false }: { inclusive?: boolean } = {},
): string | null {
  let cursor = inclusive ? date : shiftDate(date, 1);
  if (cursor === null) return null;
  for (let step = 0; step < TRADING_DAY_SEARCH_LIMIT; step += 1) {
    const day = indianMarketDay(cursor);
    if (day?.tradingDay) return cursor;
    const advanced = shiftDate(cursor, 1);
    if (advanced === null) return null;
    cursor = advanced;
  }
  return null;
}

/** The previous Indian trading day before `date`; see `nextIndianTradingDay`. */
export function previousIndianTradingDay(
  date: string,
  { inclusive = false }: { inclusive?: boolean } = {},
): string | null {
  let cursor = inclusive ? date : shiftDate(date, -1);
  if (cursor === null) return null;
  for (let step = 0; step < TRADING_DAY_SEARCH_LIMIT; step += 1) {
    const day = indianMarketDay(cursor);
    if (day?.tradingDay) return cursor;
    const advanced = shiftDate(cursor, -1);
    if (advanced === null) return null;
    cursor = advanced;
  }
  return null;
}

/**
 * The Indian date a valuation should be struck on for an instant: the most
 * recent trading day at or before the instant's Indian calendar date.
 *
 * A price observed at the weekend or on a holiday belongs to the last day the
 * market actually traded, which is what a valuation or a period boundary has to
 * use. Returns null when the instant is unusable rather than inventing a date.
 */
export function effectiveIndianValuationDate(instant: Date): string | null {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    return null;
  }
  return previousIndianTradingDay(istCalendarDate(instant), {
    inclusive: true,
  });
}
