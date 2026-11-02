import { planSimulateSchema, runPlanSimulation } from "./simulate-llm";

describe("runPlanSimulation", () => {
  it("runs both payoff strategies side by side with evidence", () => {
    const r = runPlanSimulation({
      operation: "debt_payoff",
      debts: [
        { name: "card", balance: 10_000, aprPct: 36, minPayment: 500 },
        { name: "loan", balance: 5_000, aprPct: 12, minPayment: 200 },
      ],
      extraMonthly: 300,
    }) as Record<string, any>;
    expect(r.snowball.status).toBe("paid_off");
    expect(r.avalanche.totalInterest).toBeLessThanOrEqual(
      r.snowball.totalInterest,
    );
    expect(r.evidence.extraMonthly).toBe(300);
  });

  it("requires debts rather than treating none as paid off", () => {
    expect(runPlanSimulation({ operation: "debt_payoff" })).toEqual({
      error: "debts is required for debt_payoff.",
    });
  });

  it("names every missing fire input", () => {
    const r = runPlanSimulation({ operation: "fire", currentCorpus: 0 });
    expect(r).toEqual({
      error:
        "monthlySavings, realAnnualReturnPct, annualExpenses required for fire.",
    });
  });

  it("fire with an extra saving reports months saved", () => {
    const r = runPlanSimulation({
      operation: "fire",
      currentCorpus: 0,
      monthlySavings: 50_000,
      realAnnualReturnPct: 0,
      annualExpenses: 600_000,
      extraMonthlySavings: 50_000,
    }) as Record<string, any>;
    expect(r.base.months).toBe(300);
    expect(r.withExtra.months).toBe(150);
    expect(r.monthsSaved).toBe(150);
  });

  it("without an extra saving there is no comparison to show", () => {
    const r = runPlanSimulation({
      operation: "fire",
      currentCorpus: 0,
      monthlySavings: 50_000,
      realAnnualReturnPct: 0,
      annualExpenses: 600_000,
    }) as Record<string, any>;
    expect(r.withExtra).toBeNull();
    expect(r.monthsSaved).toBeNull();
  });
});

describe("planSimulateSchema", () => {
  it("accepts numeric strings a model writes by hand but refuses blanks", () => {
    expect(
      planSimulateSchema.safeParse({ operation: "fire", currentCorpus: "100" })
        .success,
    ).toBe(true);
    expect(
      planSimulateSchema.safeParse({ operation: "fire", currentCorpus: "" })
        .success,
    ).toBe(false);
  });

  it("refuses negative money and an unknown operation", () => {
    expect(
      planSimulateSchema.safeParse({ operation: "fire", currentCorpus: -1 })
        .success,
    ).toBe(false);
    expect(planSimulateSchema.safeParse({ operation: "x" }).success).toBe(
      false,
    );
  });
});
