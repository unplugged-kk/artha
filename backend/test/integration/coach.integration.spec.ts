import { TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CoachModule } from "@/coach/coach.module";
import { CoachService } from "@/coach/coach.service";
import { Transaction } from "@/transactions/entities/transaction.entity";
import { withUserContext } from "@/common/db/with-context";
import {
  createIntegrationModule,
  cleanTables,
  createTestUserDirect,
} from "../helpers/integration-setup";
import { createTestAccount } from "../helpers/test-factories";

// T12: real transactions through the real summary query, with a scripted AI.
describe("Weekly coach (integration)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: CoachService;
  const AS_OF = "2026-06-20";

  beforeAll(async () => {
    module = await createIntegrationModule([CoachModule]);
    dataSource = module.get(DataSource);
    service = module.get(CoachService);
  });
  afterAll(async () => {
    await module.close();
  });
  beforeEach(async () => {
    await cleanTables(dataSource, [
      "action_history",
      "transactions",
      "accounts",
      "users",
    ]);
    for (const [code, name, sym] of [
      ["USD", "US Dollar", "$"],
      ["INR", "Indian Rupee", "R"],
    ]) {
      await dataSource.query(
        `INSERT INTO currencies (code, name, symbol, decimal_places) VALUES ($1,$2,$3,2) ON CONFLICT DO NOTHING`,
        [code, name, sym],
      );
    }
  });

  function useAi(replies: Array<string | Error>) {
    const complete = jest.fn(async () => {
      const next = replies.shift();
      if (next === undefined) throw new Error("script exhausted");
      if (next instanceof Error) throw next;
      return {
        content: next,
        model: "stub",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    });
    (service as any).ai = { complete };
    return complete;
  }

  async function seed(
    userId: string,
    currency = "USD",
    opts: { in?: number; out?: number } = {},
  ) {
    const account = await createTestAccount(dataSource, userId, {
      currencyCode: currency,
    } as any);
    const add = (date: string, amount: number) =>
      dataSource.manager.save(
        dataSource.manager.create(Transaction, {
          userId,
          accountId: account.id,
          transactionDate: date,
          amount,
          currencyCode: currency,
        } as any),
      );
    if (opts.in) await add("2026-06-18", opts.in);
    if (opts.out) await add("2026-06-19", -opts.out);
    // Outside the 7-day window (2026-06-14 .. 2026-06-20): must not count.
    await add("2026-06-01", 99999);
  }

  const run = <T>(userId: string, fn: () => Promise<T>) =>
    withUserContext(userId, fn);
  const value = (
    r: { metrics: readonly { id: string; value: number | null }[] },
    id: string,
  ) => r.metrics.find((m) => m.id === id)?.value;

  it("computes the week's figures in code, from the window only", async () => {
    const user = await createTestUserDirect(dataSource);
    await seed(user.id, "INR", { in: 1000, out: 300 });
    const r = await run(user.id, () => service.weeklyMetrics(user.id, AS_OF));
    expect(r.period).toEqual({ start: "2026-06-14", end: AS_OF });
    expect(value(r, "income")).toBe(1000);
    expect(value(r, "spending")).toBe(300);
    expect(value(r, "savings_rate")).toBe(70);
    expect(value(r, "budget_used")).toBeNull(); // no budget: unknown, not 0
  });

  it("another currency is disclosed and never added in", async () => {
    const user = await createTestUserDirect(dataSource);
    await seed(user.id, "INR", { in: 1000, out: 300 });
    await seed(user.id, "USD", { in: 5000, out: 100 });
    const r = await run(user.id, () => service.weeklyMetrics(user.id, AS_OF));
    expect(r.excludedCurrencies).toEqual(["USD"]);
    expect(value(r, "income")).toBe(1000);
  });

  it("a user with no activity has an unknown savings rate, not zero", async () => {
    const user = await createTestUserDirect(dataSource);
    const r = await run(user.id, () => service.weeklyMetrics(user.id, AS_OF));
    expect(value(r, "savings_rate")).toBeNull();
  });

  it("accepts a narrative that quotes only computed numbers", async () => {
    const user = await createTestUserDirect(dataSource);
    await seed(user.id, "INR", { in: 1000, out: 300 });
    const ai = useAi(["You saved 70% [savings_rate] of 1,000 [income]."]);
    const r = await run(user.id, () => service.weeklyReport(user.id, AS_OF));
    expect(r.narrative).toEqual({
      status: "ok",
      text: "You saved 70% [savings_rate] of 1,000 [income].",
    });
    expect(ai).toHaveBeenCalledTimes(1);
  });

  it("retries once with the offending numbers named, then accepts a clean answer", async () => {
    const user = await createTestUserDirect(dataSource);
    await seed(user.id, "INR", { in: 1000, out: 300 });
    const ai = useAi([
      "You could save 5,000 more.",
      "You saved 70% [savings_rate].",
    ]);
    const r = await run(user.id, () => service.weeklyReport(user.id, AS_OF));
    expect(r.narrative.status).toBe("ok");
    expect(ai).toHaveBeenCalledTimes(2);
    const retryPrompt = (ai.mock.calls[1] as any)[1].messages[0]
      .content as string;
    expect(retryPrompt).toContain("5,000");
  });

  it("never returns an invented number: two bad answers withhold the narrative", async () => {
    const user = await createTestUserDirect(dataSource);
    await seed(user.id, "INR", { in: 1000, out: 300 });
    useAi(["Try saving 5,000.", "Try saving 7,500."]);
    const r = await run(user.id, () => service.weeklyReport(user.id, AS_OF));
    expect(r.narrative).toEqual({
      status: "unavailable",
      reason: "unsupported_numbers",
      unsupportedNumbers: ["7,500"],
    });
    expect(value(r, "savings_rate")).toBe(70); // the figures still come back
  });

  it("separates 'no provider configured' from 'provider failed'", async () => {
    const user = await createTestUserDirect(dataSource);
    useAi([new BadRequestException("No active AI providers configured.")]);
    const none = await run(user.id, () => service.weeklyReport(user.id, AS_OF));
    expect(none.narrative).toEqual({
      status: "unavailable",
      reason: "no_ai_provider",
    });
    useAi([new Error("socket hang up")]);
    const failed = await run(user.id, () =>
      service.weeklyReport(user.id, AS_OF),
    );
    expect(failed.narrative).toEqual({
      status: "unavailable",
      reason: "ai_failed",
    });
  });
});
