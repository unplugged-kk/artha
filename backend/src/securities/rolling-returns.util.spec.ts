import { PricePoint } from "../common/time-series/price-boundary.util";
import { computeRollingReturns } from "./rolling-returns.util";
import { RollingPeriodResult } from "./performance-comparison.types";

/**
 * `docs/specs/fund-rolling-returns.md` section 10, U1-U18, against the section 8
 * fixtures. Each case names the naive implementation it defeats; the expected
 * values are hand-computed in the spec, not produced by this code.
 */

function period(
  result: ReturnType<typeof computeRollingReturns>,
  name: "1Y" | "3Y" | "5Y",
): RollingPeriodResult {
  const found = result.periods.find((p) => p.period === name);
  if (!found) throw new Error(`no ${name}`);
  return found;
}

function pts(entries: Array<[string, number]>): PricePoint[] {
  return entries.map(([date, close]) => ({ date, close }));
}

/** FX-A: sparse. */
const FX_A = pts([
  ["2021-06-30", 80],
  ["2023-06-30", 100],
  ["2025-06-30", 160],
  ["2026-06-30", 200],
]);

/** Every weekday in [from, to], priced by `navFor`. */
function weekdays(
  from: string,
  to: string,
  navFor: (date: string) => number,
): PricePoint[] {
  const out: PricePoint[] = [];
  for (
    let d = new Date(`${from}T00:00:00Z`);
    d <= new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue;
    const date = d.toISOString().slice(0, 10);
    out.push({ date, close: navFor(date) });
  }
  return out;
}

/** FX-R: dense step function. */
function fxR(): PricePoint[] {
  return weekdays("2024-01-01", "2026-06-30", (date) => {
    if (date <= "2024-12-31") return 100;
    if (date <= "2025-06-30") return 120;
    if (date <= "2025-12-31") return 90;
    return 135;
  });
}

