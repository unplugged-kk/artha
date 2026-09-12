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
