/**
 * Portfolio concentration, computed read-side from the allocation the portfolio
 * summary already draws.
 *
 * **Why this reads the allocation rather than the holdings.** A concentration
 * figure that walked the holdings itself would be a second valuation: it would
 * have its own FX conversion, its own price lookup and its own rule for what
 * counts, and the day it disagreed with the portfolio value beside it, one of
 * the two would be wrong with no way to tell which. The input here is the exact
 * slice list the allocation chart is drawn from, so the two cannot differ.
 *
 * **What a "slice" is.** One position, consolidated across accounts by the
 * allocation builder (the same fund held in two accounts is one slice), valued
 * in the reporting currency. Cash is one slice of its own.
 *
 * **Valuation basis.** There is no separate valuation date here, and inventing
 * one would be a claim this code cannot support. The measure describes the
 * portfolio summary it was derived from: the latest stored price per holding
 * (each carrying its own price date) and the current cash balances, as of the
 * request. It is a current-state measure; a historical "concentration as of
 * date X" needs the historical valuation path and is deliberately not attempted.
 *
 * **Two bases, both reported.** `holdings` excludes cash and answers "how
 * concentrated is the book of positions"; `portfolio` includes cash and answers
 * "how concentrated is everything I hold here". They differ by exactly the cash
 * slice, and each carries its own denominator, so neither can be mistaken for
 * the other.
 *
 * **The denominator is the drawn total** — positive position values plus
 * positive cash — matching the allocation builder's convention. A negative cash
 * balance (margin) or a short position does not shrink the denominator and
 * inflate every weight past 100%; the denominator is what is actually drawn.
 *
 * **What is excluded, and what that means.** The allocation builder omits a
 * holding with no price, a holding with no FX rate into the reporting currency,
 * and a position worth zero. Those exclusions are inherited here, and they are
 * reported rather than hidden: the caller passes the counts it already has from
 * the summary (`unpricedPositions`, `missingRatePairs`, `nonPositiveValuePositions`),
 * and the result is marked `partial` whenever the figure covers only the priced
 * and convertible part. A zero-value position cannot carry weight in any case —
 * its weight is zero — so excluding it changes no number; it is counted only so
 * the reader knows it exists.
 *
 * **Conventions, stated so nobody has to guess.** `herfindahl` is the
 * Herfindahl-Hirschman index: the sum of squared weights, 0-1, where 1 is a
 * single position and values approaching 0 mean many positions of similar size.
 * `effectiveHoldings` is its reciprocal, 1/HHI — the standard "effective number
 * of holdings". It is not a count of instruments: it equals the count only when
 * every position is the same size, and is lower otherwise. Both are
 * dimensionless indices, not money, so they are computed in floating point on
 * purpose; every monetary input stays exactly as the valuation produced it.
 */

/** One allocation slice: a position (or cash) in the reporting currency. */
export interface ConcentrationSlice {
  name: string;
  value: number;
  isCash?: boolean;
}

export interface ConcentrationPosition {
  name: string;
  value: number;
  /** Weight of this position in its basis, as a percentage (0-100). */
  percent: number;
}

export interface ConcentrationMeasure {
  /** What the measure is taken over. */
  basis: "holdings" | "portfolio";
  /** Number of positions carrying weight (a position worth zero carries none). */
  positions: number;
  /** The denominator these weights are fractions of, in the reporting currency. */
  drawnValue: number;
  /** Σ wᵢ² over the weights — the Herfindahl-Hirschman index, 0-1. */
  herfindahl: number;
  /** 1 / HHI — the effective number of holdings. ≤ `positions`, equal only when all weights are equal. */
  effectiveHoldings: number;
  /** The largest single weight, as a percentage (0-100). */
  top1Percent: number;
  /** The five largest weights summed, as a percentage (0-100); all of them when fewer than five. */
  top5Percent: number;
  /** The largest positions with their weights, largest first. */
  largest: ConcentrationPosition[];
}

export interface ConcentrationResult {
  /**
   * `complete` when every held position was priced and convertible, so the
   * measures describe the whole portfolio; `partial` when they describe only the
   * part that was, which the accompanying counts say; `unavailable` when nothing
   * could be drawn at all.
   */
  status: "complete" | "partial" | "unavailable";
  currencyCode: string;
  /** Securities only — cash excluded. Null when no priced position exists. */
  holdings: ConcentrationMeasure | null;
  /** Positions plus positive cash. Null when nothing is drawn. */
  portfolio: ConcentrationMeasure | null;
  /** Positions carrying weight in the measures. */
  pricedPositions: number;
  /** Held in a non-zero quantity with no current price; excluded from the measures. */
  unpricedPositions: number;
  /** Pairs with no available rate; their holdings are excluded from the measures. */
  missingRatePairs: string[];
  /** Positions worth zero or less; they carry no weight and are excluded. */
  nonPositiveValuePositions: number;
}

/** How many positions `top5Percent` spans. */
const TOP_N = 5;

function measure(
  basis: ConcentrationMeasure["basis"],
  slices: ConcentrationSlice[],
): ConcentrationMeasure | null {
  // A position worth zero or less carries no weight: the allocation builder
  // already drops these, and dropping them again here keeps the function correct
  // for any caller that has not.
  const weighted = slices.filter((slice) => slice.value > 0);
  const drawnValue = weighted.reduce((sum, slice) => sum + slice.value, 0);
  if (weighted.length === 0 || drawnValue <= 0) return null;

  const ordered = [...weighted].sort((a, b) => b.value - a.value);

  let sumOfSquares = 0;
  const largest: ConcentrationPosition[] = [];
  for (const slice of ordered) {
    const weight = slice.value / drawnValue;
    sumOfSquares += weight * weight;
    if (largest.length < TOP_N) {
      largest.push({
        name: slice.name,
        value: slice.value,
        percent: weight * 100,
      });
    }
  }

  return {
    basis,
    positions: ordered.length,
    drawnValue,
    herfindahl: sumOfSquares,
    effectiveHoldings: 1 / sumOfSquares,
    top1Percent: (ordered[0].value / drawnValue) * 100,
    top5Percent:
      (ordered.slice(0, TOP_N).reduce((sum, slice) => sum + slice.value, 0) /
        drawnValue) *
      100,
    largest,
  };
}

/**
 * Concentration over the allocation slices, on both bases.
 *
 * `slices` is the portfolio summary's `allocation` in the reporting currency;
 * `isCash` marks the cash slice (the allocation builder emits exactly one, with
 * `type: "cash"`). The completeness counts come from the same summary, so the
 * measures and the caveat about them cannot drift apart.
 */
export function computeConcentration(input: {
  slices: ConcentrationSlice[];
  currencyCode: string;
  unpricedPositions: number;
  missingRatePairs: string[];
  nonPositiveValuePositions?: number;
}): ConcentrationResult {
  const securities = input.slices.filter((slice) => !slice.isCash);

  const holdings = measure("holdings", securities);
  const portfolio = measure("portfolio", input.slices);
  const nonPositiveValuePositions = input.nonPositiveValuePositions ?? 0;

  const complete =
    input.unpricedPositions === 0 &&
    input.missingRatePairs.length === 0 &&
    nonPositiveValuePositions === 0;

  return {
    status:
      holdings === null && portfolio === null
        ? "unavailable"
        : complete
          ? "complete"
          : "partial",
    currencyCode: input.currencyCode,
    holdings,
    portfolio,
    pricedPositions: portfolio?.positions ?? 0,
    unpricedPositions: input.unpricedPositions,
    missingRatePairs: input.missingRatePairs,
    nonPositiveValuePositions,
  };
}
