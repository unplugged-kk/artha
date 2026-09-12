import { QuoteResult, SecurityLookupResult } from "./quote-provider.interface";
import {
  INDIA_MARKET_TIMEZONE,
  istCalendarDate,
  istSessionEpochs,
} from "./india-market.util";

/**
 * Pure parsing of the AMFI/mfapi.in payload.
 *
 * Kept out of the service so the shape rules -- which NAV counts as a NAV, which
 * date is a date, what a missing value becomes -- are testable against fixtures
 * with no network and no clock, and so a live smoke check is the only thing that
 * ever needs the network.
 *
 * Everything here follows one rule from the financial-calculation contract: a
 * value that is absent, unparseable, zero or negative is **missing**, and
 * missing is `null` -- never `0`. A fund whose NAV could not be read is worth an
 * unknown amount, not nothing.
 */

export interface NavPoint {
  /** Market calendar date, `YYYY-MM-DD`. */
  date: string;
  nav: number;
}

export interface MfapiScheme {
  schemeCode: string;
  schemeName: string | null;
  /** The most recent usable observation. */
  nav: number;
  navDate: string;
  /** Usable observations, oldest first. */
  history: NavPoint[];
}

/**
 * `dd-mm-yyyy` (the one format mfapi emits) as `YYYY-MM-DD`, or null.
 *
 * The round trip through `Date.UTC` is what rejects a date the calendar does not
 * have: JavaScript normalizes 30 February into March rather than refusing it.
 */
export function parseMfapiDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utc);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * A NAV as a number, or null.
 *
 * Zero and negative NAVs are treated as absent: no Indian mutual-fund scheme has
 * a NAV of zero, so a `0` here is a broken field, and letting it through would
 * value a real holding at nothing -- the same failure as substituting zero for a
 * missing price.
 */
export function parseNav(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeSchemeCode(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value))
    return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^\d{1,10}$/.test(trimmed) ? trimmed : null;
  }
  return null;
}

/**
 * The usable observations from a `/mf/{code}` response, oldest first.
 *
 * Rows with an unreadable date or NAV are skipped rather than failing the whole
 * scheme: a single bad row is not a reason to report the fund as unpriceable,
 * but it must not be silently treated as a zero either.
 */
export function parseNavHistory(json: unknown): NavPoint[] {
  const rows = (json as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];
  const points: NavPoint[] = [];
  for (const row of rows) {
    const date = parseMfapiDate((row as { date?: unknown })?.date);
    const nav = parseNav((row as { nav?: unknown })?.nav);
    if (date === null || nav === null) continue;
    points.push({ date, nav });
  }
  // Newest first upstream; callers want the series ascending.
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return points;
}

/**
 * A whole `/mf/{code}` response as a scheme, or null when it carries no usable
 * observation.
 *
 * `now` exists so the "a NAV dated in the future is bad data" rule is testable
 * without freezing the clock. Future-dated NAVs are refused because storing one
 * would put a price on a date the market has not reached.
 */
export function parseMfapiSchemePayload(
  json: unknown,
  now: Date = new Date(),
): MfapiScheme | null {
  const meta = (json as { meta?: Record<string, unknown> })?.meta;
  const schemeCode = normalizeSchemeCode(meta?.scheme_code);
  const history = parseNavHistory(json);
  if (history.length === 0) return null;

  const today = istCalendarDate(now);
  const usable = history.filter((point) => point.date <= today);
  if (usable.length === 0) return null;

  const latest = usable[usable.length - 1];
  const schemeName =
    typeof meta?.scheme_name === "string" && meta.scheme_name.trim() !== ""
      ? meta.scheme_name.trim()
      : null;

  return {
    schemeCode: schemeCode ?? "",
    schemeName,
    nav: latest.nav,
    navDate: latest.date,
    history: usable,
  };
}

/**
 * The `/mf/search` response as lookup candidates.
 *
 * mfapi's search returns scheme codes and names only, so nothing is claimed
 * about the exchange or currency beyond what an Indian fund is.
 */
export function parseMfapiSearch(json: unknown): SecurityLookupResult[] {
  if (!Array.isArray(json)) return [];
  const results: SecurityLookupResult[] = [];
  for (const row of json) {
    const code = normalizeSchemeCode(
      (row as { schemeCode?: unknown })?.schemeCode,
    );
    const name = (row as { schemeName?: unknown })?.schemeName;
    if (code === null || typeof name !== "string" || name.trim() === "")
      continue;
    results.push({
      symbol: code,
      name: name.trim(),
      exchange: null,
      securityType: "MUTUAL_FUND",
      currencyCode: "INR",
      provider: "amfi",
      amfiSchemeCode: code,
    });
  }
  return results;
}

/**
 * A NAV as a quote.
 *
 * A NAV is a **settled daily value**, not a live print, so the quote carries the
 * NAV's own date rather than "now": `regularMarketTime` is midday UTC on the NAV
 * date, which is what makes the derived `price_date` the NAV date and not the
 * day the fetch happened. The session is the NSE window for that date, so the
 * stored market session and the settlement check work exactly as they do for an
 * Indian equity.
 */
export function buildNavQuote(scheme: {
  schemeCode: string;
  nav: number;
  navDate: string;
}): QuoteResult | null {
  const session = istSessionEpochs(scheme.navDate);
  if (!session) return null;
  const midpoint = Math.floor(
    Date.UTC(
      Number(scheme.navDate.slice(0, 4)),
      Number(scheme.navDate.slice(5, 7)) - 1,
      Number(scheme.navDate.slice(8, 10)),
      12,
    ) / 1000,
  );
  return {
    symbol: scheme.schemeCode,
    regularMarketPrice: scheme.nav,
    regularMarketTime: midpoint,
    exchangeTimezone: INDIA_MARKET_TIMEZONE,
    regularSession: session,
    currencyCode: "INR",
    provider: "amfi",
  };
}
