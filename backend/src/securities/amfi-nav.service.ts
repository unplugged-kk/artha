import { Injectable, Logger } from "@nestjs/common";
import {
  EtfSectorWeighting,
  HistoricalPrice,
  PriceProviderName,
  QuoteProvider,
  QuoteProviderOptions,
  QuoteResult,
  SecurityLookupResult,
  StockSectorInfo,
} from "./providers/quote-provider.interface";
import { getTradingDateFromQuote } from "./providers/trading-date.util";
import {
  buildNavQuote,
  parseMfapiSchemePayload,
  parseMfapiSearch,
} from "./providers/mfapi-payload.util";
import { ProviderHealthService } from "../provider-health/provider-health.service";
import { TrackedProviderId } from "../provider-health/providers";

/** This client's id in `provider_health` and in the circuit breaker. */
const HEALTH_PROVIDER_ID: TrackedProviderId = "amfi_nav";

const MFAPI_BASE = "https://api.mfapi.in";
const USER_AGENT = "Artha/1.0 (+https://github.com/unplugged-kk/artha)";
const FETCH_TIMEOUT_MS = 20_000;

/**
 * A NAV changes once per business day, so a fetch is worth reusing until the
 * next publication. Four hours keeps a daily refresh honest while absorbing the
 * repeated lookups an intraday page render would otherwise make.
 */
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const CACHE_MAX_SIZE = 500;

/**
 * The AMFI (mfapi.in) NAV source for Indian mutual-fund schemes.
 *
 * Three things about this provider are deliberate and load-bearing:
 *
 * **It is addressed by identity, not by a ticker.** Every method reads the AMFI
 * scheme code from `opts.instrumentId`, which the price pipeline fills from
 * `securities.amfi_scheme_code`. A missing or non-numeric code is "this provider
 * cannot address the instrument" (`null`), never a guess at a symbol -- free-text
 * investment identity is exactly what the foundation contract forbids.
 *
 * **A NAV is a settled daily value, not a live print.** The quote carries the
 * NAV's own date (`regularMarketTime` at midday UTC on the NAV date) and the NSE
 * session for that date, so the derived `price_date` is the day the NAV belongs
 * to rather than the day we happened to ask, and the existing settlement check
 * treats it like any other Indian close.
 *
 * **Missing is null, never zero.** An unreadable payload, an HTTP failure, a
 * zero/negative NAV or a future-dated NAV all produce `null`; nothing here can
 * fabricate a price, and there is no fallback to a different provider because no
 * other provider can price an Indian mutual fund.
 */
@Injectable()
export class AmfiNavService implements QuoteProvider {
  readonly name: PriceProviderName = "amfi";

  private readonly logger = new Logger(AmfiNavService.name);
  /** Scheme code -> payload, so one daily refresh reuses one fetch. */
  private readonly cache = new Map<
    string,
    { expiresAt: number; payload: unknown }
  >();

  constructor(private readonly health: ProviderHealthService) {}

  async fetchQuote(
    _symbol: string,
    _exchange: string | null,
    opts?: QuoteProviderOptions,
  ): Promise<QuoteResult | null> {
    const schemeCode = this.schemeCodeOf(opts);
    if (!schemeCode) return null;

    const payload = await this.loadScheme(schemeCode);
    if (!payload) return null;

    const scheme = parseMfapiSchemePayload(payload);
    if (!scheme) {
      this.logger.warn(
        `AMFI returned no usable NAV for scheme ${schemeCode}; reporting no price`,
      );
      return null;
    }

    return buildNavQuote({
      schemeCode,
      nav: scheme.nav,
      navDate: scheme.navDate,
    });
  }

  /**
   * The scheme's whole NAV series, oldest first.
   *
   * mfapi returns the full history from the same endpoint, so there is no
   * separate history call to make. `HistoricalPrice.open/high/low/volume` are
   * null: a NAV is a single daily number and inventing OHLC around it would be
   * fabricated market data.
   */
  async fetchHistorical(
    _symbol: string,
    _exchange: string | null,
    _range?: string,
    opts?: QuoteProviderOptions,
  ): Promise<HistoricalPrice[] | null> {
    return this.historyFor(opts);
  }

