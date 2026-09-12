import { CashFlow, calculateXirrPercent } from "./xirr.util";

/**
 * The definition, restated independently of the implementation: the residual
 * must be zero at the solved rate. Asserting this alongside the closed-form
 * cases is what makes the irregular-interval cases checkable at all -- there is
 * no closed form to compare against.
 */
function residualAt(flows: CashFlow[], percent: number): number {
  const start = flows.map((f) => f.date).sort()[0];
  const day = (date: string) =>
    Math.round(
      (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86_400_000,
    );
  return flows.reduce(
    (sum, flow) =>
      sum + flow.amount / Math.pow(1 + percent / 100, day(flow.date) / 365),
    0,
  );
}

/**
 * The residual relative to the cash-flow scale.
 *
 * The reported rate is rounded, so its residual is bounded by that rounding
 * times the derivative of the residual -- which scales with the amounts. A
 * relative bound is therefore the honest one: it says "zero to within the
 * precision a rate is reported at", independent of whether the portfolio is
 * 1,000 or 1,000,000.
 */
function relativeResidual(flows: CashFlow[], percent: number): number {
  const scale = flows.reduce((sum, flow) => sum + Math.abs(flow.amount), 0);
  return Math.abs(residualAt(flows, percent)) / Math.max(scale, 1);
}

describe("calculateXirrPercent", () => {
  describe("closed-form cases", () => {
    it("solves a one-year 10% return", () => {
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 1100 },
      ];
      expect(calculateXirrPercent(flows)).toBeCloseTo(10, 6);
    });

    it("annualizes a two-year doubling to sqrt(2) - 1", () => {
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2027-01-01", amount: 2000 },
      ];
      expect(calculateXirrPercent(flows)).toBeCloseTo(41.421356, 5);
    });

    it("returns zero for a flat position", () => {
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2025-07-01", amount: 1000 },
      ];
      expect(calculateXirrPercent(flows)).toBeCloseTo(0, 6);
    });

    it("returns a negative rate for a loss", () => {
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 900 },
      ];
      expect(calculateXirrPercent(flows)).toBeCloseTo(-10, 6);
    });

    it("returns a large rate for a large gain", () => {
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 10000 },
      ];
      expect(calculateXirrPercent(flows)).toBeCloseTo(900, 6);
    });

    it("annualizes a seven-day gain rather than reporting it as-is", () => {
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2025-01-08", amount: 1010 },
      ];
      // (1.01)^(365/7) - 1 ~= 68%; the point is the annualization, not the 1%.
      const rate = calculateXirrPercent(flows)!;
      expect(rate).toBeGreaterThan(60);
      expect(rate).toBeLessThan(75);
    });
  });

  describe("irregular cash flows", () => {
    it("solves a series with two contributions and a final value", () => {
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2025-07-01", amount: -1000 },
        { date: "2026-01-01", amount: 2200 },
      ];
      const rate = calculateXirrPercent(flows)!;
      expect(rate).not.toBeNull();
      expect(rate).toBeGreaterThan(0);
      // The definition holds at the answer, to within the reported precision.
      expect(relativeResidual(flows, rate)).toBeLessThan(1e-8);
    });

    it("solves a series that starts deep in debt to the investor", () => {
      // Contribution, part withdrawal, then a final gain.
      const flows: CashFlow[] = [
        { date: "2024-03-15", amount: -50000 },
        { date: "2024-11-02", amount: 12000 },
        { date: "2025-06-30", amount: 45000 },
      ];
      const rate = calculateXirrPercent(flows)!;
      expect(relativeResidual(flows, rate)).toBeLessThan(1e-8);
      expect(rate).toBeGreaterThan(0);
    });

    it("is insensitive to the order the flows arrive in", () => {
      const ordered: CashFlow[] = [
        { date: "2025-01-01", amount: -1000 },
        { date: "2025-07-01", amount: -1000 },
        { date: "2026-01-01", amount: 2200 },
      ];
      const shuffled: CashFlow[] = [
        { date: "2026-01-01", amount: 2200 },
        { date: "2025-01-01", amount: -1000 },
        { date: "2025-07-01", amount: -1000 },
      ];
      expect(calculateXirrPercent(shuffled)).toBe(
        calculateXirrPercent(ordered),
      );
    });

    it("is deterministic across repeated calls", () => {
      const flows: CashFlow[] = [
        { date: "2024-03-15", amount: -50000 },
        { date: "2024-11-02", amount: 12000 },
        { date: "2025-06-30", amount: 45000 },
      ];
      expect(calculateXirrPercent(flows)).toBe(calculateXirrPercent(flows));
    });
  });

  describe("multiple roots", () => {
    it("returns the lower root deterministically", () => {
      // -100, +230, -132 solves at both 10% and 20%. Picking one by iteration
      // order would be unreproducible; the grid scan makes it the lower root.
      const flows: CashFlow[] = [
        { date: "2025-01-01", amount: -100 },
        { date: "2026-01-01", amount: 230 },
        { date: "2027-01-01", amount: -132 },
      ];
      expect(calculateXirrPercent(flows)).toBeCloseTo(10, 3);
    });
  });

  describe("no computable rate is null, never a plausible number", () => {
    it("refuses fewer than two flows", () => {
      expect(calculateXirrPercent([])).toBeNull();
      expect(
        calculateXirrPercent([{ date: "2025-01-01", amount: -1000 }]),
      ).toBeNull();
    });

    it("refuses a series with no sign change", () => {
      // All contributions, or all receipts: nothing to solve.
      expect(
        calculateXirrPercent([
          { date: "2025-01-01", amount: -1000 },
          { date: "2026-01-01", amount: -1000 },
        ]),
      ).toBeNull();
      expect(
        calculateXirrPercent([
          { date: "2025-01-01", amount: 1000 },
          { date: "2026-01-01", amount: 1000 },
        ]),
      ).toBeNull();
    });

    it("refuses a series whose flows all fall on one day", () => {
      // The residual does not depend on the rate, so no rate is the answer.
      expect(
        calculateXirrPercent([
          { date: "2025-01-01", amount: -1000 },
          { date: "2025-01-01", amount: 1000 },
        ]),
      ).toBeNull();
    });

    it("refuses a zero-amount flow set that would otherwise look balanced", () => {
      expect(
        calculateXirrPercent([
          { date: "2025-01-01", amount: 0 },
          { date: "2026-01-01", amount: 0 },
        ]),
      ).toBeNull();
    });

    it.each([
      [
        "a malformed date",
        [
          { date: "01-01-2025", amount: -1000 },
          { date: "2026-01-01", amount: 1100 },
        ],
      ],
      [
        "an impossible date",
        [
          { date: "2025-02-30", amount: -1000 },
          { date: "2026-01-01", amount: 1100 },
        ],
      ],
      [
        "a NaN amount",
        [
          { date: "2025-01-01", amount: NaN },
          { date: "2026-01-01", amount: 1100 },
        ],
      ],
      [
        "an infinite amount",
        [
          { date: "2025-01-01", amount: -Infinity },
          { date: "2026-01-01", amount: 1100 },
        ],
      ],
    ])("refuses %s", (_label, flows) => {
      expect(calculateXirrPercent(flows as CashFlow[])).toBeNull();
    });
  });
});
