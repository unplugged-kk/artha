import { NotFoundException } from "@nestjs/common";
import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { SecuritiesModule } from "@/securities/securities.module";
import { PerformanceComparisonService } from "@/securities/performance-comparison.service";
import { SecurityPriceService } from "@/securities/security-price.service";
import { AmfiNavService } from "@/securities/amfi-nav.service";
import { Security } from "@/securities/entities/security.entity";
import type { FundComparisonView } from "@/securities/performance-comparison.types";
import { computeRollingReturns } from "@/securities/rolling-returns.util";
import {
  createIntegrationModule,
  cleanTables,
  createTestUserDirect,
} from "../helpers/integration-setup";
import { withUserContext } from "@/common/db/with-context";

/**
 * `today` is pinned, as in the rolling-returns spec: the oracles below are
 * dated, and a test that reads the wall clock is a test about today's date.
 */
jest.mock("../../src/common/date-utils", () => ({
  ...jest.requireActual("../../src/common/date-utils"),
  todayYMD: jest.fn(() => "2026-07-01"),
}));

/**
 * I1 and I3 of `docs/specs/fund-categories-and-comparison.md`, against real
 * PostgreSQL through the real service and price loader.
 *
 * What only a database can show: the comparison reads the same rows the rolling
 * card does (`amfi_nav` + `manual`, raw close), so a transaction-derived `buy`
 * row and a stray `adjusted_close` must change no figure (I1); and ownership is
 * checked before anything is read or fetched, so another user's id is a 404 that
 * leaves `historical_backfill_attempted_at` untouched (I3).
 */
