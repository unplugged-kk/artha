/**
 * FIRE / goal projection. Pure. The caller supplies every assumption (return,
 * inflation-adjusted growth, withdrawal rate); nothing is defaulted silently
 * except the conventional 4% withdrawal rate, which is echoed in the result.
 */

export interface FireInput {
  readonly currentCorpus: number;
  readonly monthlySavings: number;
  /** Annual REAL (after-inflation) return in percent. */
  readonly realAnnualReturnPct: number;
  /** Today's annual spending to be funded in retirement. */
  readonly annualExpenses: number;
  readonly withdrawalRatePct?: number;
  readonly maxYears?: number;
}

export type FireResult =
  | {
      readonly status: "reachable";
      readonly targetCorpus: number;
      readonly months: number;
      readonly years: number;
      readonly withdrawalRatePct: number;
      readonly finalCorpus: number;
    }
  | {
      readonly status: "not_reachable";
      readonly targetCorpus: number;
      readonly withdrawalRatePct: number;
      readonly horizonYears: number;
    }
  | { readonly status: "invalid_input"; readonly reason: string };

export function projectFire(input: FireInput): FireResult {
  const rate = input.withdrawalRatePct ?? 4;
  const horizon = input.maxYears ?? 80;
  if (
    [input.currentCorpus, input.monthlySavings, input.annualExpenses].some(
      (n) => !Number.isFinite(n) || n < 0,
    ) ||
    !Number.isFinite(input.realAnnualReturnPct) ||
    !(rate > 0)
  ) {
    return { status: "invalid_input", reason: "non_finite_or_negative" };
  }
  const target = Math.round((input.annualExpenses / (rate / 100)) * 100) / 100;
  const r = input.realAnnualReturnPct / 100 / 12;
  let corpus = input.currentCorpus;
  for (let m = 0; m <= horizon * 12; m += 1) {
    if (corpus >= target) {
      return {
        status: "reachable",
        targetCorpus: target,
        months: m,
        years: Math.round((m / 12) * 100) / 100,
        withdrawalRatePct: rate,
        finalCorpus: Math.round(corpus * 100) / 100,
      };
    }
    corpus = corpus * (1 + r) + input.monthlySavings;
  }
  return {
    status: "not_reachable",
    targetCorpus: target,
    withdrawalRatePct: rate,
    horizonYears: horizon,
  };
}

/** Side-by-side "what if I save more": months saved by the extra monthly amount. */
export function compareSavingsIncrease(
  input: FireInput,
  extraMonthlySavings: number,
): {
  readonly base: FireResult;
  readonly withExtra: FireResult;
  readonly monthsSaved: number | null;
} {
  const base = projectFire(input);
  const withExtra = projectFire({
    ...input,
    monthlySavings: input.monthlySavings + extraMonthlySavings,
  });
  return {
    base,
    withExtra,
    monthsSaved:
      base.status === "reachable" && withExtra.status === "reachable"
        ? base.months - withExtra.months
        : null,
  };
}
