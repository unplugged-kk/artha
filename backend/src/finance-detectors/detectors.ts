/**
 * Deterministic anomaly detectors. Pure: detection is never the LLM's job; the
 * model may only explain a result these return. Insufficient data is reported as
 * such, never as "no anomaly".
 */

const toPaise = (n: number): number => Math.round(n * 100);
const fromPaise = (p: number): number => p / 100;

export type SpikeResult =
  | { readonly status: "insufficient_history"; readonly needed: number }
  | {
      readonly status: "ok";
      readonly flagged: boolean;
      readonly mean: number;
      readonly sigma: number;
      readonly threshold: number;
    };

/** Flags `current` above mean + k*sigma of the history (population sigma). */
export function detectSpendingSpike(
  history: readonly number[],
  current: number,
  sigmas = 2,
  minHistory = 3,
): SpikeResult {
  if (history.length < minHistory) {
    return { status: "insufficient_history", needed: minHistory };
  }
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance =
    history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const sigma = Math.sqrt(variance);
  const threshold = mean + sigmas * sigma;
  return {
    status: "ok",
    // With zero variance any increase is infinitely many sigmas; require a real
    // increase rather than flagging equal spend.
    flagged: current > threshold,
    mean: Math.round(mean * 100) / 100,
    sigma: Math.round(sigma * 100) / 100,
    threshold: Math.round(threshold * 100) / 100,
  };
}

export interface Charge {
  readonly date: string; // YYYY-MM-DD
  readonly amount: number; // positive spend
}

export type PriceIncreaseResult =
  | { readonly status: "insufficient_history" }
  | {
      readonly status: "ok";
      readonly flagged: boolean;
      readonly previous: number;
      readonly latest: number;
      readonly increase: number;
      readonly increasePct: number;
    };

/** Latest charge vs the previous one for the same recurring payee. */
export function detectSubscriptionIncrease(
  charges: readonly Charge[],
  minIncreasePct = 1,
): PriceIncreaseResult {
  if (charges.length < 2) return { status: "insufficient_history" };
  const sorted = [...charges].sort((a, b) => a.date.localeCompare(b.date));
  const latest = toPaise(sorted[sorted.length - 1].amount);
  const previous = toPaise(sorted[sorted.length - 2].amount);
  const increase = latest - previous;
  const increasePct = previous === 0 ? 0 : (increase / previous) * 100;
  return {
    status: "ok",
    flagged: previous > 0 && increasePct >= minIncreasePct,
    previous: fromPaise(previous),
    latest: fromPaise(latest),
    increase: fromPaise(increase),
    increasePct: Math.round(increasePct * 100) / 100,
  };
}

export interface DatedFlow {
  readonly date: string;
  /** Signed: negative leaves the account. */
  readonly amount: number;
}

export interface LowBalanceResult {
  readonly breachesFloor: boolean;
  readonly firstBreachDate: string | null;
  readonly lowestBalance: number;
  readonly lowestBalanceDate: string | null;
}

/** Walks dated flows from `openingBalance`; reports the first dip below `floor`. */
export function projectLowBalance(
  openingBalance: number,
  flows: readonly DatedFlow[],
  floor = 0,
): LowBalanceResult {
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  let balance = toPaise(openingBalance);
  const floorP = toPaise(floor);
  let lowest = balance;
  let lowestDate: string | null = null;
  let firstBreach: string | null = null;
  for (const f of sorted) {
    balance += toPaise(f.amount);
    if (balance < lowest) {
      lowest = balance;
      lowestDate = f.date;
    }
    if (firstBreach === null && balance < floorP) firstBreach = f.date;
  }
  return {
    breachesFloor: firstBreach !== null,
    firstBreachDate: firstBreach,
    lowestBalance: fromPaise(lowest),
    lowestBalanceDate: lowestDate,
  };
}

export interface DuplicateCandidate {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly payee: string;
}

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/** Same payee (case-insensitive) and exact amount within `withinDays` days. */
export function detectDuplicates(
  txns: readonly DuplicateCandidate[],
  withinDays = 1,
): ReadonlyArray<readonly [string, string]> {
  const pairs: Array<readonly [string, string]> = [];
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const gap = dayNumber(sorted[j].date) - dayNumber(sorted[i].date);
      if (gap > withinDays) break;
      if (
        toPaise(sorted[i].amount) === toPaise(sorted[j].amount) &&
        sorted[i].payee.trim().toLowerCase() ===
          sorted[j].payee.trim().toLowerCase()
      ) {
        pairs.push([sorted[i].id, sorted[j].id]);
      }
    }
  }
  return pairs;
}
