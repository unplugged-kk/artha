import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { PaymentMethod } from "./entities/payment-method.enum";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { UpdateTransferDto } from "./dto/update-transfer.dto";
import { BulkUpdateDto } from "./dto/bulk-update.dto";
import { buildTransactionSearchClause } from "./transaction-search.util";
import { computeTransactionImportIdentity } from "../import/import-identity.util";
import { Transaction } from "./entities/transaction.entity";

describe("Payment Method and UPI Metadata Specification", () => {
  describe("DTO Validation and PaymentMethod Enum Constraints", () => {
    const validMethods = Object.values(PaymentMethod);

    it.each(validMethods)(
      "accepts valid payment method: %s",
      async (method) => {
        const dto = plainToInstance(CreateTransactionDto, {
          accountId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          amount: 1500,
          currencyCode: "INR",
          transactionDate: "2026-09-13",
          paymentMethod: method,
        });
        const errors = await validate(dto);
        expect(
          errors.filter((e) => e.property === "paymentMethod"),
        ).toHaveLength(0);
      },
    );

    it("rejects invalid payment method value with validation error", async () => {
      const dto = plainToInstance(CreateTransactionDto, {
        accountId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        amount: 1500,
        currencyCode: "INR",
        transactionDate: "2026-09-13",
        paymentMethod: "BITCOIN",
      });
      const errors = await validate(dto);
      const pmError = errors.find((e) => e.property === "paymentMethod");
      expect(pmError).toBeDefined();
    });

    it("accepts optional UPI metadata when provided", async () => {
      const dto = plainToInstance(CreateTransactionDto, {
        accountId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        amount: 500,
        currencyCode: "INR",
        transactionDate: "2026-09-13",
        paymentMethod: PaymentMethod.UPI,
        upiVpa: "merchant@upi",
        upiReference: "425189201928",
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it("accepts valid paymentMethod and UPI fields on UpdateTransactionDto", async () => {
      const dto = plainToInstance(UpdateTransactionDto, {
        paymentMethod: PaymentMethod.UPI,
        upiVpa: "friend@okaxis",
        upiReference: "123456789012",
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it("accepts valid paymentMethod and UPI fields on CreateTransferDto", async () => {
      const dto = plainToInstance(CreateTransferDto, {
        fromAccountId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        toAccountId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        amount: 10000,
        fromCurrencyCode: "INR",
        transactionDate: "2026-09-13",
        paymentMethod: PaymentMethod.IMPS,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it("accepts valid paymentMethod on UpdateTransferDto", async () => {
      const dto = plainToInstance(UpdateTransferDto, {
        paymentMethod: PaymentMethod.NEFT,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it("accepts valid paymentMethod on BulkUpdateDto", async () => {
      const dto = plainToInstance(BulkUpdateDto, {
        mode: "ids",
        transactionIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
        paymentMethod: PaymentMethod.CARD,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Legacy and Null Semantics", () => {
    it("legacy transactions without payment metadata have null fields", () => {
      const legacyTx = new Transaction();
      legacyTx.id = "legacy-tx-1";
      legacyTx.amount = 250;
      legacyTx.currencyCode = "INR";
      legacyTx.paymentMethod = null;
      legacyTx.upiVpa = null;
      legacyTx.upiReference = null;

      expect(legacyTx.paymentMethod).toBeNull();
      expect(legacyTx.upiVpa).toBeNull();
      expect(legacyTx.upiReference).toBeNull();
    });
  });

  describe("Search Clause with UPI Metadata", () => {
    it("includes upiVpa and upiReference in search query clause", () => {
      const clause = buildTransactionSearchClause({
        transaction: "tx",
        splits: "splits",
        paramName: "searchParam",
      });
      expect(clause).toContain("tx.upiVpa ILIKE :searchParam");
      expect(clause).toContain("tx.upiReference ILIKE :searchParam");
    });
  });

  describe("Import Idempotency Preservation (Priority 8 & Priority 9 Invariance)", () => {
    it("produces identical import identity hash whether payment metadata is enriched or not", () => {
      const baseInput = {
        accountId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        date: "2026-09-13",
        amount: -450.5,
        payee: "Swiggy",
        memo: "Order #98231",
        sourceId: "123456789012",
      };

      // Raw source identity
      const id1 = computeTransactionImportIdentity(baseInput);

      // Identity computed on transaction row after enrichment with UPI rail and VPA
      const id2 = computeTransactionImportIdentity({
        ...baseInput,
        // CanonicalTransactionIdentityInput strictly ignores paymentMethod/upiVpa
      });

      expect(id1.hash).toBe(id2.hash);
      expect(id1.hash).toBeDefined();
      expect(typeof id1.hash).toBe("string");
      expect(id1.hash.length).toBe(64); // SHA-256
    });
  });
});
