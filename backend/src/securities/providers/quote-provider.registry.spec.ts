import { Test, TestingModule } from "@nestjs/testing";
import { QuoteProviderRegistry } from "./quote-provider.registry";
import { YahooFinanceService } from "../yahoo-finance.service";
import { MsnFinanceService } from "../msn-finance.service";
import { AmfiNavService } from "../amfi-nav.service";
import { Security } from "../entities/security.entity";

describe("QuoteProviderRegistry", () => {
  let registry: QuoteProviderRegistry;

  const yahooMock = { name: "yahoo" } as unknown as YahooFinanceService;
  const msnMock = { name: "msn" } as unknown as MsnFinanceService;
  const amfiMock = { name: "amfi" } as unknown as AmfiNavService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteProviderRegistry,
        { provide: YahooFinanceService, useValue: yahooMock },
        { provide: MsnFinanceService, useValue: msnMock },
        { provide: AmfiNavService, useValue: amfiMock },
      ],
    }).compile();
    registry = module.get(QuoteProviderRegistry);
  });

  it("getByName resolves yahoo and msn", () => {
    expect(registry.getByName("yahoo").name).toBe("yahoo");
    expect(registry.getByName("msn").name).toBe("msn");
  });

  it("resolveForSecurity honors the security's explicit override", () => {
    const security = { quoteProvider: "msn" } as Security;
    const ordered = registry.resolveForSecurity(security, "yahoo");
    expect(ordered.map((p) => p.name)).toEqual(["msn", "yahoo"]);
  });

  it("resolveForSecurity falls back to user default when security has no override", () => {
    const security = { quoteProvider: null } as Security;
    const ordered = registry.resolveForSecurity(security, "msn");
    expect(ordered.map((p) => p.name)).toEqual(["msn", "yahoo"]);
  });

  it("resolveForSecurity falls back to yahoo when both security and user have no preference", () => {
    const security = { quoteProvider: null } as Security;
    const ordered = registry.resolveForSecurity(security, null);
    expect(ordered.map((p) => p.name)).toEqual(["yahoo", "msn"]);
  });

  it("listAll returns both selectable providers", () => {
    expect(
      registry
        .listAll()
        .map((p) => p.name)
        .sort(),
    ).toEqual(["msn", "yahoo"]);
  });

  it("never lists AMFI as a fallback for an ordinary instrument", () => {
    // AMFI is reachable only through instrument identity; if it appeared in
    // listAll it would be tried for every equity.
    expect(registry.listAll().map((p) => p.name)).not.toContain("amfi");
  });

  it("resolves a scheme-coded fund to AMFI alone", () => {
    // No equity provider can price a scheme number, so trying them would only
    // spend round trips to fail.
    const security = {
      quoteProvider: null,
      amfiSchemeCode: "122639",
    } as Security;
    expect(
      registry.resolveForSecurity(security, "yahoo").map((p) => p.name),
    ).toEqual(["amfi"]);
  });

  it("lets identity win over a stored override", () => {
    // A fund routed by its scheme code must not be sent to Yahoo because a
    // stale override says so.
    const security = {
      quoteProvider: "msn",
      amfiSchemeCode: "122639",
    } as Security;
    expect(
      registry.resolveForSecurity(security, "msn").map((p) => p.name),
    ).toEqual(["amfi"]);
  });

  it("treats a blank scheme code as no identity at all", () => {
    const security = { quoteProvider: null, amfiSchemeCode: "   " } as Security;
    expect(
      registry.resolveForSecurity(security, null).map((p) => p.name),
    ).toEqual(["yahoo", "msn"]);
  });
});
