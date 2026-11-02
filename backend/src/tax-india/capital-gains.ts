import { CapitalGainsRules } from "./financial-year.config";

export interface EquitySale {
  readonly acquiredOn: string; // YYYY-MM-DD
  readonly soldOn: string; // YYYY-MM-DD
  /** Total cost incl. brokerage, whole rupees; null when unknown. */
  readonly cost: number | null;
  /** Sale proceeds net of brokerage, whole rupees; null when unknown. */
  readonly proceeds: number | null;
}

export type GainTerm = "short" | "long";

export type ClassifiedSale =
  | {
      readonly status: "ok";
      readonly term: GainTerm;
      readonly gain: number;
    }
  | {
      readonly status: "unknown";
      readonly reason: "missing_cost" | "missing_proceeds" | "grandfathering";
    };

/** Whole calendar months from `from` to `to` (day-of-month aware). */
export function wholeMonthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return months;
}

export function classifyEquitySale(
  sale: EquitySale,
  rules: CapitalGainsRules,
): ClassifiedSale {
  if (sale.cost === null) return { status: "unknown", reason: "missing_cost" };
  if (sale.proceeds === null) {
    return { status: "unknown", reason: "missing_proceeds" };
  }
  const months = wholeMonthsBetween(sale.acquiredOn, sale.soldOn);
  // Long-term means held MORE than the threshold: exactly 12 months is short.
  const isLong =
    months > rules.equityLongTermMonths ||
    (months === rules.equityLongTermMonths &&
      sale.soldOn > addMonths(sale.acquiredOn, rules.equityLongTermMonths));
  if (isLong && sale.acquiredOn < rules.grandfatheringCutoff) {
    return { status: "unknown", reason: "grandfathering" };
  }
  return {
    status: "ok",
    term: isLong ? "long" : "short",
    gain: Math.round(sale.proceeds) - Math.round(sale.cost),
  };
}

function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface CapitalGainsSummary {
  /** Null when any sale is unknown: a subtotal is not a total. */
  readonly stcg: number | null;
  readonly ltcg: number | null;
  readonly taxableLtcg: number | null;
  readonly estimatedTax: number | null;
  readonly knownStcgSubtotal: number;
  readonly knownLtcgSubtotal: number;
  readonly unknownCount: number;
}

export function summarizeEquityGains(
  sales: readonly EquitySale[],
  rules: CapitalGainsRules,
): CapitalGainsSummary {
  let stcg = 0;
  let ltcg = 0;
  let unknown = 0;
  for (const sale of sales) {
    const c = classifyEquitySale(sale, rules);
    if (c.status === "unknown") unknown += 1;
    else if (c.term === "short") stcg += c.gain;
    else ltcg += c.gain;
  }
  if (unknown > 0) {
    return {
      stcg: null,
      ltcg: null,
      taxableLtcg: null,
      estimatedTax: null,
      knownStcgSubtotal: stcg,
      knownLtcgSubtotal: ltcg,
      unknownCount: unknown,
    };
  }
  // Losses: STCL sets off against STCG and LTCG; LTCL only against LTCG.
  const stAfter = Math.max(0, stcg);
  const stLossCarry = Math.max(0, -stcg);
  const ltNet = ltcg - stLossCarry;
  const taxableLtcg = Math.max(0, ltNet - rules.equityLtcgExemption);
  const estimatedTax = Math.round(
    stAfter * rules.equityStcgRate + taxableLtcg * rules.equityLtcgRate,
  );
  return {
    stcg,
    ltcg,
    taxableLtcg,
    estimatedTax,
    knownStcgSubtotal: stcg,
    knownLtcgSubtotal: ltcg,
    unknownCount: 0,
  };
}