describe("Fund comparison (integration)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: PerformanceComparisonService;
  let backfill: jest.SpyInstance;
  let classificationFetch: jest.SpyInstance;
  let userId: string;

  /** FX-A: sparse on purpose, so every window is hand-computable. */
  const FX_A: Array<[string, number]> = [
    ["2021-06-30", 80],
    ["2023-06-30", 100],
    ["2025-06-30", 160],
    ["2026-06-30", 200],
  ];
  /** FX-A with a different final NAV, so the two funds disagree. */
  const FX_B: Array<[string, number]> = [
    ["2021-06-30", 80],
    ["2023-06-30", 100],
    ["2025-06-30", 160],
    ["2026-06-30", 240],
  ];
  const TODAY = "2026-07-01";

  beforeAll(async () => {
    module = await createIntegrationModule([SecuritiesModule]);
    dataSource = module.get(DataSource);
    service = module.get(PerformanceComparisonService);
    backfill = jest.spyOn(
      module.get(SecurityPriceService),
      "backfillSecurityRange",
    );
    classificationFetch = jest.spyOn(
      module.get(AmfiNavService),
      "fetchSchemeClassification",
    );
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  beforeEach(async () => {
    await cleanTables(dataSource, ["security_prices", "securities", "users"]);
    backfill.mockReset();
    backfill.mockResolvedValue(0);
    classificationFetch.mockReset();
    classificationFetch.mockResolvedValue(null);
    userId = (await createTestUserDirect(dataSource)).id;
  });

  let nextSchemeCode = 129550;

  async function fund(
    ownerId: string,
    options: {
      category?: string | null;
      amfiSchemeCode?: string | null;
      house?: string | null;
    } = {},
  ): Promise<string> {
    const saved = await dataSource.manager.save(
      dataSource.manager.create(Security, {
        userId: ownerId,
        symbol: `FC${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        name: "Fund comparison test fund",
        securityType: options.amfiSchemeCode === null ? "STOCK" : "MUTUAL_FUND",
        currencyCode: "INR",
        amfiSchemeCode:
          options.amfiSchemeCode === undefined
            ? String(++nextSchemeCode)
            : options.amfiSchemeCode,
        fundHouse: options.house ?? "Example Mutual Fund",
        fundSchemeType: "Open Ended Schemes",
        fundCategory: options.category ?? null,
        // Fresh, so the capture sweep is skipped and the provider is untouched.
        fundClassificationUpdatedAt: new Date(),
      }),
    );
    return saved.id;
  }

  async function seed(
    securityId: string,
    rows: Array<[string, number]>,
    source = "amfi_nav",
    adjustedClose: number | null = null,
  ): Promise<void> {
    for (const [date, close] of rows) {
      await dataSource.query(
        `INSERT INTO security_prices
           (security_id, price_date, close_price, adjusted_close, source)
         VALUES ($1, $2::date, $3, $4, $5)`,
        [securityId, date, close, adjustedClose, source],
      );
    }
  }

  const compare = (asUser: string, ids: string[]) =>
    withUserContext(asUser, () =>
      service.getFundComparison(asUser, ids),
    ) as Promise<FundComparisonView>;

  const periodsOf = (view: FundComparisonView, securityId: string) => {
    const member = view.members.find((m) => m.securityId === securityId);
    if (!member) throw new Error(`member ${securityId} missing`);
    return member.periods;
  };

  it("reports each fund's own distribution, exactly as the engine computes it", async () => {
    const a = await fund(userId, {
      category: "Equity Scheme - Large Cap Fund",
    });
    const b = await fund(userId, {
      category: "Equity Scheme - Large Cap Fund",
    });
    await seed(a, FX_A);
    // B differs in its last NAV only.
    await seed(b, FX_B);

    const view = await compare(userId, [a, b]);

    const expectedA = computeRollingReturns(
      FX_A.map(([date, close]) => ({ date, close })),
      TODAY,
    );
    const expectedB = computeRollingReturns(
      FX_B.map(([date, close]) => ({ date, close })),
      TODAY,
    );
    expect(periodsOf(view, a)).toEqual(expectedA.periods);
    expect(periodsOf(view, b)).toEqual(expectedB.periods);
    // Two different funds are two different answers, not one repeated.
    expect(periodsOf(view, a)).not.toEqual(periodsOf(view, b));
  });

  it("ignores a transaction-derived row and a stray adjusted close", async () => {
    const a = await fund(userId, {
      category: "Equity Scheme - Large Cap Fund",
    });
    await seed(a, FX_A);
    // A buy price on a date that would otherwise be a window start, and an
    // adjusted close that would switch the whole series if the basis were
    // chosen by presence (both are excluded by the rolling basis rule).
    await dataSource.query(
      `INSERT INTO security_prices
         (security_id, price_date, close_price, adjusted_close, source)
       VALUES ($1, '2022-06-27'::date, 1, NULL, 'buy')`,
      [a],
    );
    await dataSource.query(
      `UPDATE security_prices SET adjusted_close = close_price * 10
         WHERE security_id = $1 AND source = 'amfi_nav'`,
      [a],
    );

    const view = await compare(userId, [a]);

    const expected = computeRollingReturns(
      FX_A.map(([date, close]) => ({ date, close })),
      TODAY,
    );
    expect(periodsOf(view, a)).toEqual(expected.periods);
    expect(view.members[0].history.observationCount).toBe(FX_A.length);
  });

  it("groups by category with Unclassified last, and reports a non-fund without reading it", async () => {
    const large = await fund(userId, {
      category: "Equity Scheme - Large Cap Fund",
    });
    const small = await fund(userId, {
      category: "Equity Scheme - Small Cap Fund",
    });
    const unclassified = await fund(userId, { category: null });
    const stock = await fund(userId, {
      category: null,
      amfiSchemeCode: null,
    });
    await seed(large, FX_A);
    await seed(small, FX_A);
    await seed(unclassified, FX_A);
    await seed(stock, FX_A);

    const view = await compare(userId, [small, unclassified, large, stock]);

    expect(view.groups).toEqual([
      {
        category: "Equity Scheme - Large Cap Fund",
        securityIds: [large],
      },
      {
        category: "Equity Scheme - Small Cap Fund",
        securityIds: [small],
      },
      { category: null, securityIds: [unclassified, stock] },
    ]);
    const stockMember = view.members.find((m) => m.securityId === stock)!;
    expect(stockMember.eligibility).toBe("NOT_AN_AMFI_FUND");
    expect(stockMember.periods).toEqual([]);
    expect(stockMember.history.observationCount).toBe(0);
    expect(view.status).toBe("incomplete");
  });

  it("refuses another user's fund before reading or fetching anything", async () => {
    const owner = await createTestUserDirect(dataSource);
    const a = await fund(owner.id, {
      category: "Equity Scheme - Large Cap Fund",
    });
    await seed(a, FX_A);
    const before = await dataSource.manager.findOne(Security, {
      where: { id: a },
    });

    await expect(compare(userId, [a])).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const after = await dataSource.manager.findOne(Security, {
      where: { id: a },
    });
    expect(after?.historicalBackfillAttemptedAt ?? null).toEqual(
      before?.historicalBackfillAttemptedAt ?? null,
    );
    expect(backfill).not.toHaveBeenCalled();
  });
});
