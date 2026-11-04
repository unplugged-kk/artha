import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { CategorizationModule } from "@/categorization/categorization.module";
import { CategorizationSuggestionService } from "@/categorization/categorization-suggestion.service";
import { Transaction } from "@/transactions/entities/transaction.entity";
import { TransactionRule } from "@/rules/entities/transaction-rule.entity";
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

// The pipeline's tiers against real rows: the user's rule, the built-in merchant
// reference (a category NAME that must resolve to exactly one of this user's
// categories), and the user's own payee history.
describe("Categorization suggestion (integration)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: CategorizationSuggestionService;

  beforeAll(async () => {
    module = await createIntegrationModule([CategorizationModule]);
    dataSource = module.get(DataSource);
    service = module.get(CategorizationSuggestionService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await cleanTables(dataSource, [
      "action_history",
      "transactions",
      "transaction_rules",
      "accounts",
      "categories",
      "payees",
      "users",
    ]);
    await dataSource.query(
      `INSERT INTO currencies (code, name, symbol, decimal_places) VALUES ('USD', 'US Dollar', '$', 2) ON CONFLICT DO NOTHING`,
    );
  });

  const suggest = (userId: string, payee: string) =>
    withUserContext(userId, () => service.suggest(userId, { payee }));

  async function addTxn(
    userId: string,
    accountId: string,
    categoryId: string,
    payeeName: string,
    day: number,
  ) {
    await dataSource.manager.save(
      dataSource.manager.create(Transaction, {
        userId,
        accountId,
        transactionDate: `2026-05-${String(day).padStart(2, "0")}`,
        amount: -10,
        currencyCode: "USD",
        categoryId,
        payeeName,
      } as any),
    );
  }

  it("a user rule decides first and says so", async () => {
    const user = await createTestUserDirect(dataSource);
    const mine = await createTestCategory(dataSource, user.id, {
      name: "My Takeaway",
    });
    await createTestCategory(dataSource, user.id, { name: "Food & Dining" });
    await dataSource.manager.save(
      dataSource.manager.create(TransactionRule, {
        userId: user.id,
        name: "swiggy mine",
        priority: 0,
        isActive: true,
        matchMode: "ALL",
        conditions: [{ field: "payee", operator: "CONTAINS", value: "swiggy" }],
        actions: { setCategoryId: mine.id },
      } as any),
    );
    const r = await suggest(user.id, "Swiggy");
    expect(r.decision).toMatchObject({
      status: "categorized",
      tier: "user_rule",
      categoryId: mine.id,
    });
    expect(r.categoryName).toBe("My Takeaway");
  });

  it("falls to the known-merchant category when it names exactly one of the user's categories", async () => {
    const user = await createTestUserDirect(dataSource);
    const food = await createTestCategory(dataSource, user.id, {
      name: "Food & Dining",
    });
    const r = await suggest(user.id, "SWIGGY *4421");
    expect(r.decision).toMatchObject({
      status: "categorized",
      tier: "merchant_default",
      categoryId: food.id,
    });
  });

  it("an ambiguous merchant category stays silent instead of guessing", async () => {
    const user = await createTestUserDirect(dataSource);
    const a = await createTestCategory(dataSource, user.id, {
      name: "Personal",
    });
    const b = await createTestCategory(dataSource, user.id, {
      name: "Business",
    });
    await createTestCategory(dataSource, user.id, {
      name: "Food & Dining",
      parentId: a.id,
    });
    await createTestCategory(dataSource, user.id, {
      name: "Food & Dining",
      parentId: b.id,
    });
    const r = await suggest(user.id, "Swiggy");
    expect(r.decision.status).toBe("needs_ai");
  });

  it("learns from the user's own history only with a real majority", async () => {
    const user = await createTestUserDirect(dataSource);
    const account = await createTestAccount(dataSource, user.id);
    const groc = await createTestCategory(dataSource, user.id, {
      name: "Groceries",
    });
    const misc = await createTestCategory(dataSource, user.id, {
      name: "Misc",
    });
    for (let d = 1; d <= 4; d += 1) {
      await addTxn(user.id, account.id, groc.id, "Local Kirana", d);
    }
    await addTxn(user.id, account.id, misc.id, "Local Kirana", 5);
    const r = await suggest(user.id, "local kirana");
    expect(r.decision).toMatchObject({
      status: "categorized",
      tier: "history",
      categoryId: groc.id,
      confidence: 0.8,
    });

    for (let d = 1; d <= 3; d += 1) {
      await addTxn(user.id, account.id, misc.id, "Split Shop", d);
      await addTxn(user.id, account.id, groc.id, "Split Shop", d + 10);
    }
    expect((await suggest(user.id, "Split Shop")).decision.status).toBe(
      "needs_ai",
    );
  });

  it("an unknown payee needs AI and never sees another user's history", async () => {
    const a = await createTestUserDirect(dataSource);
    const b = await createTestUserDirect(dataSource);
    const acctB = await createTestAccount(dataSource, b.id);
    const catB = await createTestCategory(dataSource, b.id, {
      name: "Groceries",
    });
    for (let d = 1; d <= 5; d += 1) {
      await addTxn(b.id, acctB.id, catB.id, "Corner Store", d);
    }
    expect((await suggest(a.id, "Corner Store")).decision).toEqual({
      status: "needs_ai",
      hints: [],
    });
    expect((await suggest(b.id, "Corner Store")).decision.status).toBe(
      "categorized",
    );
  });
});
