import { ConcentrationSlice, computeConcentration } from "./concentration.util";

function security(name: string, value: number): ConcentrationSlice {
  return { name, value };
}

const CASH: ConcentrationSlice = { name: "Cash", value: 0, isCash: true };

/** Convenience: the whole result for a set of securities, no cash. */
function concentrationOf(slices: ConcentrationSlice[]) {
  return computeConcentration({
    slices,
    currencyCode: "USD",
    unpricedPositions: 0,
    missingRatePairs: [],
  });
}

describe("computeConcentration — single and equal weights", () => {
  it("a single holding is perfectly concentrated", () => {
    const result = concentrationOf([security("Only", 1000)]);
    const holdings = result.holdings!;

    expect(holdings.positions).toBe(1);
    expect(holdings.drawnValue).toBe(1000);
    expect(holdings.herfindahl).toBeCloseTo(1, 12);
    expect(holdings.effectiveHoldings).toBeCloseTo(1, 12);
    expect(holdings.top1Percent).toBeCloseTo(100, 10);
    expect(holdings.top5Percent).toBeCloseTo(100, 10);
    expect(result.status).toBe("complete");
  });

  it("two equal holdings give HHI 0.5 and an effective count of two", () => {
    const holdings = concentrationOf([
      security("A", 500),
      security("B", 500),
    ]).holdings!;

    expect(holdings.herfindahl).toBeCloseTo(0.5, 12);
    expect(holdings.effectiveHoldings).toBeCloseTo(2, 12);
    expect(holdings.top1Percent).toBeCloseTo(50, 10);
    expect(holdings.top5Percent).toBeCloseTo(100, 10);
  });

  it.each([2, 3, 4, 5, 8, 10])(
    "an evenly distributed portfolio of %i gives HHI 1/n and effective n",
    (n) => {
      const slices = Array.from({ length: n }, (_, i) =>
        security(`S${i}`, 1000 / n),
      );
      const holdings = concentrationOf(slices).holdings!;

      expect(holdings.positions).toBe(n);
      expect(holdings.herfindahl).toBeCloseTo(1 / n, 12);
      expect(holdings.effectiveHoldings).toBeCloseTo(n, 9);
      expect(holdings.top5Percent).toBeCloseTo((Math.min(n, 5) / n) * 100, 9);
    },
  );

  it("an evenly distributed portfolio is the least concentrated for its count", () => {
    const equal = concentrationOf([
      security("A", 250),
      security("B", 250),
      security("C", 250),
      security("D", 250),
    ]).holdings!;
    const uneven = concentrationOf([
      security("A", 700),
      security("B", 100),
      security("C", 100),
      security("D", 100),
    ]).holdings!;

    expect(equal.positions).toBe(uneven.positions);
    expect(equal.herfindahl).toBeLessThan(uneven.herfindahl);
    expect(equal.effectiveHoldings).toBeGreaterThan(uneven.effectiveHoldings);
  });
});

describe("computeConcentration — concentration", () => {
  it("a highly concentrated portfolio approaches one effective holding", () => {
    const holdings = concentrationOf([
      security("Big", 90),
      security("Tiny", 10),
    ]).holdings!;

    expect(holdings.herfindahl).toBeCloseTo(0.82, 12);
    expect(holdings.effectiveHoldings).toBeCloseTo(1 / 0.82, 9);
    expect(holdings.top1Percent).toBeCloseTo(90, 10);
    expect(holdings.top5Percent).toBeCloseTo(100, 10);
  });

  it("summarises a realistic book: the largest five, and the index over all of it", () => {
    // Ten positions: 40/25/15, then seven of 20/7 each.
    const slices = [
      security("A", 40),
      security("B", 25),
      security("C", 15),
      ...Array.from({ length: 7 }, (_, i) => security(`S${i}`, 20 / 7)),
    ];
    const holdings = concentrationOf(slices).holdings!;

    expect(holdings.positions).toBe(10);
    expect(holdings.top1Percent).toBeCloseTo(40, 9);
    expect(holdings.top5Percent).toBeCloseTo(40 + 25 + 15 + (20 / 7) * 2, 8);
    expect(holdings.largest).toHaveLength(5);
    expect(holdings.largest.map((p) => p.name)).toEqual([
      "A",
      "B",
      "C",
      "S0",
      "S1",
    ]);
    expect(holdings.largest[0].percent).toBeCloseTo(40, 9);
    // Every weight, summed, is the whole portfolio.
    expect(slices.reduce((sum, s) => sum + s.value, 0)).toBeCloseTo(
      holdings.drawnValue,
      9,
    );
  });

  it("lists every position when there are fewer than five", () => {
    const holdings = concentrationOf([
      security("A", 60),
      security("B", 40),
    ]).holdings!;

    expect(holdings.largest).toHaveLength(2);
  });

  it("keeps effective holdings at or below the position count", () => {
    const holdings = concentrationOf([
      security("A", 500),
      security("B", 300),
      security("C", 200),
    ]).holdings!;

    expect(holdings.effectiveHoldings).toBeLessThanOrEqual(holdings.positions);
    expect(holdings.effectiveHoldings).toBeGreaterThan(1);
  });
});

