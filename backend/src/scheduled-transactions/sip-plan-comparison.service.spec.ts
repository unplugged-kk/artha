import { SipPlanComparisonService } from "./sip-plan-comparison.service";
import { ScheduledOccurrenceService } from "./scheduled-occurrence.service";
import { withUserContext } from "../common/db/with-context";

const findOccurrences = jest.fn();
const query = jest.fn();

/**
 * `withScopedDb` runs its callback inside `dataSource.transaction(...)`, so the
 * mock supplies one; `query` then answers only the service's own SQL.
 */
const manager = { query };
const dataSource = {
  transaction: (fn: (m: typeof manager) => Promise<unknown>) => fn(manager),
};

const sipService = new SipPlanComparisonService(
  dataSource as never,
  { findOccurrences } as unknown as ScheduledOccurrenceService,
);

/**
 * `withScopedDb` refuses to run outside a user context, so every call goes
 * through one here; the service itself stays private behind this helper.
 */
const sipCompare = (
  userId: string,
  window: { from?: string; through: string },
) => withUserContext(userId, () => sipService.compare(userId, window));

/** An investment schedule occurrence, as the occurrence service would resolve it. */
function occurrence(
  dueDate: string,
  amount: number | null,
  overrides: Record<string, unknown> = {},
) {
  // The schedule id drives the occurrence's too, so a test that names a second
  // schedule actually gets a second group.
  const scheduledTransactionId = (overrides.id as string) ?? "sched-1";
  return {
    scheduledTransactionId,
    originalDate: dueDate,
    dueDate,
    amount,
    currencyCode: "INR",
    settlementAccountId: "acct-1",
    schedule: {
      id: scheduledTransactionId,
      name: "Index fund SIP",
      isInvestment: true,
      investmentSecurityId: "sec-1",
      frequency: "MONTHLY",
      nextDueDate: "2026-04-01",
      ...overrides,
    },
  };
}

/** A posting row as the joined query returns it. */
function posting(
  dueDate: string,
  investmentTransactionId: string | null,
  totalAmount: string | null,
  exchangeRate: string | null = "1",
  status: string | null = "POSTED",
  scheduledTransactionId = "sched-1",
) {
  return {
    scheduled_transaction_id: scheduledTransactionId,
    due_date: dueDate,
    posted_date: dueDate,
    investment_transaction_id: investmentTransactionId,
    total_amount: totalAmount,
    exchange_rate: exchangeRate,
    investment_status: status,
  };
}

beforeEach(() => {
  findOccurrences.mockReset();
  query.mockReset();
  query.mockResolvedValue([]);
});

