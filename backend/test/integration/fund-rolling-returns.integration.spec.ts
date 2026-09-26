import { NotFoundException } from "@nestjs/common";
import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { SecuritiesModule } from "@/securities/securities.module";
import { PerformanceComparisonService } from "@/securities/performance-comparison.service";
import { SecurityPriceService } from "@/securities/security-price.service";
import { Security } from "@/securities/entities/security.entity";
import type {
  FundRollingReturnsView,
  RollingPeriodResult,
} from "@/securities/performance-comparison.types";
import {
  createIntegrationModule,
  cleanTables,
  createTestUserDirect,
} from "../helpers/integration-setup";
import { withUserContext } from "@/common/db/with-context";

/**
 * `today` is pinned: the spec's oracles are dated against 2026-07-01, and a
 * test that reads the wall clock is a test about today's date. Only
 * `todayYMD` is replaced; every other date helper stays real.
 */
jest.mock("../../src/common/date-utils", () => ({
  ...jest.requireActual("../../src/common/date-utils"),
  todayYMD: jest.fn(() => "2026-07-01"),
}));

/**
 * Fund rolling returns against a real PostgreSQL, through the real service
 * and the real price loader.
 *
 * The unit suite (`rolling-returns.util.spec.ts`) owns the arithmetic; what
 * only a database can show is which stored rows reach it. The loader's
 * `sources` filter and forced `RAW` basis are SQL, so a mocked `query` could
 * only assert they are *expressed* -- here a `buy` row that would resolve a
 * window if admitted, and a stray `adjusted_close` that would switch the basis
 * if honoured, sit in the table and must change nothing.
 *
 * Oracles are FX-A and its variants from `docs/specs/fund-rolling-returns.md`
 * section 8. The provider path of `ensureSecuritiesHistory` is stubbed so no
 * network is touched; the read must answer from what is stored either way.
 */