describe("computeConcentration — the two bases", () => {
  it("excludes cash from the holdings basis and includes it in the portfolio basis", () => {
    const result = computeConcentration({
      slices: [security("Fund", 750), { ...CASH, value: 250 }],
      currencyCode: "USD",
      unpricedPositions: 0,
      missingRatePairs: [],
    });

    // Holdings: one position worth 750 of its own basis.
    expect(result.holdings!.drawnValue).toBe(750);
    expect(result.holdings!.positions).toBe(1);
    expect(result.holdings!.herfindahl).toBeCloseTo(1, 12);

    // Portfolio: 750 + 250, two equal-weight slices.
    expect(result.portfolio!.drawnValue).toBe(1000);
    expect(result.portfolio!.positions).toBe(2);
    expect(result.portfolio!.herfindahl).toBeCloseTo(0.625, 12);
    expect(result.portfolio!.top1Percent).toBeCloseTo(75, 9);

    expect(result.currencyCode).toBe("USD");
    expect(result.status).toBe("complete");
  });

  it("reports a cash-only portfolio as fully concentrated, with no holdings basis", () => {
    const result = computeConcentration({
      slices: [{ ...CASH, value: 500 }],
      currencyCode: "INR",
      unpricedPositions: 0,
      missingRatePairs: [],
    });

    expect(result.holdings).toBeNull();
    expect(result.portfolio!.positions).toBe(1);
    expect(result.portfolio!.herfindahl).toBeCloseTo(1, 12);
    expect(result.status).toBe("complete");
  });

  it("does not let negative cash inflate the weights", () => {
    // A margin balance: the drawn total is the 1000 of securities, not 1000-400.
    const result = computeConcentration({
      slices: [security("Fund", 1000), { ...CASH, value: -400 }],
      currencyCode: "USD",
      unpricedPositions: 0,
      missingRatePairs: [],
    });

    expect(result.portfolio!.drawnValue).toBe(1000);
    expect(result.portfolio!.positions).toBe(1);
    expect(result.portfolio!.top1Percent).toBeCloseTo(100, 9);
  });

  it("is unavailable when nothing is drawn at all", () => {
    const result = computeConcentration({
      slices: [],
      currencyCode: "USD",
      unpricedPositions: 0,
      missingRatePairs: [],
    });

    expect(result.holdings).toBeNull();
    expect(result.portfolio).toBeNull();
    expect(result.status).toBe("unavailable");
  });
});

describe("computeConcentration — incomplete data", () => {
  it("marks the result partial and carries the counts when a holding is unpriced", () => {
    const result = computeConcentration({
      slices: [security("Priced", 800), security("Other priced", 200)],
      currencyCode: "INR",
      unpricedPositions: 1,
      missingRatePairs: [],
    });

    expect(result.status).toBe("partial");
    expect(result.unpricedPositions).toBe(1);
    // The measure describes the priced part only, which is what it says it does.
    expect(result.portfolio!.drawnValue).toBe(1000);
  });

  it("marks the result partial when a rate is missing", () => {
    const result = computeConcentration({
      slices: [security("Priced", 100)],
      currencyCode: "USD",
      unpricedPositions: 0,
      missingRatePairs: ["EUR->USD"],
    });

    expect(result.status).toBe("partial");
    expect(result.missingRatePairs).toEqual(["EUR->USD"]);
  });

  it("counts a zero-value position, gives it no weight, and says so", () => {
    const result = computeConcentration({
      slices: [security("Real", 500), security("Worthless", 0)],
      currencyCode: "USD",
      unpricedPositions: 0,
      missingRatePairs: [],
      nonPositiveValuePositions: 1,
    });

    expect(result.portfolio!.positions).toBe(1);
    expect(result.portfolio!.drawnValue).toBe(500);
    expect(result.portfolio!.herfindahl).toBeCloseTo(1, 12);
    expect(result.nonPositiveValuePositions).toBe(1);
    expect(result.status).toBe("partial");
  });

  it("is complete only when nothing is excluded", () => {
    const result = computeConcentration({
      slices: [security("A", 100), security("B", 100)],
      currencyCode: "USD",
      unpricedPositions: 0,
      missingRatePairs: [],
      nonPositiveValuePositions: 0,
    });

    expect(result.status).toBe("complete");
    expect(result.pricedPositions).toBe(2);
  });

  it("still measures the priced part of a partially priced portfolio", () => {
    const result = computeConcentration({
      slices: [security("A", 300), security("B", 100)],
      currencyCode: "INR",
      unpricedPositions: 3,
      missingRatePairs: ["USD->INR"],
      nonPositiveValuePositions: 1,
    });

    expect(result.status).toBe("partial");
    expect(result.pricedPositions).toBe(2);
    expect(result.unpricedPositions).toBe(3);
    expect(result.nonPositiveValuePositions).toBe(1);
    expect(result.missingRatePairs).toEqual(["USD->INR"]);
    expect(result.holdings!.herfindahl).toBeCloseTo(
      0.75 * 0.75 + 0.25 * 0.25,
      12,
    );
  });

  it("treats a position held across accounts as one slice, because the input already is", () => {
    // The allocation builder consolidates by security before this runs; the same
    // fund in two accounts arrives as one slice, and the measure must not undo
    // that by counting it twice.
    const result = concentrationOf([
      security("Consolidated fund", 900),
      security("Other", 100),
    ]);

    expect(result.holdings!.positions).toBe(2);
    expect(result.holdings!.top1Percent).toBeCloseTo(90, 9);
  });

  it("measures in the reporting currency it was given", () => {
    const result = computeConcentration({
      slices: [security("A", 6000), security("B", 2000)],
      currencyCode: "INR",
      unpricedPositions: 0,
      missingRatePairs: [],
    });

    expect(result.currencyCode).toBe("INR");
    expect(result.holdings!.drawnValue).toBe(8000);
    expect(result.holdings!.top1Percent).toBeCloseTo(75, 9);
  });
});