describe("SipPlanComparisonService", () => {
  it("matches a contribution that followed the plan exactly", async () => {
    findOccurrences.mockResolvedValue([occurrence("2026-01-05", 5000)]);
    query.mockResolvedValue([posting("2026-01-05", "inv-1", "5000")]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.occurrences[0]).toMatchObject({
      dueDate: "2026-01-05",
      status: "matched",
      plannedAmount: 5000,
      actualAmount: 5000,
      variance: 0,
      investmentTransactionId: "inv-1",
    });
    expect(comparison.matchedCount).toBe(1);
    expect(comparison.plannedTotal).toBe(5000);
    expect(comparison.actualTotal).toBe(5000);
  });

  it("takes the actual amount from the investment row, not the plan", async () => {
    // The plan says 5000; the money that actually moved was 3200. Reporting
    // 5000 here would be the whole defect this service exists to catch.
    findOccurrences.mockResolvedValue([occurrence("2026-01-05", 5000)]);
    query.mockResolvedValue([posting("2026-01-05", "inv-1", "3200")]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.occurrences[0].actualAmount).toBe(3200);
    expect(comparison.occurrences[0].status).toBe("partial");
    expect(comparison.occurrences[0].variance).toBe(-1800);
    expect(comparison.partialCount).toBe(1);
  });

  it("reports a missed occurrence as nothing invested", async () => {
    findOccurrences.mockResolvedValue([
      occurrence("2026-01-05", 5000),
      occurrence("2026-02-05", 5000),
    ]);
    query.mockResolvedValue([posting("2026-01-05", "inv-1", "5000")]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    const missed = comparison.occurrences[1];
    expect(missed.status).toBe("missed");
    expect(missed.actualAmount).toBe(0);
    expect(missed.variance).toBe(-5000);
    expect(comparison.missedCount).toBe(1);
    expect(comparison.postedCount).toBe(1);
  });

  it("reports an extra contribution", async () => {
    findOccurrences.mockResolvedValue([occurrence("2026-01-05", 5000)]);
    query.mockResolvedValue([posting("2026-01-05", "inv-1", "7500")]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.occurrences[0].status).toBe("extra");
    expect(comparison.occurrences[0].variance).toBe(2500);
  });

  it("reports a reversed contribution as voided, not as a match", async () => {
    findOccurrences.mockResolvedValue([occurrence("2026-01-05", 5000)]);
    query.mockResolvedValue([
      posting("2026-01-05", "inv-1", "5000", "1", "VOID"),
    ]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.occurrences[0].status).toBe("voided");
    expect(comparison.occurrences[0].actualAmount).toBe(0);
    expect(comparison.voidedCount).toBe(1);
    // The occurrence was still posted -- it is not a missed payment.
    expect(comparison.missedCount).toBe(0);
  });

  it("never restates the plan as the actual when the amount is unknowable", async () => {
    // A posting from before the link existed: it happened, but what it booked
    // is not recorded anywhere.
    findOccurrences.mockResolvedValue([occurrence("2026-01-05", 5000)]);
    query.mockResolvedValue([posting("2026-01-05", null, null)]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.occurrences[0].status).toBe("unknown");
    expect(comparison.occurrences[0].actualAmount).toBeNull();
    expect(comparison.occurrences[0].variance).toBeNull();
    expect(comparison.unknownCount).toBe(1);
    // An unknown actual poisons the total rather than understating it.
    expect(comparison.actualTotal).toBeNull();
  });

  it("converts the actual at the rate the row was booked with", async () => {
    findOccurrences.mockResolvedValue([occurrence("2026-01-05", 8300)]);
    query.mockResolvedValue([
      posting("2026-01-05", "inv-1", "100", "83.0000000000"),
    ]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.occurrences[0].actualAmount).toBe(8300);
    expect(comparison.occurrences[0].status).toBe("matched");
  });

  it("keeps multiple SIPs separate", async () => {
    findOccurrences.mockResolvedValue([
      occurrence("2026-01-05", 5000),
      occurrence("2026-01-10", 2000, {
        id: "sched-2",
        name: "Gold SIP",
        investmentSecurityId: "sec-2",
      }),
    ]);
    query.mockResolvedValue([
      posting("2026-01-05", "inv-1", "5000"),
      posting("2026-01-10", "inv-2", "1500", "1", "POSTED", "sched-2"),
    ]);

    const comparisons = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparisons).toHaveLength(2);
    const byId = Object.fromEntries(
      comparisons.map((c) => [c.scheduledTransactionId, c]),
    );
    expect(byId["sched-1"].matchedCount).toBe(1);
    expect(byId["sched-2"].partialCount).toBe(1);
  });

  it("ignores schedules that are not investments", async () => {
    findOccurrences.mockResolvedValue([
      occurrence("2026-01-05", 5000, { isInvestment: false }),
    ]);

    const comparisons = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparisons).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns nothing when the window holds no occurrences", async () => {
    findOccurrences.mockResolvedValue([]);
    expect(
      await sipCompare("11111111-1111-4111-8111-111111111111", {
        through: "2026-03-31",
      }),
    ).toEqual([]);
  });

  it("passes the window through to the occurrence resolver", async () => {
    findOccurrences.mockResolvedValue([]);
    await sipCompare("11111111-1111-4111-8111-111111111111", {
      from: "2026-01-01",
      through: "2026-03-31",
    });
    expect(findOccurrences).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      {
        from: "2026-01-01",
        through: "2026-03-31",
      },
    );
  });

  it("withholds the planned total when a planned amount is unknown", async () => {
    findOccurrences.mockResolvedValue([
      occurrence("2026-01-05", 5000),
      occurrence("2026-02-05", null),
    ]);
    query.mockResolvedValue([
      posting("2026-01-05", "inv-1", "5000"),
      posting("2026-02-05", "inv-2", "5000"),
    ]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.plannedTotal).toBeNull();
    expect(comparison.actualTotal).toBe(5000 + 5000);
    expect(comparison.unknownCount).toBe(1);
  });

  it("treats a sub-precision difference as the same amount", async () => {
    findOccurrences.mockResolvedValue([occurrence("2026-01-05", 5000)]);
    query.mockResolvedValue([posting("2026-01-05", "inv-1", "5000.00004")]);

    const [comparison] = await sipCompare(
      "11111111-1111-4111-8111-111111111111",
      {
        through: "2026-03-31",
      },
    );

    expect(comparison.occurrences[0].status).toBe("matched");
  });
});
