/**
 * XIRR: the annualized money-weighted return of an irregular cash-flow series.
 *
 * **Convention** (documented because a sign or day-count convention that lives
 * only in code is a defect waiting to be inherited):
 *
 *   - A flow's `amount` is signed from the **investor's** perspective, which is
 *     also Artha's cash-account perspective: **negative = money contributed**
 *     (a purchase, a fee, tax withheld), **positive = money received** (a sale,
 *     a dividend, and the terminal value).
 *   - The rate `r` solves `Σ CFᵢ · (1 + r)^(−tᵢ/365) = 0`, where `tᵢ` is the
 *     whole-day distance from the **earliest** flow, so the earliest flow sits
 *     at `t = 0` and is undiscounted. Days, not months, and a 365-day year.
 *   - The result is a **percentage**, matching `calculateCAGR` — `14.28` means
 *     14.28% a year, not 1428%. The name carries the unit.
 *
 * **Method.** A fixed rate grid is scanned upward and the **first** bracket that
 * changes the sign of the residual is bisected to convergence. Bisection is
 * chosen over Newton-Raphson deliberately: it cannot diverge, it needs only a
 * bracket rather than a derivative, and its result is reproducible iteration for
 * iteration. The cost is speed, which is irrelevant at portfolio scale.
 *
 * **No solution is `null`.** A series with no sign change, fewer than two flows,
 * only same-day flows, or any non-finite amount has no meaningful rate, and this
 * returns `null` rather than a plausible-looking number. A caller must handle
 * that as "cannot be computed", never as 0%.
 *
 * **Multiple roots.** A series whose sign changes more than once can have more
 * than one rate that solves it. The grid scan makes the choice deterministic: the
 * root in the lowest bracket wins, which is the conventional result for the
 * normal pattern of contributions followed by withdrawals. The alternative —
 * whichever root an iterative method happens to fall into — is not reproducible.
 */

/** One dated cash flow. `date` is `YYYY-MM-DD`; `amount` is signed. */
export interface CashFlow {
  date: string;
  amount: number;
}

/** Absolute residual at which a rate is accepted as a root. */
export const XIRR_TOLERANCE = 1e-9;
/** Bisection cap; reached only when the bracket is already vanishingly small. */
export const XIRR_MAX_ITERATIONS = 200;

/**
 * The rate grid scanned for a sign change, ascending.
 *
 * Fine below 100% and coarse above it. The fine step matters: a series with more
 * than one root can be *negative* at two grid points that straddle its whole
 * positive region, and a coarse grid would then find no bracket at all and
 * report "no solution" for a series that has two. (Found exactly that way: a
 * -100/+230/-132 series is negative at 10% by 1e-14 and negative again at 25%,
 * so a 0.1 -> 0.25 jump hid both of its roots.) The scan remains deterministic
 * and bounded; a pathological series whose positive region is narrower than the
 * step can still return null, and null is the safe answer -- it never invents a
 * rate.
 *
 * Starts above -100% because `(1 + r)` must stay positive, and rises to a rate no
 * real series reaches so an extreme return is still bracketed.
 */
const RATE_GRID: readonly number[] = buildRateGrid();

function buildRateGrid(): number[] {
  const grid: number[] = [];
  for (let step = 0; step <= 400; step += 1) {
    grid.push(Number((-0.9999 + step * 0.005).toFixed(4)));
  }
  grid.push(1, 2, 5, 10, 100, 1_000, 1e6);
  return grid;
}

/** Whole days between two `YYYY-MM-DD` dates, or null when either is malformed. */
function daysBetween(from: string, to: string): number | null {
  const parse = (date: string): number | null => {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
    if (!parts) return null;
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const utc = Date.UTC(year, month - 1, day);
    const roundTrip = new Date(utc);
    if (
      roundTrip.getUTCFullYear() !== year ||
      roundTrip.getUTCMonth() !== month - 1 ||
      roundTrip.getUTCDate() !== day
    ) {
      return null;
    }
    return utc;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

/** A usable flow: finite amount, real date. Anything else is rejected. */
function normalize(flows: readonly CashFlow[]): CashFlow[] | null {
  if (!Array.isArray(flows) || flows.length < 2) return null;
  const clean: CashFlow[] = [];
  for (const flow of flows) {
    if (!flow || typeof flow.date !== "string") return null;
    const amount = Number(flow.amount);
    if (!Number.isFinite(amount)) return null;
    if (daysBetween(flow.date, flow.date) === null) return null;
    clean.push({ date: flow.date, amount });
  }
  return clean.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The annualized money-weighted return as a percentage, or null when the series
 * has no computable rate.
 */
export function calculateXirrPercent(
  flows: readonly CashFlow[],
): number | null {
  const clean = normalize(flows);
  if (!clean) return null;

  const start = clean[0].date;
  const spans = clean.map((flow) => daysBetween(start, flow.date));
  if (spans.some((span) => span === null)) return null;
  const days = spans as number[];

  // Every flow on one day: the residual does not depend on the rate at all, so
  // there is nothing to solve for. (A zero sum would be satisfied by *every*
  // rate, which is not an answer.)
  if (days.every((day) => day === 0)) return null;

  const residual = (rate: number): number => {
    let total = 0;
    for (let i = 0; i < clean.length; i += 1) {
      total += clean[i].amount / Math.pow(1 + rate, days[i] / 365);
    }
    return total;
  };

  const hasPositive = clean.some((flow) => flow.amount > 0);
  const hasNegative = clean.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  let lower: number | null = null;
  let upper: number | null = null;
  let lowerValue = 0;
  let upperValue = 0;

  for (let i = 0; i < RATE_GRID.length; i += 1) {
    const rate = RATE_GRID[i];
    const value = residual(rate);
    if (!Number.isFinite(value)) continue;

    if (value === 0) {
      return roundPercent(rate * 100);
    }

    if (lower === null) {
      lower = rate;
      lowerValue = value;
      continue;
    }

    if (lowerValue === 0 || lowerValue * value < 0) {
      upper = rate;
      upperValue = value;
      break;
    }

    lower = rate;
    lowerValue = value;
  }

  if (lower === null || upper === null) return null;

  let lo = lower;
  let hi = upper;
  let loValue = lowerValue;
  void upperValue;

  for (let i = 0; i < XIRR_MAX_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    const midValue = residual(mid);

    if (!Number.isFinite(midValue)) return null;
    if (Math.abs(midValue) <= XIRR_TOLERANCE || Math.abs(hi - lo) <= 1e-12) {
      return roundPercent(mid * 100);
    }

    if (loValue * midValue <= 0) {
      hi = mid;
    } else {
      lo = mid;
      loValue = midValue;
    }
  }

  return roundPercent(((lo + hi) / 2) * 100);
}

/**
 * Round the reported rate to 6 decimal places of a percentage.
 *
 * A rate derived from an iterative solve has no meaningful digits beyond a few;
 * rounding here keeps a stored or rendered figure stable across runs rather than
 * exposing the iteration's last bits.
 */
function roundPercent(percent: number): number {
  return Math.round(percent * 1e6) / 1e6;
}
