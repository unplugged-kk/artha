import { SECURITY_TYPES, assetClassForSecurityType } from "./security-enums";

/**
 * The canonical instrument-type list, pinned.
 *
 * It is consumed by the securities DTO/entity, the AI assistant's tool schema,
 * the MCP `create_security` tool and the frontend pickers, so a value added or
 * removed here changes what the whole product accepts. The list is restated in
 * this test on purpose: a change then fails a named test instead of quietly
 * widening (or narrowing) every consumer at once.
 */
const EXPECTED = [
  // Long-standing types.
  "STOCK",
  "ETF",
  "MUTUAL_FUND",
  "BOND",
  "OPTION",
  "GIC",
  "REIT",
  "GOLD",
  "CRYPTO",
  "CASH",
  "OTHER",
  // India instrument pack (Phase 3): tracked holdings with no exchange listing.
  "PPF",
  "EPF",
  "NPS",
  "FD",
  "RD",
  "SGB",
  "ESOP",
  "ULIP",
];

describe("SECURITY_TYPES", () => {
  it("pins the canonical set", () => {
    expect([...SECURITY_TYPES]).toEqual(EXPECTED);
  });

  it("lists each type once", () => {
    expect(new Set(SECURITY_TYPES).size).toBe(SECURITY_TYPES.length);
  });

  it("uses upper-case identifiers, matching the stored column's convention", () => {
    for (const type of SECURITY_TYPES) {
      expect(type).toBe(type.toUpperCase());
      expect(type).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});

describe("assetClassForSecurityType", () => {
  it("classifies the instrument types whose asset class is definite", () => {
    expect(assetClassForSecurityType("STOCK")).toBe("Equity");
    expect(assetClassForSecurityType("BOND")).toBe("Fixed Income");
    expect(assetClassForSecurityType("CASH")).toBe("Cash");
    expect(assetClassForSecurityType("CRYPTO")).toBe("Crypto");
    expect(assetClassForSecurityType("REIT")).toBe("Real Estate");
    expect(assetClassForSecurityType("GOLD")).toBe("Gold");
    expect(assetClassForSecurityType("SGB")).toBe("Gold");
    expect(assetClassForSecurityType("PPF")).toBe("Fixed Income");
    expect(assetClassForSecurityType("EPF")).toBe("Fixed Income");
    expect(assetClassForSecurityType("FD")).toBe("Fixed Income");
    expect(assetClassForSecurityType("RD")).toBe("Fixed Income");
    expect(assetClassForSecurityType("ESOP")).toBe("Equity");
  });

  it("leaves a mixed instrument unclassified rather than guessing a bucket", () => {
    // A pension and a unit-linked plan each hold an equity/debt mix the type
    // alone does not state, so their value belongs in the unclassified
    // remainder rather than in a made-up asset class.
    expect(assetClassForSecurityType("NPS")).toBeNull();
    expect(assetClassForSecurityType("ULIP")).toBeNull();
    expect(assetClassForSecurityType("MUTUAL_FUND")).toBeNull();
    expect(assetClassForSecurityType("ETF")).toBeNull();
  });

  it("returns null for an absent type", () => {
    expect(assetClassForSecurityType(null)).toBeNull();
    expect(assetClassForSecurityType(undefined)).toBeNull();
    expect(assetClassForSecurityType("")).toBeNull();
  });

  it("does not claim a mapping for a type outside the canonical list", () => {
    expect(assetClassForSecurityType("NOT_A_REAL_TYPE")).toBeNull();
  });
});
