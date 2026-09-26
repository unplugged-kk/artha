import { roundToDecimals } from "../common/round.util";
import {
  BOUNDARY_LAG_DAYS,
  PricePoint,
  daysBetween,
  observationAt,
} from "../common/time-series/price-boundary.util";
import { addMonthsUtc, parseYmd } from "../strategies/gem-momentum.util";
import {
  FundRollingReturnsHistory,
  RollingPeriodResult,
  RollingReturnExtreme,
  RollingReturnGap,
  RollingReturnPeriod,
} from "./performance-comparison.types";

/**
 * Rolling returns of a mutual fund's NAV series.
 *
 * `docs/specs/fund-rolling-returns.md` is the specification: every usable NAV
 * date is a candidate window end, its start is the last usable NAV at or before
 * the same calendar date `months` earlier and at most `BOUNDARY_LAG_DAYS` older,
 * and a window whose start cannot be resolved is counted and located, never 0.
 *
 * Pure: no database, no wall clock. `today` is a parameter.
 */

/** Percentage points, rounded once at the edge like every return figure. */
const PP_DECIMALS = 4;

/** The price-CAGR year (see `DAYS_PER_YEAR` in gem-backtest.util.ts). */
const DAYS_PER_YEAR = 365.25;

const PERIODS: ReadonlyArray<{ period: RollingReturnPeriod; months: number }> =
  [
    { period: "1Y", months: 12 },
    { period: "3Y", months: 36 },
    { period: "5Y", months: 60 },
  ];

interface Window {
  startDate: string;
  endDate: string;
  /** Unrounded percentage points. */
  returnPct: number;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 12 months or less is absolute; longer periods are per annum on actual days. */
function windowReturn(
  start: PricePoint,
  end: PricePoint,
  months: number,
): number {
  const ratio = end.close / start.close;
  if (months <= 12) return (ratio - 1) * 100;
  const days = daysBetween(start.date, end.date);
  return (Math.pow(ratio, DAYS_PER_YEAR / days) - 1) * 100;
}

function round(value: number): number {
  return roundToDecimals(value, PP_DECIMALS);
}

function roundExtreme(window: Window): RollingReturnExtreme {
  return {
    returnPct: round(window.returnPct),
    startDate: window.startDate,
    endDate: window.endDate,
  };
}

function periodResult(
  period: RollingReturnPeriod,
  months: number,
  usable: PricePoint[],
): RollingPeriodResult {
  const windows: Window[] = [];
  const gaps: RollingReturnGap[] = [];
  let missing = 0;
  let open: RollingReturnGap | null = null;
  const firstDate = usable.length > 0 ? usable[0].date : "";

  for (const end of usable) {
    const target = isoDate(addMonthsUtc(parseYmd(end.date), -months));
    // Pre-history: not a window, not a gap, not counted.
    if (target < firstDate) continue;
    const start = observationAt(usable, target, BOUNDARY_LAG_DAYS);
    if (!start) {
      missing += 1;
      open = open
        ? { from: open.from, to: end.date }
        : { from: end.date, to: end.date };
      continue;
    }
    if (open) {
      gaps.push(open);
      open = null;
    }
    if (start.date >= end.date) {
      throw new Error(
        `Rolling window start ${start.date} is not before its end ${end.date}`,
      );
    }
    windows.push({
      startDate: start.date,
      endDate: end.date,
      returnPct: windowReturn(start, end, months),
    });
  }
  if (open) gaps.push(open);

  const base = {
    period,
    months,
    annualized: months > 12,
    completeness: missing > 0 ? ("incomplete" as const) : ("complete" as const),
    windowCount: windows.length,
    missingWindowCount: missing,
    gaps,
  };

  if (windows.length === 0) {
    return {
      ...base,
      status:
        missing > 0
          ? "ALL_WINDOWS_MISSING"
          : usable.length > 0
            ? "INSUFFICIENT_HISTORY"
            : "NO_PRICE_HISTORY",
      min: null,
      max: null,
      median: null,
      mean: null,
      positiveShare: null,
    };
  }

  // Strict comparisons keep the earliest end on a tie.
  let min = windows[0];
  let max = windows[0];
  for (const window of windows) {
    if (window.returnPct < min.returnPct) min = window;
    if (window.returnPct > max.returnPct) max = window;
  }
  const sorted = windows.map((w) => w.returnPct).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const positives = sorted.filter((value) => value > 0).length;

  return {
    ...base,
    status: "OK",
    min: roundExtreme(min),
    max: roundExtreme(max),
    median: round(median),
    mean: round(mean),
    positiveShare: round((100 * positives) / windows.length),
  };
}

/**
 * The rolling-return distribution for 1Y, 3Y and 5Y over `points`.
 *
 * `points` must be strictly ascending by date with no duplicates -- the
 * database guarantees it (`UNIQUE(security_id, price_date)`), so anything else
 * is a programming error and throws rather than producing silently wrong
 * windows. Non-finite, non-positive and future-dated (`> today`) closes are
 * excluded and counted.
 */
export function computeRollingReturns(
  points: PricePoint[],
  today: string,
): { history: FundRollingReturnsHistory; periods: RollingPeriodResult[] } {
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].date <= points[i - 1].date) {
      throw new Error(
        `Price points must be strictly ascending: ${points[i - 1].date} then ${points[i].date}`,
      );
    }
  }

  const usable = points.filter(
    (point) =>
      Number.isFinite(point.close) && point.close > 0 && point.date <= today,
  );
  const lastDate = usable.length > 0 ? usable[usable.length - 1].date : null;

  return {
    history: {
      firstDate: usable[0]?.date ?? null,
      lastDate,
      observationCount: usable.length,
      excludedObservationCount: points.length - usable.length,
      lastIsStale:
        lastDate !== null && daysBetween(lastDate, today) > BOUNDARY_LAG_DAYS,
    },
    periods: PERIODS.map(({ period, months }) =>
      periodResult(period, months, usable),
    ),
  };
}
