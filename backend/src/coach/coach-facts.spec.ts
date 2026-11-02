import {
  buildCoachPrompt,
  computeCoachMetrics,
  verifyNarrative,
} from "./coach-facts";

const metrics = computeCoachMetrics({
  income: 100_000,
  spending: 70_000,
  budgeted: 80_000,
  netWorthStart: 500_000,
  netWorthEnd: 520_000,
  currency: "INR",
});
const value = (id: string) => metrics.find((m) => m.id === id)!.value;

describe("computeCoachMetrics", () => {
  it("derives rates in code", () => {
    expect(value("savings_rate")).toBe(30);
    expect(value("budget_used")).toBe(87.5);
    expect(value("net_worth_change")).toBe(20_000);
  });

  it("unknowns stay null, never 0", () => {
    const m = computeCoachMetrics({
      income: 0,
      spending: 10,
      budgeted: null,
      netWorthStart: null,
      netWorthEnd: 5,
      currency: "INR",
    });
    expect(m.find((x) => x.id === "savings_rate")!.value).toBeNull();
    expect(m.find((x) => x.id === "budget_used")!.value).toBeNull();
    expect(m.find((x) => x.id === "net_worth_change")!.value).toBeNull();
  });
});

describe("buildCoachPrompt", () => {
  it("lists ids and marks unknown metrics as unknown", () => {
    const p = buildCoachPrompt(
      computeCoachMetrics({
        income: 0,
        spending: 1,
        budgeted: null,
        netWorthStart: null,
        netWorthEnd: null,
        currency: "INR",
      }),
    );
    expect(p).toContain("[savings_rate] Savings rate: unknown");
    expect(p).toContain("ONLY the numbers");
  });
});

describe("verifyNarrative", () => {
  it("accepts text that quotes only supplied numbers", () => {
    const r = verifyNarrative(
      "You saved 30% [savings_rate] and spent 87.5% of budget [budget_used].\n1. Keep going.",
      metrics,
    );
    expect(r).toEqual({ ok: true, unsupportedNumbers: [] });
  });

  it("accepts separators and a sign difference", () => {
    expect(verifyNarrative("Net worth rose by 20,000.", metrics).ok).toBe(true);
  });

  it("rejects an invented figure", () => {
    const r = verifyNarrative("You could save 5,000 more.", metrics);
    expect(r).toEqual({ ok: false, unsupportedNumbers: ["5,000"] });
  });

  it("rejects a number tied to an unknown metric", () => {
    const m = computeCoachMetrics({
      income: 0,
      spending: 10,
      budgeted: null,
      netWorthStart: null,
      netWorthEnd: null,
      currency: "INR",
    });
    expect(verifyNarrative("Your savings rate is 12%.", m).ok).toBe(false);
  });
});
