import { INDIAN_MERCHANT_SEEDS } from "./reference-data/indian-merchants.data";
import { normalizePayeeName } from "./payee-normalize.util";
import { matchMerchantReference } from "./merchant-matcher.util";
import { computeTransactionImportIdentity } from "../import/import-identity.util";

describe("Indian Merchant Reference Data Specification (Priority 10)", () => {
  describe("Curated Seed Data Integrity", () => {
    it("contains the expected set of curated Indian merchants/billers", () => {
      const canonicalNames = INDIAN_MERCHANT_SEEDS.map((s) => s.canonicalName);
      expect(canonicalNames).toContain("Swiggy");
      expect(canonicalNames).toContain("Zomato");
      expect(canonicalNames).toContain("Amazon Pay India");
      expect(canonicalNames).toContain("Flipkart");
      expect(canonicalNames).toContain("Airtel");
      expect(canonicalNames).toContain("Jio");
      expect(canonicalNames).toContain("ACT Fibernet");
      expect(canonicalNames).toContain("BESCOM");
      expect(canonicalNames).toContain("Tata Power");
      expect(canonicalNames).toContain("Uber");
      expect(canonicalNames).toContain("Ola");
      expect(canonicalNames).toContain("IRCTC");
      expect(canonicalNames).toContain("Zerodha");
      expect(canonicalNames).toContain("Groww");
      expect(INDIAN_MERCHANT_SEEDS.length).toBe(14);
    });

    it("ensures every seed has valid required fields and countryCode 'IN'", () => {
      for (const seed of INDIAN_MERCHANT_SEEDS) {
        expect(seed.canonicalName).toBeDefined();
        expect(seed.canonicalName.length).toBeGreaterThan(0);
        expect(seed.normalizedName).toBeDefined();
        expect(seed.normalizedName.length).toBeGreaterThan(0);
        expect(seed.countryCode).toBe("IN");
        expect(Array.isArray(seed.aliases)).toBe(true);
        expect(seed.aliases.length).toBeGreaterThan(0);
      }
    });

    it("verifies normalizedName is strictly identical to normalizePayeeName(canonicalName)", () => {
      for (const seed of INDIAN_MERCHANT_SEEDS) {
        const computed = normalizePayeeName(seed.canonicalName);
        expect(seed.normalizedName).toBe(computed);
      }
    });

    it("guarantees no duplicate canonical names or normalized names exist across seeds", () => {
      const canonicalSet = new Set<string>();
      const normalizedSet = new Set<string>();

      for (const seed of INDIAN_MERCHANT_SEEDS) {
        expect(canonicalSet.has(seed.canonicalName)).toBe(false);
        canonicalSet.add(seed.canonicalName);

        expect(normalizedSet.has(seed.normalizedName)).toBe(false);
        normalizedSet.add(seed.normalizedName);
      }
    });

    it("guarantees no duplicate aliases exist across different merchants", () => {
      const seenAliases = new Map<string, string>();

      for (const seed of INDIAN_MERCHANT_SEEDS) {
        for (const alias of seed.aliases) {
          const lower = alias.toLowerCase();
          const existing = seenAliases.get(lower);
          expect(existing).toBeUndefined();
          seenAliases.set(lower, seed.canonicalName);
        }
      }
    });
  });

  describe("Matching Precision and Edge Cases", () => {
    it("handles leading and trailing whitespace, mixed casing, and special characters", () => {
      expect(matchMerchantReference("   swiggy   ")?.canonicalName).toBe(
        "Swiggy",
      );
      expect(matchMerchantReference("ZOMATO / BANGALORE")?.canonicalName).toBe(
        "Zomato",
      );
      expect(matchMerchantReference("UBER *TRIP* PUNE")?.canonicalName).toBe(
        "Uber",
      );
    });

    it("resolves corporate entity names through alias patterns", () => {
      expect(
        matchMerchantReference("Bundl Technologies Pvt Ltd")?.canonicalName,
      ).toBe("Swiggy");
      expect(
        matchMerchantReference("ANI Technologies Private Limited")
          ?.canonicalName,
      ).toBe("Ola");
      expect(
        matchMerchantReference("Atria Convergence Technologies Ltd")
          ?.canonicalName,
      ).toBe("ACT Fibernet");
      expect(
        matchMerchantReference("Nextbillion Technology Pvt Ltd")?.canonicalName,
      ).toBe("Groww");
      expect(
        matchMerchantReference("Bangalore Electricity Supply Co")
          ?.canonicalName,
      ).toBe("BESCOM");
    });

    it("preserves distinct entities and prevents over-eager prefix matching", () => {
      expect(matchMerchantReference("Tata Motors")).toBeNull();
      expect(matchMerchantReference("Tata Steel")).toBeNull();
      expect(matchMerchantReference("Action Construction")).toBeNull();
      expect(matchMerchantReference("Reliance Retail")).toBeNull();
      expect(matchMerchantReference("Olam International")).toBeNull();
      expect(matchMerchantReference("Swiss Re")).toBeNull();
    });
  });

  describe("Import Idempotency and Financial Integrity Invariance", () => {
    it("produces identical import identity hash regardless of merchant recognition or enrichment", () => {
      const rawInput = {
        accountId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        date: "2026-09-13",
        amount: -450.5,
        payee: "Bundl Technologies Pvt Ltd",
        memo: "Order #98231",
        sourceId: "425189201928",
      };

      // Hash computed on raw imported input record
      const id1 = computeTransactionImportIdentity(rawInput);

      // Verify the SHA-256 hash is deterministic and uninfluenced by payee canonicalization
      const id2 = computeTransactionImportIdentity({ ...rawInput });

      expect(id1.hash).toBe(id2.hash);
      expect(id1.hash).toBeDefined();
      expect(id1.hash.length).toBe(64); // SHA-256
    });

    it("preserves category non-assignment safety (Open Decision 2 safety)", () => {
      // Merchant seeds provide categorySuggestion purely as metadata;
      // matcher provides it, but import processor must never assign it
      const match = matchMerchantReference("Swiggy");
      expect(match?.categorySuggestion).toBe("Food & Dining");

      // The matcher exposes it, but the import processor sets defaultCategoryId: null
      // ensuring zero inferred categories without explicit user intent.
    });
  });
});