describe("Fund rolling returns (integration)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: PerformanceComparisonService;
  let backfill: jest.SpyInstance;
  let userId: string;

  /** FX-A: sparse on purpose, so every window is hand-computable. */
  const FX_A: Array<[string, number]> = [
    ["2021-06-30", 80],
    ["2023-06-30", 100],
    ["2025-06-30", 160],
    ["2026-06-30", 200],
  ];

  beforeAll(async () => {
    module = await createIntegrationModule([SecuritiesModule]);
    dataSource = module.get(DataSource);
    service = module.get(PerformanceComparisonService);
    backfill = jest.spyOn(
      module.get(SecurityPriceService),
      "backfillSecurityRange",
    );
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  beforeEach(async () => {
    await cleanTables(dataSource, ["security_prices", "securities", "users"]);
    backfill.mockReset();
    backfill.mockResolvedValue(0);
    userId = (await createTestUserDirect(dataSource)).id;
  });

  /** Scheme codes are unique per user, so each fund draws its own. */
  let nextSchemeCode = 119550;

  async function fund(
    ownerId: string,
    amfiSchemeCode: string | null = String(++nextSchemeCode),
  ): Promise<string> {
    const saved = await dataSource.manager.save(
      dataSource.manager.create(Security, {
        userId: ownerId,
        symbol: `RR${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        name: "Rolling returns test fund",
        securityType: "MUTUAL_FUND",
        currencyCode: "INR",
        amfiSchemeCode,
      }),
    );
    return saved.id;
  }

  async function price(
    securityId: string,
    date: string,
    close: number,
    source: string,
    adjustedClose: number | null = null,
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO security_prices
         (security_id, price_date, close_price, adjusted_close, source)
       VALUES ($1, $2::date, $3, $4, $5)`,
      [securityId, date, close, adjustedClose, source],
    );
  }

  async function seed(
    securityId: string,
    rows: Array<[string, number]>,
    source = "amfi_nav",
  ): Promise<void> {
    for (const [date, close] of rows) {
      await price(securityId, date, close, source);
    }
  }

  const read = (asUser: string, securityId: string) =>
    withUserContext(asUser, () =>
      service.getRollingReturns(asUser, securityId),
    ) as Promise<FundRollingReturnsView>;

  const period = (
    view: FundRollingReturnsView,
    p: RollingPeriodResult["period"],
  ): RollingPeriodResult => {
    const found = view.periods.find((r) => r.period === p);
    if (!found) throw new Error(`period ${p} missing from the response`);
    return found;
  };

  /** Every statistic of a one-window period equals that window. */
  const oneWindow = (
    returnPct: number,
    startDate: string,
    endDate: string,
  ) => ({
    status: "OK",
    windowCount: 1,
    min: { returnPct, startDate, endDate },
    max: { returnPct, startDate, endDate },
    median: returnPct,
    mean: returnPct,
    positiveShare: 100,
  });

  /** The FX-A 1Y answer, which every "must change nothing" case restates. */
  const FX_A_1Y = {
    ...oneWindow(25, "2025-06-30", "2026-06-30"),
    months: 12,
    annualized: false,
    completeness: "incomplete",
    missingWindowCount: 2,
    gaps: [{ from: "2023-06-30", to: "2025-06-30" }],
  };

  it("computes FX-A exactly from amfi_nav rows (spec section 8)", async () => {
    const id = await fund(userId);
    await seed(id, FX_A);

    const view = await read(userId, id);

    expect(view.securityId).toBe(id);
    expect(view.eligibility).toBe("ELIGIBLE");
    expect(view.currencyCode).toBe("INR");
    expect(view.periods.map((p) => p.period)).toEqual(["1Y", "3Y", "5Y"]);
    expect(view.history).toEqual({
      firstDate: "2021-06-30",
      lastDate: "2026-06-30",
      observationCount: 4,
      excludedObservationCount: 0,
      lastIsStale: false,
    });

    expect(period(view, "1Y")).toEqual({ period: "1Y", ...FX_A_1Y });
    expect(period(view, "3Y")).toEqual({
      period: "3Y",
      months: 36,
      annualized: true,
      completeness: "incomplete",
      missingWindowCount: 1,
      gaps: [{ from: "2025-06-30", to: "2025-06-30" }],
      // 2^(365.25/1096) - 1, d = 1096 across 2024-02-29.
      ...oneWindow(25.9855, "2023-06-30", "2026-06-30"),
    });
    expect(period(view, "5Y")).toEqual({
      period: "5Y",
      months: 60,
      annualized: true,
      completeness: "complete",
      missingWindowCount: 0,
      gaps: [],
      // 2.5^(365.25/1826) - 1: 365 would give 20.1004, nominal 1/5 20.1124.
      ...oneWindow(20.1155, "2021-06-30", "2026-06-30"),
    });
  });

  it("does not admit a transaction-derived price (negative control: drop the sources filter)", async () => {
    const id = await fund(userId);
    await seed(id, FX_A);
    // Admitted, this resolves the 1Y target 2024-06-30 for the 2025-06-30 end
    // (lag 2 days) and reports 160/1 - 1 = +15,900%.
    await price(id, "2024-06-28", 1, "buy");

    const view = await read(userId, id);

    expect(period(view, "1Y")).toEqual({ period: "1Y", ...FX_A_1Y });
    // Not loaded at all: neither usable nor counted as excluded.
    expect(view.history.observationCount).toBe(4);
    expect(view.history.excludedObservationCount).toBe(0);
  });

  it("ignores a stray adjusted_close on an amfi_nav row (negative control: drop basis RAW)", async () => {
    const id = await fund(userId);
    await seed(id, FX_A.slice(0, 3));
    // A pre-AMFI Yahoo value the upsert's COALESCE kept. Honoured, the loader
    // would switch to the adjusted basis and keep this one row only.
    await price(id, "2026-06-30", 200, "amfi_nav", 999);

    const clean = await fund(userId);
    await seed(clean, FX_A);

    const [withStray, withoutStray] = [
      await read(userId, id),
      await read(userId, clean),
    ];

    expect(withStray.periods).toEqual(withoutStray.periods);
    expect(withStray.history).toEqual(withoutStray.history);
    expect(period(withStray, "1Y").max?.returnPct).toBe(25);
  });

  it("honours a manual NAV correction over the provider's row", async () => {
    const id = await fund(userId);
    // UNIQUE(security_id, price_date): the manual row is the 2025-06-30 row.
    await seed(
      id,
      FX_A.filter(([date]) => date !== "2025-06-30"),
    );
    await price(id, "2025-06-30", 128, "manual");

    const view = await read(userId, id);

    // 200/128 - 1
    expect(period(view, "1Y")).toMatchObject({
      windowCount: 1,
      missingWindowCount: 2,
      median: 56.25,
      min: { returnPct: 56.25, startDate: "2025-06-30", endDate: "2026-06-30" },
    });
    expect(view.history.observationCount).toBe(4);
  });

  it("excludes a manual 0 and a future-dated row, falling back within the lag", async () => {
    const id = await fund(userId);
    await seed(
      id,
      FX_A.filter(([date]) => date !== "2025-06-30"),
    );
    await price(id, "2025-06-30", 0, "manual");
    await price(id, "2025-06-28", 150, "amfi_nav");
    // today + 1
    await price(id, "2026-07-02", 500, "manual");

    const view = await read(userId, id);

    expect(view.history).toEqual({
      firstDate: "2021-06-30",
      lastDate: "2026-06-30",
      observationCount: 4,
      excludedObservationCount: 2,
      lastIsStale: false,
    });
    // Target 2025-06-30 resolves to 2025-06-28 (2 days): 200/150 - 1.
    expect(period(view, "1Y")).toMatchObject({
      status: "OK",
      windowCount: 1,
      missingWindowCount: 2,
      max: {
        returnPct: 33.3333,
        startDate: "2025-06-28",
        endDate: "2026-06-30",
      },
    });
  });

  it("answers from stored rows when the provider backfill fails", async () => {
    const id = await fund(userId);
    // No 2021 row, so the 5Y start is not covered and the backfill is due.
    await seed(id, FX_A.slice(1));
    backfill.mockRejectedValue(new Error("mfapi unreachable"));

    const view = await read(userId, id);

    expect(backfill).toHaveBeenCalledTimes(1);
    expect(backfill.mock.calls[0][0]).toMatchObject({ id });
    expect(period(view, "1Y").median).toBe(25);
    expect(period(view, "3Y").median).toBe(25.9855);
    expect(period(view, "5Y")).toMatchObject({
      status: "INSUFFICIENT_HISTORY",
      windowCount: 0,
      missingWindowCount: 0,
      median: null,
      mean: null,
      min: null,
      max: null,
      positiveShare: null,
    });
  });

  it.each([
    ["null", null],
    ["blank", "   "],
  ])(
    "reports NOT_AN_AMFI_FUND for a %s scheme code without touching the provider",
    async (_label, code) => {
      const id = await fund(userId, code);
      await seed(id, FX_A);

      const view = await read(userId, id);

      expect(view).toEqual({
        securityId: id,
        eligibility: "NOT_AN_AMFI_FUND",
        currencyCode: "INR",
        history: {
          firstDate: null,
          lastDate: null,
          observationCount: 0,
          excludedObservationCount: 0,
          lastIsStale: false,
        },
        periods: [],
      });
      expect(backfill).not.toHaveBeenCalled();
    },
  );

  it("refuses another user's fund with NotFoundException before any provider call", async () => {
    const otherId = (await createTestUserDirect(dataSource)).id;
    const theirs = await fund(otherId);
    // Uncovered 5Y start: a read that got past ownership would backfill.
    await seed(theirs, FX_A.slice(1));

    await expect(read(userId, theirs)).rejects.toThrow(NotFoundException);
    expect(backfill).not.toHaveBeenCalled();
    const [{ stamped }] = await dataSource.query(
      `SELECT historical_backfill_attempted_at IS NOT NULL AS stamped
         FROM securities WHERE id = $1`,
      [theirs],
    );
    expect(stamped).toBe(false);
  });

  it("refuses a nonexistent id with NotFoundException", async () => {
    await expect(
      read(userId, "00000000-0000-4000-8000-000000000000"),
    ).rejects.toThrow(NotFoundException);
  });
});
