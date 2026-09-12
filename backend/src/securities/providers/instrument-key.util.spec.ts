import {
  AliasLookup,
  EXCHANGE_SYMBOL_SUFFIX,
  NO_ALIASES,
  applyExchangeSuffix,
  isProviderQualified,
  normalizeExchange,
  normalizeSymbol,
  toProviderInstrument,
} from "./instrument-key.util";

/** An alias set built from `(exchange, alias) -> canonical` pairs. */
function aliases(entries: Array<[string, string, string]>): AliasLookup {
  const map = new Map(
    entries.map(([exchange, alias, canonical]) => [
      `${exchange.toUpperCase()}:${alias.toUpperCase()}`,
      canonical,
    ]),
  );
  return {
    canonicalSymbol: (exchange, symbol) =>
      map.get(`${(exchange ?? "").toUpperCase()}:${symbol.toUpperCase()}`) ??
      null,
  };
}

const nasdaqStock = {
  symbol: "AAPL",
  exchange: "NASDAQ",
  currencyCode: "USD",
};

describe("normalizeSymbol / normalizeExchange", () => {
  it("upper-cases and trims a symbol", () => {
    expect(normalizeSymbol("  reliance ")).toBe("RELIANCE");
  });

  it("trims an exchange but preserves its casing", () => {
    expect(normalizeExchange("  NSE ")).toBe("NSE");
    expect(normalizeExchange("Frankfurt")).toBe("Frankfurt");
  });

  it("reads a blank exchange as absent", () => {
    expect(normalizeExchange("   ")).toBeNull();
    expect(normalizeExchange(null)).toBeNull();
  });
});

describe("isProviderQualified", () => {
  it.each(["BRK.B", "RELIANCE.NS", "^NSEI"])("treats %s as qualified", (s) => {
    expect(isProviderQualified(s)).toBe(true);
  });

  it.each(["AAPL", "RELIANCE", "TMPV"])("treats %s as bare", (s) => {
    expect(isProviderQualified(s)).toBe(false);
  });
});

describe("toProviderInstrument — Yahoo symbol formatting", () => {
  it("sends a US symbol bare, with no suffix", () => {
    expect(toProviderInstrument(nasdaqStock, "yahoo")?.fetchSymbol).toBe(
      "AAPL",
    );
  });

  it.each([
    ["NSE", "RELIANCE", "RELIANCE.NS"],
    ["BSE", "RELIANCE", "RELIANCE.BO"],
    ["NASDAQ", "AAPL", "AAPL"],
    // TSX is not bare on Yahoo: the exchange table is now the provider's own,
    // so a Canadian listing resolves the way the provider has always spelled it.
    ["TSX", "XEQT", "XEQT.TO"],
  ])("maps %s %s -> %s", (exchange, symbol, expected) => {
    expect(
      toProviderInstrument({ symbol, exchange, currencyCode: "USD" }, "yahoo")
        ?.fetchSymbol,
    ).toBe(expected);
  });

  it("normalizes a lower-case symbol and exchange", () => {
    expect(
      toProviderInstrument(
        { symbol: "reliance", exchange: "nse", currencyCode: "INR" },
        "yahoo",
      )?.fetchSymbol,
    ).toBe("RELIANCE.NS");
  });

  it("leaves an already-qualified symbol alone, never double-suffixing", () => {
    expect(
      toProviderInstrument(
        { symbol: "RELIANCE.NS", exchange: "NSE", currencyCode: "INR" },
        "yahoo",
      )?.fetchSymbol,
    ).toBe("RELIANCE.NS");
    expect(
      toProviderInstrument(
        { symbol: "BRK.B", exchange: "NYSE", currencyCode: "USD" },
        "yahoo",
      )?.fetchSymbol,
    ).toBe("BRK.B");
  });

  it("leaves an index caret alone", () => {
    expect(
      toProviderInstrument(
        { symbol: "^NSEI", exchange: "NSE", currencyCode: "INR" },
        "yahoo",
      )?.fetchSymbol,
    ).toBe("^NSEI");
  });

  it("does not suffix when the exchange is unknown", () => {
    expect(
      toProviderInstrument(
        { symbol: "RELIANCE", exchange: null, currencyCode: "INR" },
        "yahoo",
      )?.fetchSymbol,
    ).toBe("RELIANCE");
  });

  it("carries the India exchanges alongside the long-standing ones", () => {
    // The table is the single authority the Yahoo provider reads, so it holds
    // every market, not only the two this phase added.
    expect(EXCHANGE_SYMBOL_SUFFIX.NSE).toBe(".NS");
    expect(EXCHANGE_SYMBOL_SUFFIX.BSE).toBe(".BO");
    expect(EXCHANGE_SYMBOL_SUFFIX.TSX).toBe(".TO");
    expect(EXCHANGE_SYMBOL_SUFFIX.LSE).toBe(".L");
    expect(EXCHANGE_SYMBOL_SUFFIX.NYSE).toBe("");
  });

  it("applies a suffix from the shared table, and leaves other markets bare", () => {
    expect(applyExchangeSuffix("RELIANCE", "NSE")).toBe("RELIANCE.NS");
    expect(applyExchangeSuffix("RELIANCE", "bse")).toBe("RELIANCE.BO");
    expect(applyExchangeSuffix("XEQT", "TSX")).toBe("XEQT.TO");
    expect(applyExchangeSuffix("AAPL", "NASDAQ")).toBe("AAPL");
    expect(applyExchangeSuffix("AAPL", "  nasdaq  ")).toBe("AAPL");
    expect(applyExchangeSuffix("RELIANCE", null)).toBe("RELIANCE");
    expect(applyExchangeSuffix("RELIANCE", "UNKNOWN_VENUE")).toBe("RELIANCE");
  });
});

