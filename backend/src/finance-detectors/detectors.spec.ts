import {
  detectDuplicates,
  detectSpendingSpike,
  detectSubscriptionIncrease,
  projectLowBalance,
} from "./detectors";

describe("detectSpendingSpike", () => {
  it("needs history instead of calling a thin series normal", () => {
    expect(detectSpendingSpike([100, 120], 500)).toEqual({
      status: "insufficient_history",
      needed: 3,
    });
  });

  it("flags above mean + 2 sigma", () => {
    // mean 100, population sigma sqrt(((10)^2+0+(10)^2)/3)=8.165 => threshold 116.33
    const r = detectSpendingSpike([90, 100, 110], 117);
    expect(r).toMatchObject({ status: "ok", flagged: true, mean: 100 });
    expect(detectSpendingSpike([90, 100, 110], 116).status).toBe("ok");
    expect(
      (detectSpendingSpike([90, 100, 110], 116) as { flagged: boolean })
        .flagged,
    ).toBe(false);
  });

  it("flat history: equal spend is not a spike, any increase is", () => {
    const eq = detectSpendingSpike([100, 100, 100], 100) as {
      flagged: boolean;
    };
    const up = detectSpendingSpike([100, 100, 100], 101) as {
      flagged: boolean;
    };
    expect(eq.flagged).toBe(false);
    expect(up.flagged).toBe(true);
  });
});

describe("detectSubscriptionIncrease", () => {
  it("flags a price rise and reports it exactly", () => {
    const r = detectSubscriptionIncrease([
      { date: "2025-02-01", amount: 199 },
      { date: "2025-01-01", amount: 149 },
    ]);
    expect(r).toMatchObject({ flagged: true, increase: 50, previous: 149 });
  });

  it("a single charge is insufficient, not clean", () => {
    expect(
      detectSubscriptionIncrease([{ date: "2025-01-01", amount: 9 }]),
    ).toEqual({
      status: "insufficient_history",
    });
  });

  it("an unchanged or lower price is not flagged", () => {
    const r = detectSubscriptionIncrease([
      { date: "2025-01-01", amount: 149 },
      { date: "2025-02-01", amount: 149 },
    ]) as { flagged: boolean };
    expect(r.flagged).toBe(false);
  });
});

describe("projectLowBalance", () => {
  it("finds the first day the balance dips below the floor", () => {
    const r = projectLowBalance(1000, [
      { date: "2025-03-03", amount: -600 },
      { date: "2025-03-05", amount: -500 },
      { date: "2025-03-09", amount: 2000 },
    ]);
    expect(r).toEqual({
      breachesFloor: true,
      firstBreachDate: "2025-03-05",
      lowestBalance: -100,
      lowestBalanceDate: "2025-03-05",
    });
  });

  it("uses paise arithmetic, so 0.1 + 0.2 style drift cannot cross the floor", () => {
    const r = projectLowBalance(0.3, [
      { date: "2025-03-01", amount: -0.1 },
      { date: "2025-03-02", amount: -0.2 },
    ]);
    expect(r.breachesFloor).toBe(false);
    expect(r.lowestBalance).toBe(0);
  });

  it("no flows means no breach", () => {
    expect(projectLowBalance(50, []).breachesFloor).toBe(false);
  });
});

describe("detectDuplicates", () => {
  const t = (id: string, date: string, amount: number, payee: string) => ({
    id,
    date,
    amount,
    payee,
  });

  it("pairs same payee and amount within a day, ignoring case", () => {
    expect(
      detectDuplicates([
        t("a", "2025-03-01", 250, "Swiggy"),
        t("b", "2025-03-02", 250, "swiggy "),
        t("c", "2025-03-02", 251, "Swiggy"),
      ]),
    ).toEqual([["a", "b"]]);
  });

  it("does not pair rows outside the window", () => {
    expect(
      detectDuplicates([
        t("a", "2025-03-01", 250, "Swiggy"),
        t("b", "2025-03-05", 250, "Swiggy"),
      ]),
    ).toEqual([]);
  });
});
