/**
 * The one place a stored `Security` becomes a provider-addressable instrument.
 *
 * Before this module, each provider service built its own symbol, so a new
 * market meant the same decision made in several files that could disagree.
 * Everything a provider needs to address an instrument is derived here:
 *
 *   1. **alias** -- a ticker the exchange has since renamed (`TATAMOTORS` ->
 *      `TMPV`) is rewritten from `instrument_aliases`. This is a fact about the
 *      exchange and lives in the database.
 *   2. **provider formatting** -- the provider's own spelling of that symbol
 *      (Yahoo's `.NS` / `.BO` suffixes for NSE / BSE). This is a rule and lives
 *      in code.
 *   3. **scheme code** -- an Indian mutual fund is addressed by its AMFI scheme
 *      code, not by a ticker at all.
 *
 * The alias is applied *before* formatting, and both are reported back so a
 * caller can tell the user which symbol was actually fetched.
 *
 * Deliberately pure: the alias set is passed in, so the mapping is testable
 * without a database and a provider call never reaches into storage.
 */

export type ProviderName = "yahoo" | "msn" | "amfi";

/** The identity fields on a `Security` this mapping reads. */
export interface InstrumentIdentity {
  symbol: string;
  exchange?: string | null;
  currencyCode: string;
  isin?: string | null;
  amfiSchemeCode?: string | null;
  msnInstrumentId?: string | null;
}

/** Resolves a retired ticker to the one the exchange uses now. */
export interface AliasLookup {
  canonicalSymbol(exchange: string | null, symbol: string): string | null;
}

/** No aliases: the mapping with formatting only. Used by callers with no store. */
export const NO_ALIASES: AliasLookup = { canonicalSymbol: () => null };

export interface ProviderInstrument {
  provider: ProviderName;
  /** The symbol as stored on the security, before alias or formatting. */
  requestedSymbol: string;
  /** What to send to the provider. */
  fetchSymbol: string;
  exchange: string | null;
  currencyCode: string;
  isin: string | null;
  amfiSchemeCode: string | null;
  msnInstrumentId: string | null;
  /** Set when an alias rewrote the symbol; null when the stored one stood. */
  aliasApplied: { from: string; to: string } | null;
}

/**
 * Suffixes Yahoo appends to a locally-quoted ticker, keyed by upper-cased
 * exchange code. An empty string is a market Yahoo addresses bare (the US
 * listings), and an exchange absent from the table is also bare.
 *
 * This is the single authority for the exchange -> Yahoo suffix decision:
 * `YahooFinanceService.getYahooSymbol` reads it rather than keeping a second
 * copy, so a market added here cannot be honored by one path and missed by the
 * other. Legacy spellings (`TORONTO`, `TSX VENTURE`, `LONDON`) are kept because
 * instruments imported from other tools carry them as free text.
 */
export const EXCHANGE_SYMBOL_SUFFIX: Record<string, string> = {
  // Canada
  TSX: ".TO",
  TSE: ".TO",
  TORONTO: ".TO",
  "TORONTO STOCK EXCHANGE": ".TO",
  "TSX-V": ".V",
  "TSX VENTURE": ".V",
  TSXV: ".V",
  CSE: ".CN",
  "CANADIAN SECURITIES EXCHANGE": ".CN",
  NEO: ".NE",
  // United States -- bare
  NYSE: "",
  NASDAQ: "",
  AMEX: "",
  ARCA: "",
  // Europe
  LSE: ".L",
  LONDON: ".L",
  FRANKFURT: ".F",
  XETRA: ".DE",
  PARIS: ".PA",
  // Asia-Pacific
  TOKYO: ".T",
  "HONG KONG": ".HK",
  HKEX: ".HK",
  ASX: ".AX",
  // India
  NSE: ".NS",
  BSE: ".BO",
};

/**
 * The Yahoo spelling of `symbol` for a given exchange, without asking whether
 * the symbol is already qualified. `getYahooSymbol` wraps this with the
 * already-qualified check; `toProviderInstrument` applies that check itself.
 */
export function applyExchangeSuffix(
  symbol: string,
  exchange: string | null | undefined,
): string {
  const normalized = normalizeExchange(exchange);
  if (!normalized) return symbol;
  const suffix = EXCHANGE_SYMBOL_SUFFIX[normalized.toUpperCase()] ?? "";
  return `${symbol}${suffix}`;
}

/** Trim + upper-case, the form every comparison and lookup uses. */
export function normalizeSymbol(symbol: string | null | undefined): string {
  return (symbol ?? "").trim().toUpperCase();
}

/** Trim an exchange code, preserving the casing the user's picker stored. */
export function normalizeExchange(
  exchange: string | null | undefined,
): string | null {
  const trimmed = (exchange ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A symbol that already names its venue -- `RELIANCE.NS`, `BRK.B`, `^NSEI` --
 * is not given a second suffix. Yahoo's convention is that a dotted symbol and
 * an index caret are already fully qualified.
 */
export function isProviderQualified(symbol: string): boolean {
  return symbol.includes(".") || symbol.startsWith("^");
}

/**
 * Map an instrument to the identifier one provider expects.
 *
 * Returns `null` when the provider cannot address the instrument at all -- an
 * AMFI lookup for a security with no scheme code, or an empty symbol. A null is
 * "this provider cannot serve it", which is a different answer from a fetch
 * that fails, and callers route on it rather than retrying.
 */
export function toProviderInstrument(
  identity: InstrumentIdentity,
  provider: ProviderName,
  aliases: AliasLookup = NO_ALIASES,
): ProviderInstrument | null {
  const requestedSymbol = normalizeSymbol(identity.symbol);
  if (requestedSymbol === "") return null;

  const exchange = normalizeExchange(identity.exchange);

  const base = {
    requestedSymbol,
    exchange,
    currencyCode: identity.currencyCode,
    isin: identity.isin ?? null,
    amfiSchemeCode: identity.amfiSchemeCode ?? null,
    msnInstrumentId: identity.msnInstrumentId ?? null,
  };

  // An Indian mutual fund is addressed by its AMFI code alone; a ticker is not
  // a synonym for it, and an alias cannot apply to a scheme code.
  if (provider === "amfi") {
    const schemeCode = (identity.amfiSchemeCode ?? "").trim();
    if (schemeCode === "") return null;
    return {
      ...base,
      provider,
      fetchSymbol: schemeCode,
      aliasApplied: null,
    };
  }

  const canonical = aliases.canonicalSymbol(exchange, requestedSymbol);
  const aliasApplied =
    canonical && normalizeSymbol(canonical) !== requestedSymbol
      ? { from: requestedSymbol, to: normalizeSymbol(canonical) }
      : null;
  const effectiveSymbol = aliasApplied ? aliasApplied.to : requestedSymbol;

  // MSN addresses an instrument by its resolved SecId, which travels on
  // `msnInstrumentId`; the symbol it is handed is the bare one, never a Yahoo
  // suffix.
  if (provider === "msn") {
    return { ...base, provider, fetchSymbol: effectiveSymbol, aliasApplied };
  }

  if (isProviderQualified(effectiveSymbol)) {
    return { ...base, provider, fetchSymbol: effectiveSymbol, aliasApplied };
  }

  const suffix = exchange
    ? (EXCHANGE_SYMBOL_SUFFIX[exchange.toUpperCase()] ?? "")
    : "";
  return {
    ...base,
    provider,
    fetchSymbol: `${effectiveSymbol}${suffix}`,
    aliasApplied,
  };
}
