/**
 * Four-tier categorization decision. Pure: the caller supplies each tier's data,
 * this decides. AI is the last resort and is only *requested* here (`needs_ai`);
 * whatever it proposes still goes through the human confirmation flow.
 *
 *   1. user_rule      - the user's own rules (already evaluated by the caller)
 *   2. merchant_default - a curated normalized-merchant -> category map
 *   3. history        - the user's own dominant category for this payee
 *   4. ai             - requested only when 1-3 are silent or unconvincing
 */

export type CategorizationTier =
  | "user_rule"
  | "merchant_default"
  | "history"
  | "ai";

export type CategorizationDecision =
  | {
      readonly status: "categorized";
      readonly categoryId: string;
      readonly tier: Exclude<CategorizationTier, "ai">;
      readonly confidence: number;
      readonly evidence: string;
    }
  | {
      readonly status: "needs_ai";
      /** Weak candidates from earlier tiers, offered to the model as hints. */
      readonly hints: readonly string[];
    };

export interface CategorizationInput {
  readonly payee: string;
  /** Category id from the user's rules, or null when no rule matched. */
  readonly ruleCategoryId: string | null;
  /** Normalized merchant key -> category id. */
  readonly merchantDefaults: Readonly<Record<string, string>>;
  /** Past categorizations of this payee: category id per past transaction. */
  readonly historyCategoryIds: readonly string[];
}

export interface HistoryThresholds {
  readonly minSamples: number;
  /** Share of samples the top category must hold. */
  readonly minDominance: number;
}

export const DEFAULT_HISTORY_THRESHOLDS: HistoryThresholds = {
  minSamples: 3,
  minDominance: 0.8,
};

/** Lowercase, drop punctuation and trailing store/ref numbers: "SWIGGY *1234" -> "swiggy". */
export function normalizeMerchant(payee: string): string {
  return payee
    .toLowerCase()
    .replace(/[*#/_-]+/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dominant(
  ids: readonly string[],
): { id: string; share: number; count: number } | null {
  if (ids.length === 0) return null;
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: [string, number] | null = null;
  for (const entry of counts) {
    if (best === null || entry[1] > best[1]) best = entry;
  }
  return best
    ? { id: best[0], count: best[1], share: best[1] / ids.length }
    : null;
}

export function decideCategory(
  input: CategorizationInput,
  thresholds: HistoryThresholds = DEFAULT_HISTORY_THRESHOLDS,
): CategorizationDecision {
  if (input.ruleCategoryId) {
    return {
      status: "categorized",
      categoryId: input.ruleCategoryId,
      tier: "user_rule",
      confidence: 1,
      evidence: "Matched one of your rules.",
    };
  }
  const merchant = normalizeMerchant(input.payee);
  const byMerchant = merchant ? input.merchantDefaults[merchant] : undefined;
  if (byMerchant) {
    return {
      status: "categorized",
      categoryId: byMerchant,
      tier: "merchant_default",
      confidence: 0.9,
      evidence: `Known merchant "${merchant}".`,
    };
  }
  const top = dominant(input.historyCategoryIds);
  if (
    top &&
    top.count >= thresholds.minSamples &&
    top.share >= thresholds.minDominance
  ) {
    return {
      status: "categorized",
      categoryId: top.id,
      tier: "history",
      confidence: Math.round(top.share * 100) / 100,
      evidence: `${top.count} of ${input.historyCategoryIds.length} past transactions with this payee used this category.`,
    };
  }
  return { status: "needs_ai", hints: top ? [top.id] : [] };
}
