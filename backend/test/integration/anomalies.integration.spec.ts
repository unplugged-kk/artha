import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { AnomaliesModule } from "@/anomalies/anomalies.module";
import { AnomalyDetectionService } from "@/anomalies/anomaly-detection.service";
import { Transaction } from "@/transactions/entities/transaction.entity";
import { withUserContext } from "@/common/db/with-context";
import {
  createIntegrationModule,
  cleanTables,
  createTestUserDirect,
} from "../helpers/integration-setup";
import {
  createTestAccount,
  createTestCategory,
} from "../helpers/test-factories";

// T10 end to end: real SQL (the analytics queries), real rows, the deterministic
// detectors on top. A mocked analytics service would prove the arithmetic and
// say nothing about whether the grouped totals really come back net-signed.
describe("Anomaly detection (integration)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: AnomalyDetectionService;
  const AS_OF = "2026-06-20";

  beforeAll(async () => {
    module = await createIntegrationModule([AnomaliesModule]);
    dataSource = module.get(DataSource);
    service = module.get(AnomalyDetectionService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await cleanTables(dataSource, [
      "action_history",
      "transaction_splits",
      "transactions",
      "accounts",
      "categories",
      "payees",
      "users",
    ]);
    await dataSource.query(
      `INSERT INTO currencies (code, name, symbol, decimal_places) VALUES ('USD', 'US Dollar', '$', 2) ON CONFLICT DO NOTHING`,
    );
  });

  async function addTxn(
    userId: string,
    accountId: string,
    date: string,
    amount: number,
    extra: { categoryId?: string; payeeName?: string } = {},
  ) {
    await dataSource.manager.save(
      dataSource.manager.create(Transaction, {
        userId,
        accountId,
        transactionDate: date,
        amount,
        currencyCode: "USD",
        ...extra,
      } as any),
    );
  }

  it("flags a spike against a real baseline, and only that", async () => {
    const user = await createTestUserDirect(dataSource);
    const account = await createTestAccount(dataSource, user.id);
    const dining = await createTestCategory(dataSource, user.id, {
      name: "Dining",
    });
    const groceries = await createTestCategory(dataSource, user.id, {
      name: "Groceries",
    });
    const hobby = await createTestCategory(dataSource, user.id, {
      name: "New hobby",
    });

    for (const [month, d, g] of [
      ["2026-03", 100, 200],
      ["2026-04", 120, 210],
      ["2026-05", 110, 205],
    ] as const) {
      await addTxn(user.id, account.id, `${month}-10`, -d, {
        categoryId: dining.id,
      });
      await addTxn(user.id, account.id, `${month}-11`, -g, {
        categoryId: groceries.id,
      });
    }
    await addTxn(user.id, account.id, "2026-06-05", -400, {
      categoryId: dining.id,
    });
    await addTxn(user.id, account.id, "2026-06-06", -206, {
      categoryId: groceries.id,
    });
    // No history at all: there is no baseline to be a spike against.
    await addTxn(user.id, account.id, "2026-06-07", -500, {
      categoryId: hobby.id,
    });

    const report = await withUserContext(user.id, () =>
      service.detect(user.id, AS_OF),
    );

    expect(report.spendingSpikes).toHaveLength(1);
    expect(report.spendingSpikes[0]).toMatchObject({
      categoryName: "Dining",
      currencyCode: "USD",
      current: 400,
      mean: 110,
    });
    expect(report.currentPeriod).toEqual({ start: "2026-06-01", end: AS_OF });
    expect(report.historyPeriod).toEqual({
      start: "2026-03-01",
      end: "2026-05-31",
    });
  });

  it("a refund nets against spend, so it cannot mask or fake a spike", async () => {
    const user = await createTestUserDirect(dataSource);
    const account = await createTestAccount(dataSource, user.id);
    const dining = await createTestCategory(dataSource, user.id, {
      name: "Dining",
    });
    for (const m of ["2026-03", "2026-04", "2026-05"]) {
      await addTxn(user.id, account.id, `${m}-10`, -100, {
        categoryId: dining.id,
      });
    }
    await addTxn(user.id, account.id, "2026-06-05", -400, {
      categoryId: dining.id,
    });
    await addTxn(user.id, account.id, "2026-06-06", 350, {
      categoryId: dining.id,
    });

    const report = await withUserContext(user.id, () =>
      service.detect(user.id, AS_OF),
    );
    expect(report.spendingSpikes).toEqual([]);
  });

  it("detects a subscription price increase from recurring charges", async () => {
    const user = await createTestUserDirect(dataSource);
    const account = await createTestAccount(dataSource, user.id);
    for (const m of ["01", "02", "03", "04", "05"]) {
      await addTxn(user.id, account.id, `2026-${m}-01`, -149, {
        payeeName: "Streamly",
      });
    }
    await addTxn(user.id, account.id, "2026-06-01", -199, {
      payeeName: "Streamly",
    });

    const report = await withUserContext(user.id, () =>
      service.detect(user.id, AS_OF),
    );
    expect(report.subscriptionIncreases).toHaveLength(1);
    expect(report.subscriptionIncreases[0]).toMatchObject({
      payeeName: "Streamly",
      previous: 149,
      latest: 199,
    });
  });

  it("does not report a variable utility bill as a price increase", async () => {
    const user = await createTestUserDirect(dataSource);
    const account = await createTestAccount(dataSource, user.id);
    const bills: Array<[string, number]> = [
      ["01", 40],
      ["02", 95],
      ["03", 60],
      ["04", 45],
      ["05", 70],
      ["06", 215],
    ];
    for (const [m, amount] of bills) {
      await addTxn(user.id, account.id, `2026-${m}-01`, -amount, {
        payeeName: "Gas Utility",
      });
    }

    const report = await withUserContext(user.id, () =>
      service.detect(user.id, AS_OF),
    );
    expect(report.subscriptionIncreases).toEqual([]);
  });

  it("never reports another user's spending", async () => {
    const a = await createTestUserDirect(dataSource);
    const b = await createTestUserDirect(dataSource);
    const acctB = await createTestAccount(dataSource, b.id);
    const catB = await createTestCategory(dataSource, b.id, { name: "Dining" });
    for (const m of ["2026-03", "2026-04", "2026-05"]) {
      await addTxn(b.id, acctB.id, `${m}-10`, -100, { categoryId: catB.id });
    }
    await addTxn(b.id, acctB.id, "2026-06-05", -900, { categoryId: catB.id });

    const reportA = await withUserContext(a.id, () =>
      service.detect(a.id, AS_OF),
    );
    const reportB = await withUserContext(b.id, () =>
      service.detect(b.id, AS_OF),
    );
    expect(reportA.spendingSpikes).toEqual([]);
    expect(reportB.spendingSpikes).toHaveLength(1);
  });
});
