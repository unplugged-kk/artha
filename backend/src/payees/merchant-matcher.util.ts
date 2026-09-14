import { normalizePayeeName } from "./payee-normalize.util";
import {
  INDIAN_MERCHANT_SEEDS,
  IndianMerchantSeed,
} from "./reference-data/indian-merchants.data";

export interface MerchantMatchResult {
  canonicalName: string;
  normalizedName: string;
  categorySuggestion: string | null;
  website: string | null;
  matchedBy: "alias" | "exact" | "prefix";
}

/**
 * Iterative glob pattern matching (case-insensitive).
 * Supports '*' wildcards without regex ReDoS risk.
 */
export function matchesAliasPattern(
  name: string,
  aliasPattern: string,
): boolean {
  if (!name || !aliasPattern) return false;
  if (aliasPattern.length > 500 || name.length > 500) return false;

  const pattern = aliasPattern.replace(/\*{2,}/g, "*").toLowerCase();
  const text = name.toLowerCase().trim();

  const parts = pattern.split("*");
  if (parts.length === 1) return text === pattern;

  if (!text.startsWith(parts[0])) return false;
  if (!text.endsWith(parts[parts.length - 1])) return false;

  let pos = parts[0].length;
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part.length === 0) continue;
    const idx = text.indexOf(part, pos);
    if (idx === -1) return false;
    pos = idx + part.length;
  }

  return pos <= text.length - parts[parts.length - 1].length;
}

const RAIL_PREFIX_REGEX = /^(UPI|IMPS|NEFT|RTGS|POS|ACH|INB)\s+/i;

/**
 * Strips leading payment-rail keywords that often prefix bank narrations.
 */
export function stripRailPrefix(normalized: string): string {
  return normalized.replace(RAIL_PREFIX_REGEX, "").trim();
}

/**
 * Match a raw imported payee string against Indian merchant reference data.
 *
 * Matching precedence:
 * 1. Alias pattern match on raw payee (e.g. 'BUNDL TECHNOLOGIES*' -> Swiggy)
 * 2. Alias pattern match on normalized payee
 * 3. Exact match against canonical normalized name (e.g. 'SWIGGY' === 'SWIGGY')
 * 4. Match against stripped-rail normalized name (e.g. 'UPI SWIGGY' -> 'SWIGGY')
 * 5. Word-boundary prefix match on normalized name (e.g. 'SWIGGY BANGALORE' -> Swiggy)
 *
 * Returns null if no known merchant reference matches with high confidence.
 */
export function matchMerchantReference(
  rawPayee: string,
  seeds: readonly IndianMerchantSeed[] = INDIAN_MERCHANT_SEEDS,
): MerchantMatchResult | null {
  if (!rawPayee || !rawPayee.trim()) return null;
  const trimmedRaw = rawPayee.trim();

  // 1. Direct alias pattern match on raw payee string
  for (const seed of seeds) {
    for (const alias of seed.aliases) {
      if (matchesAliasPattern(trimmedRaw, alias)) {
        return {
          canonicalName: seed.canonicalName,
          normalizedName: seed.normalizedName,
          categorySuggestion: seed.categorySuggestion ?? null,
          website: seed.website ?? null,
          matchedBy: "alias",
        };
      }
    }
  }

  // 2. Normalized payee representation
  const normalized = normalizePayeeName(trimmedRaw);
  if (!normalized) return null;

  // 2a. Alias pattern match on normalized payee
  for (const seed of seeds) {
    for (const alias of seed.aliases) {
      if (matchesAliasPattern(normalized, alias)) {
        return {
          canonicalName: seed.canonicalName,
          normalizedName: seed.normalizedName,
          categorySuggestion: seed.categorySuggestion ?? null,
          website: seed.website ?? null,
          matchedBy: "alias",
        };
      }
    }
  }

  // 2b. Exact match on normalized payee name
  for (const seed of seeds) {
    if (normalized === seed.normalizedName) {
      return {
        canonicalName: seed.canonicalName,
        normalizedName: seed.normalizedName,
        categorySuggestion: seed.categorySuggestion ?? null,
        website: seed.website ?? null,
        matchedBy: "exact",
      };
    }
  }

  // 2c. Match with rail prefix stripped (e.g., 'UPI SWIGGY' -> 'SWIGGY')
  const strippedRail = stripRailPrefix(normalized);
  if (strippedRail && strippedRail !== normalized) {
    for (const seed of seeds) {
      if (strippedRail === seed.normalizedName) {
        return {
          canonicalName: seed.canonicalName,
          normalizedName: seed.normalizedName,
          categorySuggestion: seed.categorySuggestion ?? null,
          website: seed.website ?? null,
          matchedBy: "exact",
        };
      }
      for (const alias of seed.aliases) {
        if (matchesAliasPattern(strippedRail, alias)) {
          return {
            canonicalName: seed.canonicalName,
            normalizedName: seed.normalizedName,
            categorySuggestion: seed.categorySuggestion ?? null,
            website: seed.website ?? null,
            matchedBy: "alias",
          };
        }
      }
      if (strippedRail.startsWith(seed.normalizedName + " ")) {
        return {
          canonicalName: seed.canonicalName,
          normalizedName: seed.normalizedName,
          categorySuggestion: seed.categorySuggestion ?? null,
          website: seed.website ?? null,
          matchedBy: "prefix",
        };
      }
    }
  }

  // 2d. Word-boundary prefix match (e.g. 'SWIGGY BANGALORE' starts with 'SWIGGY ')
  for (const seed of seeds) {
    if (normalized.startsWith(seed.normalizedName + " ")) {
      return {
        canonicalName: seed.canonicalName,
        normalizedName: seed.normalizedName,
        categorySuggestion: seed.categorySuggestion ?? null,
        website: seed.website ?? null,
        matchedBy: "prefix",
      };
    }
  }

  return null;
}
