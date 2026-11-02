import { simulateDebtPayoff, Debt } from "./debt-payoff";
import { compareSavingsIncrease, projectFire } from "./fire";

const card: Debt = {
  name: "card",
  balance: 10_000,
  aprPct: 36,
  minPayment: 500,
};
const loan: Debt = {
  name: "loan",
  balance: 5_000,
  aprPct: 12,
  minPayment: 200,
};

describe("simulateDebtPayoff", () => {
  it("avalanche never pays more interest than snowball", () => {
    const a = simulateDebtPayoff([card, loan], 300, "avalanche");
    const s = simulateDebtPayoff([card, loan], 300, "snowball");
    if (a.status !== "paid_off" || s.status !== "paid_off")
      throw new Error("x");
    expect(a.totalInterest).toBeLessThanOrEqual(s.totalInterest);
  });

  it("snowball clears the smaller balance first, avalanche the higher APR", () => {
    const a = simulateDebtPayoff([card, loan], 300, "avalanche");
    const s = simulateDebtPayoff([card, loan], 300, "snowball");
    if (a.status !== "paid_off" || s.status !== "paid_off")
      throw new Error("x");
    expect(s.payoffOrder[0]).toBe("loan");
    expect(a.payoffOrder[0]).toBe("card");
  });

  it("a single zero-interest debt: months = ceil(balance / payment)", () => {
    const r = simulateDebtPayoff(
      [{ name: "friend", balance: 1000, aprPct: 0, minPayment: 300 }],
      0,
      "avalanche",
    );
    expect(r).toEqual({
      status: "paid_off",
      months: 4,
      totalInterest: 0,
      payoffOrder: ["friend"],
    });
  });

  it("reports never_paid_off when the payment cannot cover interest", () => {
    const r = simulateDebtPayoff(
      [{ name: "x", balance: 100_000, aprPct: 36, minPayment: 100 }],
      0,
      "snowball",
    );
    expect(r.status).toBe("never_paid_off");
  });

  it("no debt is already paid off; negative input is refused", () => {
    expect(simulateDebtPayoff([], 0, "snowball")).toMatchObject({ months: 0 });
    expect(
      simulateDebtPayoff([{ ...card, balance: -1 }], 0, "snowball").status,
    ).toBe("never_paid_off");
  });
});

describe("projectFire", () => {
  const base = {
    currentCorpus: 0,
    monthlySavings: 50_000,
    realAnnualReturnPct: 0,
    annualExpenses: 600_000,
  };

  it("at 0% real return the corpus is plain accumulation", () => {
    // target = 600000 / 0.04 = 15,000,000; 15,000,000 / 50,000 = 300 months
    expect(projectFire(base)).toMatchObject({
      status: "reachable",
      targetCorpus: 15_000_000,
      months: 300,
      years: 25,
      withdrawalRatePct: 4,
    });
  });

  it("already financially independent takes zero months", () => {
    expect(projectFire({ ...base, currentCorpus: 20_000_000 })).toMatchObject({
      status: "reachable",
      months: 0,
    });
  });

  it("zero savings and zero return never gets there, and says so", () => {
    expect(projectFire({ ...base, monthlySavings: 0, maxYears: 10 })).toEqual({
      status: "not_reachable",
      targetCorpus: 15_000_000,
      withdrawalRatePct: 4,
      horizonYears: 10,
    });
  });

  it("rejects negative or non-finite input", () => {
    expect(projectFire({ ...base, annualExpenses: -1 }).status).toBe(
      "invalid_input",
    );
    expect(projectFire({ ...base, realAnnualReturnPct: NaN }).status).toBe(
      "invalid_input",
    );
  });
});

describe("compareSavingsIncrease", () => {
  it("extra savings reach the goal sooner", () => {
    const r = compareSavingsIncrease(
      {
        currentCorpus: 0,
        monthlySavings: 50_000,
        realAnnualReturnPct: 0,
        annualExpenses: 600_000,
      },
      50_000,
    );
    expect(r.monthsSaved).toBe(150); // 300 -> 150
  });

  it("monthsSaved is null when either side is unreachable", () => {
    const r = compareSavingsIncrease(
      {
        currentCorpus: 0,
        monthlySavings: 0,
        realAnnualReturnPct: 0,
        annualExpenses: 600_000,
        maxYears: 5,
      },
      0,
    );
    expect(r.monthsSaved).toBeNull();
  });
});