describe("computeRollingReturns", () => {
  it("returns the periods in the fixed order with their shape", () => {
    const result = computeRollingReturns(FX_A, "2026-07-01");
    expect(
      result.periods.map((p) => [p.period, p.months, p.annualized]),
    ).toEqual([
      ["1Y", 12, false],
      ["3Y", 36, true],
      ["5Y", 60, true],
    ]);
  });

  it("U1 FX-A: the section 8 table", () => {
    const result = computeRollingReturns(FX_A, "2026-07-01");

    expect(period(result, "1Y")).toEqual({
      period: "1Y",
      months: 12,
      annualized: false,
      status: "OK",
      completeness: "incomplete",
      windowCount: 1,
      missingWindowCount: 2,
      min: { returnPct: 25, startDate: "2025-06-30", endDate: "2026-06-30" },
      max: { returnPct: 25, startDate: "2025-06-30", endDate: "2026-06-30" },
      median: 25,
      mean: 25,
      positiveShare: 100,
      gaps: [{ from: "2023-06-30", to: "2025-06-30" }],
    });

    const threeY = period(result, "3Y");
    expect(threeY.status).toBe("OK");
    expect(threeY.windowCount).toBe(1);
    expect(threeY.missingWindowCount).toBe(1);
    expect(threeY.completeness).toBe("incomplete");
    expect(threeY.gaps).toEqual([{ from: "2025-06-30", to: "2025-06-30" }]);
    expect(threeY.min).toEqual({
      returnPct: 25.9855,
      startDate: "2023-06-30",
      endDate: "2026-06-30",
    });
    expect(threeY.median).toBe(25.9855);
    expect(threeY.mean).toBe(25.9855);
    expect(threeY.positiveShare).toBe(100);

    const fiveY = period(result, "5Y");
    expect(fiveY.status).toBe("OK");
    expect(fiveY.completeness).toBe("complete");
    expect(fiveY.windowCount).toBe(1);
    expect(fiveY.missingWindowCount).toBe(0);
    expect(fiveY.gaps).toEqual([]);
    expect(fiveY.max).toEqual({
      returnPct: 20.1155,
      startDate: "2021-06-30",
      endDate: "2026-06-30",
    });

    expect(result.history).toEqual({
      firstDate: "2021-06-30",
      lastDate: "2026-06-30",
      observationCount: 4,
      excludedObservationCount: 0,
      lastIsStale: false,
    });
  });

  it("U2 annualizes on actual days / 365.25 (not 365, not nominal 1/N)", () => {
    const fiveY = period(computeRollingReturns(FX_A, "2026-07-01"), "5Y");
    expect(fiveY.mean).toBe(20.1155);
    expect(fiveY.mean).not.toBe(20.1004);
    expect(fiveY.mean).not.toBe(20.1124);
  });

  it("U3 FX-R: counts computed windows only, never pre-history ends", () => {
    const points = fxR();
    expect(points).toHaveLength(652);
    const result = computeRollingReturns(points, "2026-06-30");
    const oneY = period(result, "1Y");
    expect(oneY).toEqual({
      period: "1Y",
      months: 12,
      annualized: false,
      status: "OK",
      completeness: "complete",
      windowCount: 390,
      missingWindowCount: 0,
      min: { returnPct: -10, startDate: "2024-07-01", endDate: "2025-07-01" },
      max: { returnPct: 20, startDate: "2024-01-01", endDate: "2025-01-01" },
      median: 12.5,
      mean: 7.3654,
      positiveShare: 66.1538,
      gaps: [],
    });
    for (const name of ["3Y", "5Y"] as const) {
      const p = period(result, name);
      expect(p.status).toBe("INSUFFICIENT_HISTORY");
      expect(p.windowCount).toBe(0);
      expect(p.missingWindowCount).toBe(0);
      expect(p.completeness).toBe("complete");
      expect([p.min, p.max, p.median, p.mean, p.positiveShare]).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
    }
  });

  it("U4 FX-R-hole: a start older than 14 days is missing; exactly 14 is computed", () => {
    const points = fxR().filter(
      (p) => p.date < "2024-05-01" || p.date > "2024-05-20",
    );
    const oneY = period(computeRollingReturns(points, "2026-06-30"), "1Y");
    expect(oneY.windowCount).toBe(386);
    expect(oneY.missingWindowCount).toBe(4);
    expect(oneY.gaps).toEqual([{ from: "2025-05-15", to: "2025-05-20" }]);
    expect(oneY.mean).toBe(7.2345);
    expect(oneY.median).toBe(12.5);
    expect(oneY.positiveShare).toBe(65.8031);
    expect(oneY.completeness).toBe("incomplete");
    expect(oneY.status).toBe("OK");
  });

  it("U5 leap day: 2024-02-29 minus 12 months is 2023-02-28", () => {
    const oneY = period(
      computeRollingReturns(
        pts([
          ["2023-02-28", 100],
          ["2023-03-01", 500],
          ["2024-02-29", 120],
        ]),
        "2024-02-29",
      ),
      "1Y",
    );
    expect(oneY.windowCount).toBe(1);
    expect(oneY.max).toEqual({
      returnPct: 20,
      startDate: "2023-02-28",
      endDate: "2024-02-29",
    });
  });

  it("U6 weekend start: the last NAV before the target, never forward or nearest", () => {
    const oneY = period(
      computeRollingReturns(
        pts([
          ["2025-06-26", 90],
          ["2025-06-27", 100],
          ["2025-06-30", 999],
          ["2026-06-29", 150],
        ]),
        "2026-06-29",
      ),
      "1Y",
    );
    expect(oneY.windowCount).toBe(1);
    expect(oneY.max).toEqual({
      returnPct: 50,
      startDate: "2025-06-27",
      endDate: "2026-06-29",
    });
  });

  it("U7 1Y is absolute, not annualized over 366 days", () => {
    const oneY = period(
      computeRollingReturns(
        pts([
          ["2023-03-01", 100],
          ["2024-03-01", 110],
        ]),
        "2024-03-01",
      ),
      "1Y",
    );
    expect(oneY.mean).toBe(10);
    expect(oneY.mean).not.toBe(9.9785);
  });

  it("U8 annualized gains and losses keep their sign (no abs, no clamp)", () => {
    const threeY = (end: number) =>
      period(
        computeRollingReturns(
          pts([
            ["2023-06-30", 100],
            ["2026-06-30", end],
          ]),
          "2026-06-30",
        ),
        "3Y",
      );
    expect(threeY(150).mean).toBe(14.4679);
    expect(threeY(50).mean).toBe(-20.6258);
    expect(threeY(50).positiveShare).toBe(0);
  });

  it("U9 excludes a zero NAV and a future-dated row, falling back within the lag", () => {
    const withZero = pts([
      ["2021-06-30", 80],
      ["2023-06-30", 100],
      ["2025-06-28", 150],
      ["2025-06-30", 0],
      ["2026-06-30", 200],
    ]);
    const result = computeRollingReturns(withZero, "2026-07-01");
    const oneY = period(result, "1Y");
    expect(result.history.excludedObservationCount).toBe(1);
    expect(result.history.observationCount).toBe(4);
    expect(oneY.windowCount).toBe(1);
    expect(oneY.max).toEqual({
      returnPct: 33.3333,
      startDate: "2025-06-28",
      endDate: "2026-06-30",
    });

    const withFuture = computeRollingReturns(
      [...withZero, { date: "2026-07-02", close: 10_000 }],
      "2026-07-01",
    );
    expect(withFuture.history.excludedObservationCount).toBe(2);
    expect(withFuture.periods).toEqual(result.periods);
    expect(withFuture.history.lastDate).toBe("2026-06-30");
  });

  it("U9 excludes a non-finite or negative NAV", () => {
    const result = computeRollingReturns(
      pts([
        ["2025-06-27", Number.NaN],
        ["2025-06-30", -5],
        ["2026-06-30", 200],
      ]),
      "2026-06-30",
    );
    expect(result.history.excludedObservationCount).toBe(2);
    expect(result.history.firstDate).toBe("2026-06-30");
    expect(period(result, "1Y").status).toBe("INSUFFICIENT_HISTORY");
  });

  it("U10 empty series: every period NO_PRICE_HISTORY", () => {
    const result = computeRollingReturns([], "2026-06-30");
    expect(result.history).toEqual({
      firstDate: null,
      lastDate: null,
      observationCount: 0,
      excludedObservationCount: 0,
      lastIsStale: false,
    });
    for (const p of result.periods) {
      expect(p).toMatchObject({
        status: "NO_PRICE_HISTORY",
        completeness: "complete",
        windowCount: 0,
        missingWindowCount: 0,
        min: null,
        max: null,
        median: null,
        mean: null,
        positiveShare: null,
        gaps: [],
      });
    }
  });

  it("U11 2.5 years of history has no 3Y figure", () => {
    const points = weekdays("2024-01-01", "2026-06-30", () => 100).map(
      (p, i) => ({ ...p, close: 100 + i }),
    );
    const threeY = period(computeRollingReturns(points, "2026-06-30"), "3Y");
    expect(threeY.status).toBe("INSUFFICIENT_HISTORY");
    expect(threeY.mean).toBeNull();
    expect(threeY.windowCount).toBe(0);
  });

  it("U12 every start target in a hole: ALL_WINDOWS_MISSING, never 0%", () => {
    const result = computeRollingReturns(
      pts([
        ["2020-01-01", 100],
        ["2022-06-01", 110],
        ["2022-06-02", 111],
      ]),
      "2022-06-02",
    );
    const oneY = period(result, "1Y");
    expect(oneY).toMatchObject({
      status: "ALL_WINDOWS_MISSING",
      completeness: "incomplete",
      windowCount: 0,
      missingWindowCount: 2,
      min: null,
      max: null,
      median: null,
      mean: null,
      positiveShare: null,
      gaps: [{ from: "2022-06-01", to: "2022-06-02" }],
    });
  });

  it("U13 an even count's median is the mean of the two middle values", () => {
    const oneY = period(
      computeRollingReturns(
        pts([
          ["2023-01-02", 100],
          ["2023-01-03", 100],
          ["2024-01-02", 110],
          ["2024-01-03", 130],
        ]),
        "2024-01-03",
      ),
      "1Y",
    );
    expect(oneY.windowCount).toBe(2);
    expect(oneY.median).toBe(20);
  });

  it("U14 a return of exactly 0 is not positive; ties keep the earliest end", () => {
    const oneY = period(
      computeRollingReturns(
        pts([
          ["2023-01-02", 100],
          ["2023-01-03", 100],
          ["2023-01-04", 100],
          ["2024-01-02", 100],
          ["2024-01-03", 100],
          ["2024-01-04", 110],
        ]),
        "2024-01-04",
      ),
      "1Y",
    );
    expect(oneY.windowCount).toBe(3);
    expect(oneY.positiveShare).toBe(33.3333);
    expect(oneY.min).toEqual({
      returnPct: 0,
      startDate: "2023-01-02",
      endDate: "2024-01-02",
    });
  });

  it("U15 throws on unsorted or duplicate input", () => {
    expect(() =>
      computeRollingReturns(
        pts([
          ["2024-01-02", 100],
          ["2024-01-01", 100],
        ]),
        "2024-01-02",
      ),
    ).toThrow(/strictly ascending/);
    expect(() =>
      computeRollingReturns(
        pts([
          ["2024-01-02", 100],
          ["2024-01-02", 101],
        ]),
        "2024-01-02",
      ),
    ).toThrow(/strictly ascending/);
  });

  it("U16 a stale feed is flagged without dropping any window", () => {
    const fresh = computeRollingReturns(FX_A, "2026-06-30");
    const stale = computeRollingReturns(FX_A, "2026-07-30");
    expect(fresh.history.lastIsStale).toBe(false);
    expect(stale.history.lastIsStale).toBe(true);
    expect(stale.periods).toEqual(fresh.periods);
    // 14 days is still fresh; 15 is stale.
    expect(computeRollingReturns(FX_A, "2026-07-14").history.lastIsStale).toBe(
      false,
    );
    expect(computeRollingReturns(FX_A, "2026-07-15").history.lastIsStale).toBe(
      true,
    );
  });

  it("U17 statistics come from unrounded returns, rounded once", () => {
    // Windows of 0.00016 and 0.00026 percentage points. Rounded first they are
    // 0.0002 and 0.0003, whose mean/median 0.00025 rounds to 0.0003; the
    // unrounded mean 0.00021 rounds to 0.0002.
    const oneY = period(
      computeRollingReturns(
        pts([
          ["2023-01-02", 1_000_000],
          ["2023-01-03", 1_000_000],
          ["2024-01-02", 1_000_001.6],
          ["2024-01-03", 1_000_002.6],
        ]),
        "2024-01-03",
      ),
      "1Y",
    );
    expect(oneY.median).toBe(0.0002);
    expect(oneY.mean).toBe(0.0002);
    expect(oneY.min?.returnPct).toBe(0.0002);
    expect(oneY.max?.returnPct).toBe(0.0003);
  });

  it("U18 output is identical under any process time zone", () => {
    const original = process.env.TZ;
    try {
      const outputs = [
        "UTC",
        "Asia/Kolkata",
        "America/Los_Angeles",
        "Pacific/Kiritimati",
      ].map((tz) => {
        process.env.TZ = tz;
        return JSON.stringify([
          computeRollingReturns(FX_A, "2026-07-01"),
          computeRollingReturns(fxR(), "2026-06-30"),
          computeRollingReturns(
            pts([
              ["2023-02-28", 100],
              ["2023-03-01", 500],
              ["2024-02-29", 120],
            ]),
            "2024-02-29",
          ),
        ]);
      });
      expect(new Set(outputs).size).toBe(1);
    } finally {
      process.env.TZ = original;
    }
  });
});
