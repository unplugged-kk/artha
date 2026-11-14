import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";

import { SecuritiesModule } from "@/securities/securities.module";
import { AmfiNavService } from "@/securities/amfi-nav.service";
import { FundClassificationService } from "@/securities/fund-classification.service";
import { Security } from "@/securities/entities/security.entity";
import { withUserContext } from "@/common/db/with-context";
import {
  cleanTables,
  createIntegrationModule,
  createTestUserDirect,
} from "../helpers/integration-setup";

/**
 * I2 of `docs/specs/fund-categories-and-comparison.md`: the classification is
 * written onto the `securities` row on a real database, and a failed provider
 * fetch changes nothing.
 *
 * The negative case is the one that matters. A write on failure would erase a
 * known category and stamp the row fresh, so a transient outage would read as
 * "AMFI says this fund has no category" for a week with no way to tell the two
 * apart (INV-FUNDCAT-002).
 */
describe("Fund classification capture (integration)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: FundClassificationService;
  let amfi: AmfiNavService;

  beforeAll(async () => {
    module = await createIntegrationModule([SecuritiesModule]);
    dataSource = module.get(DataSource);
    service = module.get(FundClassificationService);
    amfi = module.get(AmfiNavService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await cleanTables(dataSource, ["securities", "users"]);
    await dataSource.query(
      `INSERT INTO currencies (code, name, symbol, decimal_places) VALUES ('INR', 'Indian Rupee', '₹', 2) ON CONFLICT DO NOTHING`,
    );
    jest.restoreAllMocks();
  });

  async function createFund(
    userId: string,
    overrides: Partial<Security> = {},
  ): Promise<Security> {
    return dataSource.manager.save(
      dataSource.manager.create(Security, {
        userId,
        symbol: "120503",
        name: "Example Large Cap Fund",
        securityType: "MUTUAL_FUND",
        currencyCode: "INR",
        amfiSchemeCode: "120503",
        fundHouse: null,
        fundSchemeType: null,
        fundCategory: null,
        fundClassificationUpdatedAt: null,
        ...overrides,
      } as any),
    );
  }

  async function reload(id: string): Promise<Security> {
    const row = await dataSource.manager.findOne(Security, { where: { id } });
    if (!row) throw new Error(`security ${id} vanished`);
    return row;
  }

  it("writes the published classification and stamps the row", async () => {
    const user = await createTestUserDirect(dataSource);
    const fund = await createFund(user.id);
    jest.spyOn(amfi, "fetchSchemeClassification").mockResolvedValue({
      fundHouse: "Example Mutual Fund",
      schemeType: "Open Ended Schemes",
      schemeCategory: "Equity Scheme - Large Cap Fund",
    });

    await withUserContext(user.id, () =>
      service.ensureFundClassification([fund]),
    );

    const stored = await reload(fund.id);
    expect(stored.fundHouse).toBe("Example Mutual Fund");
    expect(stored.fundSchemeType).toBe("Open Ended Schemes");
    expect(stored.fundCategory).toBe("Equity Scheme - Large Cap Fund");
    expect(stored.fundClassificationUpdatedAt).toBeInstanceOf(Date);
  });

  it("leaves a known category and its stamp untouched when the provider fails", async () => {
    const user = await createTestUserDirect(dataSource);
    const stampedAt = new Date("2026-01-01T00:00:00.000Z");
    const fund = await createFund(user.id, {
      fundHouse: "Known AMC",
      fundSchemeType: "Open Ended Schemes",
      fundCategory: "Debt Scheme - Liquid Fund",
      fundClassificationUpdatedAt: stampedAt,
    });
    // Older than the staleness window, so the row is due for a refresh -- which
    // is exactly when a failed refresh must not overwrite anything.
    const stale = await reload(fund.id);
    jest.spyOn(amfi, "fetchSchemeClassification").mockResolvedValue(null);

    await withUserContext(user.id, () =>
      service.ensureFundClassification([stale]),
    );

    const stored = await reload(fund.id);
    expect(stored.fundCategory).toBe("Debt Scheme - Liquid Fund");
    expect(stored.fundHouse).toBe("Known AMC");
    expect(stored.fundClassificationUpdatedAt?.toISOString()).toBe(
      stampedAt.toISOString(),
    );
  });

  it("does not ask the provider again inside the staleness window", async () => {
    const user = await createTestUserDirect(dataSource);
    const fund = await createFund(user.id, {
      fundCategory: "Equity Scheme - Large Cap Fund",
      fundClassificationUpdatedAt: new Date(),
    });
    const spy = jest
      .spyOn(amfi, "fetchSchemeClassification")
      .mockResolvedValue(null);

    const current = await reload(fund.id);
    await withUserContext(user.id, () =>
      service.ensureFundClassification([current]),
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it("leaves a security with no scheme code alone, without asking AMFI", async () => {
    const user = await createTestUserDirect(dataSource);
    const stock = await createFund(user.id, {
      symbol: "AAPL",
      name: "Apple Inc.",
      securityType: "STOCK",
      amfiSchemeCode: null,
    });
    const spy = jest
      .spyOn(amfi, "fetchSchemeClassification")
      .mockResolvedValue(null);

    await withUserContext(user.id, () =>
      service.ensureFundClassification([stock]),
    );

    expect(spy).not.toHaveBeenCalled();
    const stored = await reload(stock.id);
    expect(stored.fundCategory).toBeNull();
    expect(stored.fundClassificationUpdatedAt).toBeNull();
  });
});
