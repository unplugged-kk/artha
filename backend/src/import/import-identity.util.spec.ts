import {
  computeTransactionImportIdentity,
  computeInvestmentImportIdentity,
  getContentSignatureKey,
  isDuplicateImportError,
  normalizeSourceId,
} from "./import-identity.util";

describe("import-identity.util", () => {
  describe("normalizeSourceId", () => {
    it("returns trimmed string when non-empty", () => {
      expect(normalizeSourceId("  FIT12345  ")).toBe("FIT12345");
      expect(normalizeSourceId("REF-999")).toBe("REF-999");
    });

    it("returns null for empty or whitespace-only strings", () => {
      expect(normalizeSourceId(null)).toBeNull();
      expect(normalizeSourceId(undefined)).toBeNull();
      expect(normalizeSourceId("")).toBeNull();
      expect(normalizeSourceId("   ")).toBeNull();
    });
  });

  describe("computeTransactionImportIdentity", () => {
    const baseInput = {
      accountId: "acc-1111-2222",
      date: "2026-09-12",
      amount: -150.5,
      payee: "Starbucks Coffee",
      memo: "Morning latte",
      sourceId: null,
      ordinal: 1,
    };

    it("produces a 64-character lowercase hexadecimal SHA-256 hash", () => {
      const identity = computeTransactionImportIdentity(baseInput);
      expect(identity.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(identity.sourceId).toBeNull();
      expect(identity.canonicalString).toContain("acc:acc-1111-2222");
      expect(identity.canonicalString).toContain("amt:-150.5000");
    });

    it("is completely deterministic given identical inputs", () => {
      const first = computeTransactionImportIdentity(baseInput);
      const second = computeTransactionImportIdentity({ ...baseInput });
      expect(first.hash).toBe(second.hash);
      expect(first.canonicalString).toBe(second.canonicalString);
    });

    it("normalizes amount formatting with exact 4 decimals without floating point drift", () => {
      const id1 = computeTransactionImportIdentity({
        ...baseInput,
        amount: -150.5,
      });
      const id2 = computeTransactionImportIdentity({
        ...baseInput,
        amount: -150.5,
      });
      expect(id1.hash).toBe(id2.hash);

      const idDifferent = computeTransactionImportIdentity({
        ...baseInput,
        amount: -150.51,
      });
      expect(id1.hash).not.toBe(idDifferent.hash);
    });

    it("normalizes payee and memo whitespace and casing", () => {
      const id1 = computeTransactionImportIdentity({
        ...baseInput,
        payee: "STARBUCKS   COFFEE",
        memo: " Morning   latte ",
      });
      const id2 = computeTransactionImportIdentity({
        ...baseInput,
        payee: "starbucks coffee",
        memo: "morning latte",
      });
      expect(id1.hash).toBe(id2.hash);
    });

    it("scopes hash to the account ID so identical transactions in different accounts never collide", () => {
      const idAccount1 = computeTransactionImportIdentity({
        ...baseInput,
        accountId: "acc-1111",
      });
      const idAccount2 = computeTransactionImportIdentity({
        ...baseInput,
        accountId: "acc-2222",
      });
      expect(idAccount1.hash).not.toBe(idAccount2.hash);
    });

    it("uses stable sourceId (e.g. OFX FITID or bank ref) when present", () => {
      const withSourceId = computeTransactionImportIdentity({
        ...baseInput,
        sourceId: "FIT-987654321",
      });

      expect(withSourceId.sourceId).toBe("FIT-987654321");
      expect(withSourceId.canonicalString).toContain("src:FIT-987654321");

      const differentSourceId = computeTransactionImportIdentity({
        ...baseInput,
        sourceId: "FIT-111111111",
      });
      expect(withSourceId.hash).not.toBe(differentSourceId.hash);
    });

    it("distinguishes legitimate repeated transactions on the same date via ordinal", () => {
      const firstPurchase = computeTransactionImportIdentity({
        ...baseInput,
        ordinal: 1,
      });
      const secondPurchase = computeTransactionImportIdentity({
        ...baseInput,
        ordinal: 2,
      });

      expect(firstPurchase.hash).not.toBe(secondPurchase.hash);
      expect(firstPurchase.canonicalString).toContain("ord:1");
      expect(secondPurchase.canonicalString).toContain("ord:2");
    });

    it("distinguishes transactions with different dates", () => {
      const idDay1 = computeTransactionImportIdentity({
        ...baseInput,
        date: "2026-09-12",
      });
      const idDay2 = computeTransactionImportIdentity({
        ...baseInput,
        date: "2026-09-13",
      });
      expect(idDay1.hash).not.toBe(idDay2.hash);
    });

    it("distinguishes transfers and transfer target accounts", () => {
      const nonTransfer = computeTransactionImportIdentity({
        ...baseInput,
        isTransfer: false,
      });
      const transfer = computeTransactionImportIdentity({
        ...baseInput,
        isTransfer: true,
        transferAccountId: "target-account-id",
      });
      expect(nonTransfer.hash).not.toBe(transfer.hash);
    });
  });

  describe("computeInvestmentImportIdentity", () => {
    const baseTrade = {
      accountId: "brokerage-1",
      date: "2026-09-12",
      amount: 15000,
      action: "BUY",
      securitySymbol: "INFY",
      quantity: 10,
      price: 1500,
      memo: "Monthly SIP buy",
      sourceId: null,
      ordinal: 1,
    };

    it("produces deterministic 64-char hex hash for investment transactions", () => {
      const id1 = computeInvestmentImportIdentity(baseTrade);
      const id2 = computeInvestmentImportIdentity({ ...baseTrade });
      expect(id1.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(id1.hash).toBe(id2.hash);
      expect(id1.canonicalString).toContain("v1_inv");
      expect(id1.canonicalString).toContain("act:BUY");
      expect(id1.canonicalString).toContain("sec:INFY");
    });

    it("distinguishes different investment actions (e.g. BUY vs SELL vs DIVIDEND)", () => {
      const buyTrade = computeInvestmentImportIdentity({
        ...baseTrade,
        action: "BUY",
      });
      const sellTrade = computeInvestmentImportIdentity({
        ...baseTrade,
        action: "SELL",
      });
      const divTrade = computeInvestmentImportIdentity({
        ...baseTrade,
        action: "DIVIDEND",
      });

      expect(buyTrade.hash).not.toBe(sellTrade.hash);
      expect(buyTrade.hash).not.toBe(divTrade.hash);
    });

    it("distinguishes different securities", () => {
      const infyTrade = computeInvestmentImportIdentity({
        ...baseTrade,
        securitySymbol: "INFY",
      });
      const tcsTrade = computeInvestmentImportIdentity({
        ...baseTrade,
        securitySymbol: "TCS",
      });
      expect(infyTrade.hash).not.toBe(tcsTrade.hash);
    });

    it("uses sourceId when provided for investment trades", () => {
      const withSrc = computeInvestmentImportIdentity({
        ...baseTrade,
        sourceId: "TRADE-TX-001",
      });
      expect(withSrc.sourceId).toBe("TRADE-TX-001");
      expect(withSrc.canonicalString).toContain("src:TRADE-TX-001");
    });
  });

  describe("getContentSignatureKey", () => {
    it("incorporates sourceId when present", () => {
      const key1 = getContentSignatureKey({
        date: "2026-09-12",
        amount: -50,
        sourceId: "FIT-100",
      });
      const key2 = getContentSignatureKey({
        date: "2026-09-12",
        amount: -50,
        sourceId: "FIT-200",
      });
      expect(key1).toContain("src:");
      expect(key1).not.toBe(key2);
    });

    it("produces identical signature key for same content without sourceId", () => {
      const key1 = getContentSignatureKey({
        date: "2026-09-12",
        amount: -25.5,
        payee: "Cafe Coffee Day",
        memo: "Snack",
      });
      const key2 = getContentSignatureKey({
        date: "2026-09-12",
        amount: -25.5,
        payee: "CAFE COFFEE DAY",
        memo: "snack",
      });
      expect(key1).toBe(key2);
    });
  });

  describe("isDuplicateImportError", () => {
    it("returns true for PG error code 23505 with import_hash constraint", () => {
      expect(
        isDuplicateImportError({
          code: "23505",
          constraint: "idx_transactions_account_import_hash",
        }),
      ).toBe(true);

      expect(
        isDuplicateImportError({
          code: "23505",
          constraint: "idx_investment_transactions_account_import_hash",
        }),
      ).toBe(true);

      expect(
        isDuplicateImportError({
          driverError: {
            code: "23505",
            constraint: "idx_transactions_account_import_hash",
          },
        }),
      ).toBe(true);
    });

    it("returns false for non-23505 errors", () => {
      expect(isDuplicateImportError(new Error("Connection timeout"))).toBe(
        false,
      );
      expect(isDuplicateImportError({ code: "23503" })).toBe(false); // foreign_key_violation
      expect(isDuplicateImportError(null)).toBe(false);
      expect(isDuplicateImportError(undefined)).toBe(false);
    });

    it("returns false for 23505 on unrelated constraints (e.g. user email or payee name)", () => {
      expect(
        isDuplicateImportError({
          code: "23505",
          constraint: "uq_users_email",
        }),
      ).toBe(false);

      expect(
        isDuplicateImportError({
          code: "23505",
          constraint: "idx_payees_user_name",
        }),
      ).toBe(false);
    });
  });
});
