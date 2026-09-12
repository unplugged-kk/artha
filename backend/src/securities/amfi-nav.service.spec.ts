import { AmfiNavService } from "./amfi-nav.service";
import { createTestProviderHealth } from "../test-helpers/provider-health-testing";

/** A realistic mfapi `/mf/{code}` body. Deterministic: no network in this spec. */
const SCHEME_PAYLOAD = {
  meta: {
    scheme_code: 122639,
    scheme_name: "Example Large Cap Fund - Direct Plan - Growth",
    scheme_category: "Equity Scheme - Large Cap Fund",
  },
  data: [
    { date: "28-08-2026", nav: "123.4567" },
    { date: "27-08-2026", nav: "122.1000" },
  ],
  status: "SUCCESS",
};

const SEARCH_PAYLOAD = [
  { schemeCode: 122639, schemeName: "Example Large Cap Fund" },
  { schemeCode: 119551, schemeName: "Another Fund" },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("AmfiNavService", () => {
  let service: AmfiNavService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new AmfiNavService(createTestProviderHealth());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("addressing", () => {
    it("is the amfi provider", () => {
      expect(service.name).toBe("amfi");
    });

    it.each([
      ["no options", undefined],
      ["no instrument id", {}],
      ["a blank id", { instrumentId: "  " }],
      ["a non-numeric id", { instrumentId: "RELIANCE" }],
    ])(
      "refuses to fetch with %s instead of guessing a symbol",
      async (_l, opts) => {
        // Free-text identity is what the foundation contract forbids; an
        // unaddressable instrument is null, and no request is made.
        await expect(
          service.fetchQuote("SOME FUND", null, opts as never),
        ).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it("addresses the scheme code, not the ticker", async () => {
      fetchMock.mockResolvedValue(jsonResponse(SCHEME_PAYLOAD));
      await service.fetchQuote("IGNORED TICKER", null, {
        instrumentId: "122639",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.mfapi.in/mf/122639",
        expect.anything(),
      );
    });
  });

  describe("a NAV quote", () => {
    it("carries the NAV, INR, and the NAV's own date", async () => {
      fetchMock.mockResolvedValue(jsonResponse(SCHEME_PAYLOAD));
      const quote = await service.fetchQuote("x", null, {
        instrumentId: "122639",
      });

      expect(quote?.regularMarketPrice).toBe(123.4567);
      expect(quote?.currencyCode).toBe("INR");
      expect(quote?.provider).toBe("amfi");
      // The derived trading date must be the NAV's day, not the fetch day.
      expect(service.getTradingDate(quote!).toISOString().slice(0, 10)).toBe(
        "2026-08-28",
      );
      expect(quote?.exchangeTimezone).toBe("Asia/Kolkata");
    });
  });

  describe("missing data is null, never zero", () => {
    it("returns null when the provider answers with an HTTP error", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false, 503));
      await expect(
        service.fetchQuote("x", null, { instrumentId: "122639" }),
      ).resolves.toBeNull();
    });

    it("returns null when the transport throws", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNRESET"));
      await expect(
        service.fetchQuote("x", null, { instrumentId: "122639" }),
      ).resolves.toBeNull();
    });

    it("returns null when the payload carries no usable NAV", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ meta: { scheme_code: 1 }, data: [] }),
      );
      await expect(
        service.fetchQuote("x", null, { instrumentId: "1" }),
      ).resolves.toBeNull();
    });

    it("returns null rather than a zero NAV", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          meta: { scheme_code: 1 },
          data: [{ date: "28-08-2026", nav: "0" }],
        }),
      );
      await expect(
        service.fetchQuote("x", null, { instrumentId: "1" }),
      ).resolves.toBeNull();
    });
  });

  describe("caching", () => {
    it("reuses a scheme fetch within the TTL", async () => {
      fetchMock.mockResolvedValue(jsonResponse(SCHEME_PAYLOAD));
      await service.fetchQuote("x", null, { instrumentId: "122639" });
      await service.fetchQuote("x", null, { instrumentId: "122639" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not cache a failure", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false, 500));
      await service.fetchQuote("x", null, { instrumentId: "122639" });
      await service.fetchQuote("x", null, { instrumentId: "122639" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("history", () => {
    it("returns the series oldest first, with no invented OHLC", async () => {
      fetchMock.mockResolvedValue(jsonResponse(SCHEME_PAYLOAD));
      const history = await service.fetchHistorical("x", null, undefined, {
        instrumentId: "122639",
      });
      expect(history?.map((p) => p.date.toISOString().slice(0, 10))).toEqual([
        "2026-08-27",
        "2026-08-28",
      ]);
      expect(history?.[0]).toMatchObject({
        open: null,
        high: null,
        low: null,
        adjClose: null,
        volume: null,
      });
      expect(history?.[1].close).toBe(123.4567);
    });

    it("clips to an explicit window", async () => {
      fetchMock.mockResolvedValue(jsonResponse(SCHEME_PAYLOAD));
      const window = await service.fetchHistoricalWindow(
        "x",
        null,
        new Date("2026-08-28T00:00:00Z"),
        new Date("2026-08-31T00:00:00Z"),
        { instrumentId: "122639" },
      );
      expect(window?.map((p) => p.date.toISOString().slice(0, 10))).toEqual([
        "2026-08-28",
      ]);
    });

    it("returns null rather than an empty series when it cannot address the scheme", async () => {
      await expect(
        service.fetchHistorical("x", null, undefined, {}),
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("lookup", () => {
    it("returns fund candidates carrying their scheme code", async () => {
      fetchMock.mockResolvedValue(jsonResponse(SEARCH_PAYLOAD));
      const results = await service.lookupSecurityMany("large cap");
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        symbol: "122639",
        securityType: "MUTUAL_FUND",
        currencyCode: "INR",
        provider: "amfi",
        amfiSchemeCode: "122639",
      });
    });

    it("returns no candidates for a blank query, without calling out", async () => {
      await expect(service.lookupSecurityMany("   ")).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("answers a lookup failure with an empty list, not an error", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      await expect(service.lookupSecurityMany("anything")).resolves.toEqual([]);
    });
  });

  it("reports no sector or ETF weightings, because a NAV has none", async () => {
    await expect(service.fetchStockSectorInfo()).resolves.toBeNull();
    await expect(service.fetchEtfSectorWeightings()).resolves.toBeNull();
  });
});