  /** The same series, clipped to an explicit window. */
  async fetchHistoricalWindow(
    _symbol: string,
    _exchange: string | null,
    fromDate: Date,
    toDate: Date,
    opts?: QuoteProviderOptions,
  ): Promise<HistoricalPrice[] | null> {
    const history = await this.historyFor(opts);
    if (!history) return null;
    return history.filter(
      (price) => price.date >= fromDate && price.date <= toDate,
    );
  }

  async lookupSecurity(
    query: string,
    _preferredExchanges?: string[],
  ): Promise<SecurityLookupResult | null> {
    const results = await this.lookupSecurityMany(query);
    return results[0] ?? null;
  }

  async lookupSecurityMany(query: string): Promise<SecurityLookupResult[]> {
    const trimmed = (query ?? "").trim();
    if (trimmed === "") return [];
    const payload = await this.getJson(
      `${MFAPI_BASE}/mf/search?q=${encodeURIComponent(trimmed)}`,
      `search for "${trimmed}"`,
    );
    return payload === null ? [] : parseMfapiSearch(payload);
  }

  /** A NAV has no sector breakdown and no holdings; not applicable. */
  async fetchStockSectorInfo(): Promise<StockSectorInfo | null> {
    return null;
  }

  /** mfapi publishes no portfolio breakdown, so nothing is claimed here. */
  async fetchEtfSectorWeightings(): Promise<EtfSectorWeighting[] | null> {
    return null;
  }

  getTradingDate(quote: QuoteResult): Date {
    return getTradingDateFromQuote(quote);
  }

  /** The scheme code the identity layer resolved, or null. */
  private schemeCodeOf(opts?: QuoteProviderOptions): string | null {
    const candidate = (opts?.instrumentId ?? "").trim();
    return /^\d{1,10}$/.test(candidate) ? candidate : null;
  }

  private async historyFor(
    opts?: QuoteProviderOptions,
  ): Promise<HistoricalPrice[] | null> {
    const schemeCode = this.schemeCodeOf(opts);
    if (!schemeCode) return null;
    const payload = await this.loadScheme(schemeCode);
    if (!payload) return null;
    const scheme = parseMfapiSchemePayload(payload);
    if (!scheme) return null;
    return scheme.history.map((point) => ({
      date: new Date(`${point.date}T00:00:00.000Z`),
      open: null,
      high: null,
      low: null,
      close: point.nav,
      adjClose: null,
      volume: null,
    }));
  }

  private async loadScheme(schemeCode: string): Promise<unknown | null> {
    const cached = this.cache.get(schemeCode);
    if (cached && cached.expiresAt > Date.now()) return cached.payload;

    const payload = await this.getJson(
      `${MFAPI_BASE}/mf/${schemeCode}`,
      `NAV for scheme ${schemeCode}`,
    );
    if (payload === null) return null;

    if (this.cache.size >= CACHE_MAX_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(schemeCode, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });
    return payload;
  }

  /**
   * One GET, with the shared circuit breaker around it.
   *
   * A refusal by the breaker and a transport failure are both `null` -- the
   * caller cannot do anything different about them -- but only a real attempt is
   * recorded as a failure, so an open breaker does not keep re-arming itself.
   */
  private async getJson(url: string, context: string): Promise<unknown | null> {
    if (this.health.wouldRefuse(HEALTH_PROVIDER_ID)) {
      this.logger.warn(`AMFI is currently unavailable; skipping ${context}`);
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.health.logFailure(
          this.logger,
          HEALTH_PROVIDER_ID,
          `AMFI ${context}`,
          new Error(`HTTP ${response.status}`),
        );
        return null;
      }
      const payload = await response.json();
      this.health.recordSuccess(HEALTH_PROVIDER_ID);
      return payload;
    } catch (error) {
      this.health.logFailure(
        this.logger,
        HEALTH_PROVIDER_ID,
        `AMFI ${context}`,
        error,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
