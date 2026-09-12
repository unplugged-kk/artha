import {
  buildNavQuote,
  parseMfapiDate,
  parseMfapiSchemePayload,
  parseMfapiSearch,
  parseNav,
  parseNavHistory,
} from "./mfapi-payload.util";
import { getTradingDateFromQuote } from "./trading-date.util";

/** A realistic mfapi `/mf/{code}` payload: newest first, NAVs as strings. */
const SCHEME_PAYLOAD = {
  meta: {
    fund_house: "Example Mutual Fund",
    scheme_type: "Open Ended Schemes",
    scheme_category: "Equity Scheme - Large Cap Fund",
    scheme_code: 122639,
    scheme_name: "Example Large Cap Fund - Direct Plan - Growth",
  },
  data: [
    { date: "28-08-2026", nav: "123.4567" },
    { date: "27-08-2026", nav: "122.1000" },
    { date: "26-08-2026", nav: "121.5000" },
  ],
  status: "SUCCESS",
};

const NOW = new Date("2026-08-29T06:00:00Z");

describe("parseMfapiDate", () => {
  it("converts dd-mm-yyyy to an ISO calendar date", () => {
    expect(parseMfapiDate("28-08-2026")).toBe("2026-08-28");
    expect(parseMfapiDate("01-01-2026")).toBe("2026-01-01");
  });

  it("accepts a leap day only in a leap year", () => {
    expect(parseMfapiDate("29-02-2024")).toBe("2024-02-29");
    expect(parseMfapiDate("29-02-2026")).toBeNull();
  });

  it.each([
    ["an impossible day", "30-02-2026"],
    ["a thirteenth month", "01-13-2026"],
    ["an inverted format", "2026-08-28"],
    ["a single-digit field", "8-08-2026"],
    ["empty", ""],
  ])("refuses %s", (_label, value) => {
    expect(parseMfapiDate(value)).toBeNull();
  });

  it("refuses a non-string", () => {
    expect(parseMfapiDate(20260828)).toBeNull();
    expect(parseMfapiDate(null)).toBeNull();
  });
});

describe("parseNav", () => {
  it("reads a decimal NAV as a number", () => {
    expect(parseNav("123.4567")).toBe(123.4567);
    expect(parseNav(10.5)).toBe(10.5);
    expect(parseNav("  99.9  ")).toBe(99.9);
  });

  it("treats zero and negative as missing, not as a value", () => {
    // No scheme has a NAV of 0; letting it through would value a holding at
    // nothing, which is the same failure as a missing price becoming zero.
    expect(parseNav("0")).toBeNull();
    expect(parseNav(0)).toBeNull();
    expect(parseNav("-1.5")).toBeNull();
  });

  it("refuses unparseable input", () => {
    expect(parseNav("")).toBeNull();
    expect(parseNav("N/A")).toBeNull();
    expect(parseNav("Infinity")).toBeNull();
    expect(parseNav(null)).toBeNull();
    expect(parseNav(undefined)).toBeNull();
  });
});

describe("parseNavHistory", () => {
  it("returns the series oldest first", () => {
    const history = parseNavHistory(SCHEME_PAYLOAD);
    expect(history.map((p) => p.date)).toEqual([
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
    ]);
  });

  it("skips an unusable row without discarding the scheme", () => {
    const history = parseNavHistory({
      data: [
        { date: "28-08-2026", nav: "123.4567" },
        { date: "not-a-date", nav: "1.0" },
        { date: "27-08-2026", nav: "0" },
        { date: "26-08-2026", nav: "121.5" },
      ],
    });
    expect(history.map((p) => p.date)).toEqual(["2026-08-26", "2026-08-28"]);
  });

  it("returns nothing when the payload has no data array", () => {
    expect(parseNavHistory({})).toEqual([]);
    expect(parseNavHistory(null)).toEqual([]);
  });
});