describe("toProviderInstrument — alias resolution", () => {
  const renamed = aliases([["NSE", "TATAMOTORS", "TMPV"]]);

  it("rewrites a retired ticker before applying the suffix", () => {
    const result = toProviderInstrument(
      { symbol: "TATAMOTORS", exchange: "NSE", currencyCode: "INR" },
      "yahoo",
      renamed,
    );
    expect(result?.fetchSymbol).toBe("TMPV.NS");
    expect(result?.requestedSymbol).toBe("TATAMOTORS");
    expect(result?.aliasApplied).toEqual({ from: "TATAMOTORS", to: "TMPV" });
  });

  it("applies an alias on an exchange with no suffix rule", () => {
    // FB -> META is an exchange rename on a market Yahoo addresses bare, so the
    // alias must still be applied even though no suffix follows it.
    const result = toProviderInstrument(
      { symbol: "FB", exchange: "NASDAQ", currencyCode: "USD" },
      "yahoo",
      aliases([["NASDAQ", "FB", "META"]]),
    );
    expect(result?.fetchSymbol).toBe("META");
    expect(result?.aliasApplied).toEqual({ from: "FB", to: "META" });
  });

  it("does not report an alias when the canonical symbol is the same", () => {
    const identityOnly = aliases([["NSE", "TMPV", "TMPV"]]);
    const result = toProviderInstrument(
      { symbol: "TMPV", exchange: "NSE", currencyCode: "INR" },
      "yahoo",
      identityOnly,
    );
    expect(result?.fetchSymbol).toBe("TMPV.NS");
    expect(result?.aliasApplied).toBeNull();
  });

  it("does not apply an alias from another exchange", () => {
    const result = toProviderInstrument(
      { symbol: "TATAMOTORS", exchange: "BSE", currencyCode: "INR" },
      "yahoo",
      renamed,
    );
    expect(result?.fetchSymbol).toBe("TATAMOTORS.BO");
    expect(result?.aliasApplied).toBeNull();
  });

  it("reports no alias when no lookup is supplied", () => {
    const result = toProviderInstrument(
      { symbol: "TATAMOTORS", exchange: "NSE", currencyCode: "INR" },
      "yahoo",
      NO_ALIASES,
    );
    expect(result?.fetchSymbol).toBe("TATAMOTORS.NS");
    expect(result?.aliasApplied).toBeNull();
  });
});

describe("toProviderInstrument — MSN", () => {
  it("hands MSN the bare symbol, never a Yahoo suffix", () => {
    const result = toProviderInstrument(
      { symbol: "RELIANCE", exchange: "NSE", currencyCode: "INR" },
      "msn",
    );
    expect(result?.fetchSymbol).toBe("RELIANCE");
  });

  it("still resolves an alias, because MSN also needs the current ticker", () => {
    const result = toProviderInstrument(
      { symbol: "ZOMATO", exchange: "NSE", currencyCode: "INR" },
      "msn",
      aliases([["NSE", "ZOMATO", "ETERNAL"]]),
    );
    expect(result?.fetchSymbol).toBe("ETERNAL");
    expect(result?.aliasApplied).toEqual({ from: "ZOMATO", to: "ETERNAL" });
  });
});

describe("toProviderInstrument — AMFI", () => {
  it("addresses a fund by its scheme code, not its ticker", () => {
    const result = toProviderInstrument(
      {
        symbol: "SOME FUND",
        exchange: null,
        currencyCode: "INR",
        amfiSchemeCode: "122639",
      },
      "amfi",
    );
    expect(result?.fetchSymbol).toBe("122639");
    expect(result?.aliasApplied).toBeNull();
  });

  it("refuses when the security has no scheme code", () => {
    expect(
      toProviderInstrument(
        { symbol: "SOME FUND", exchange: null, currencyCode: "INR" },
        "amfi",
      ),
    ).toBeNull();
  });

  it("refuses a blank scheme code", () => {
    expect(
      toProviderInstrument(
        {
          symbol: "SOME FUND",
          exchange: null,
          currencyCode: "INR",
          amfiSchemeCode: "   ",
        },
        "amfi",
      ),
    ).toBeNull();
  });
});

describe("toProviderInstrument — carry-through and refusal", () => {
  it("returns null for an empty symbol, whatever the provider", () => {
    for (const provider of ["yahoo", "msn", "amfi"] as const) {
      expect(
        toProviderInstrument(
          { symbol: "   ", exchange: "NSE", currencyCode: "INR" },
          provider,
        ),
      ).toBeNull();
    }
  });

  it("carries identity fields through unchanged", () => {
    const result = toProviderInstrument(
      {
        symbol: "RELIANCE",
        exchange: "NSE",
        currencyCode: "INR",
        isin: "INE002A01018",
        amfiSchemeCode: null,
        msnInstrumentId: "abc123",
      },
      "yahoo",
    );
    expect(result).toMatchObject({
      provider: "yahoo",
      requestedSymbol: "RELIANCE",
      fetchSymbol: "RELIANCE.NS",
      exchange: "NSE",
      currencyCode: "INR",
      isin: "INE002A01018",
      amfiSchemeCode: null,
      msnInstrumentId: "abc123",
    });
  });
});