describe("parseMfapiSchemePayload", () => {
  it("reads the latest observation and the name", () => {
    const scheme = parseMfapiSchemePayload(SCHEME_PAYLOAD, NOW)!;
    expect(scheme.schemeCode).toBe("122639");
    expect(scheme.nav).toBe(123.4567);
    expect(scheme.navDate).toBe("2026-08-28");
    expect(scheme.schemeName).toContain("Example Large Cap Fund");
  });

  it("accepts a scheme code given as a string too", () => {
    const scheme = parseMfapiSchemePayload(
      {
        ...SCHEME_PAYLOAD,
        meta: { ...SCHEME_PAYLOAD.meta, scheme_code: "122639" },
      },
      NOW,
    );
    expect(scheme?.schemeCode).toBe("122639");
  });

  it("returns null rather than zero when there is no usable NAV", () => {
    expect(parseMfapiSchemePayload({ meta: {}, data: [] }, NOW)).toBeNull();
    expect(
      parseMfapiSchemePayload(
        { meta: {}, data: [{ date: "28-08-2026", nav: "0" }] },
        NOW,
      ),
    ).toBeNull();
  });

  it("refuses a NAV dated in the future", () => {
    // Storing a future NAV would put a price on a date the market has not
    // reached; the whole payload is unusable rather than silently shifted.
    const future = {
      meta: { scheme_code: 122639 },
      data: [{ date: "01-09-2026", nav: "150.0000" }],
    };
    expect(parseMfapiSchemePayload(future, NOW)).toBeNull();
  });

  it("tolerates a missing name", () => {
    const scheme = parseMfapiSchemePayload(
      { meta: { scheme_code: 1 }, data: [{ date: "28-08-2026", nav: "10" }] },
      NOW,
    )!;
    expect(scheme.schemeName).toBeNull();
  });
});

describe("buildNavQuote", () => {
  const quote = buildNavQuote({
    schemeCode: "122639",
    nav: 123.4567,
    navDate: "2026-08-28",
  })!;

  it("carries the NAV as the price and INR as the currency", () => {
    expect(quote.regularMarketPrice).toBe(123.4567);
    expect(quote.currencyCode).toBe("INR");
    expect(quote.provider).toBe("amfi");
  });

  it("dates the quote on the NAV's own day, not on the day it was fetched", () => {
    // The property that matters downstream: the derived price_date is the NAV
    // date, so a NAV is never filed under "today" merely because we asked today.
    expect(getTradingDateFromQuote(quote).toISOString().slice(0, 10)).toBe(
      "2026-08-28",
    );
  });

  it("declares the Indian session and zone for that date", () => {
    expect(quote.exchangeTimezone).toBe("Asia/Kolkata");
    expect(new Date(quote.regularSession!.start * 1000).toISOString()).toBe(
      "2026-08-28T03:45:00.000Z",
    );
  });

  it("refuses to build a quote for an impossible date", () => {
    expect(
      buildNavQuote({ schemeCode: "1", nav: 10, navDate: "2026-02-30" }),
    ).toBeNull();
  });
});

describe("parseMfapiSearch", () => {
  it("maps candidates to Indian mutual funds", () => {
    const results = parseMfapiSearch([
      { schemeCode: 122639, schemeName: "Example Large Cap Fund" },
      { schemeCode: "119551", schemeName: "Another Fund" },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      symbol: "122639",
      name: "Example Large Cap Fund",
      exchange: null,
      securityType: "MUTUAL_FUND",
      currencyCode: "INR",
      provider: "amfi",
    });
  });

  it("skips a row with no code or no name", () => {
    expect(
      parseMfapiSearch([
        { schemeCode: 1, schemeName: "" },
        { schemeName: "No code" },
        { schemeCode: 2, schemeName: "Kept" },
      ]).map((r) => r.symbol),
    ).toEqual(["2"]);
  });

  it("returns nothing for a non-array response", () => {
    expect(parseMfapiSearch({ error: "nope" })).toEqual([]);
  });
});
