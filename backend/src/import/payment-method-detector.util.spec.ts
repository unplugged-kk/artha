import { PaymentMethod } from "../transactions/entities/payment-method.enum";
import {
  normalizePaymentMethod,
  isValidUpiVpa,
  isValidUpiReference,
  detectPaymentMetadata,
} from "./payment-method-detector.util";

describe("Payment Method Detector Utility", () => {
  describe("normalizePaymentMethod", () => {
    it("normalizes standard Indian rails correctly", () => {
      expect(normalizePaymentMethod("UPI")).toBe(PaymentMethod.UPI);
      expect(normalizePaymentMethod("upi")).toBe(PaymentMethod.UPI);
      expect(normalizePaymentMethod("Unified Payments Interface")).toBe(
        PaymentMethod.UPI,
      );
      expect(normalizePaymentMethod("BHIM UPI")).toBe(PaymentMethod.UPI);

      expect(normalizePaymentMethod("IMPS")).toBe(PaymentMethod.IMPS);
      expect(normalizePaymentMethod("imps p2a")).toBe(PaymentMethod.IMPS);

      expect(normalizePaymentMethod("NEFT")).toBe(PaymentMethod.NEFT);
      expect(normalizePaymentMethod("National Electronic Funds Transfer")).toBe(
        PaymentMethod.NEFT,
      );

      expect(normalizePaymentMethod("RTGS")).toBe(PaymentMethod.RTGS);
      expect(normalizePaymentMethod("Real Time Gross Settlement")).toBe(
        PaymentMethod.RTGS,
      );
    });

    it("normalizes cards, cash, and cheques", () => {
      expect(normalizePaymentMethod("CARD")).toBe(PaymentMethod.CARD);
      expect(normalizePaymentMethod("Debit Card")).toBe(PaymentMethod.CARD);
      expect(normalizePaymentMethod("Credit Card")).toBe(PaymentMethod.CARD);
      expect(normalizePaymentMethod("POS")).toBe(PaymentMethod.CARD);
      expect(normalizePaymentMethod("Point of Sale")).toBe(PaymentMethod.CARD);
      expect(normalizePaymentMethod("Visa")).toBe(PaymentMethod.CARD);
      expect(normalizePaymentMethod("Mastercard")).toBe(PaymentMethod.CARD);

      expect(normalizePaymentMethod("CASH")).toBe(PaymentMethod.CASH);
      expect(normalizePaymentMethod("ATM")).toBe(PaymentMethod.CASH);
      expect(normalizePaymentMethod("ATM Withdrawal")).toBe(PaymentMethod.CASH);

      expect(normalizePaymentMethod("CHEQUE")).toBe(PaymentMethod.CHEQUE);
      expect(normalizePaymentMethod("Check")).toBe(PaymentMethod.CHEQUE);
      expect(normalizePaymentMethod("CHQ")).toBe(PaymentMethod.CHEQUE);
    });

    it("maps unrecognized explicit non-empty values to OTHER", () => {
      expect(normalizePaymentMethod("WALLET")).toBe(PaymentMethod.OTHER);
      expect(normalizePaymentMethod("WIRE")).toBe(PaymentMethod.OTHER);
      expect(normalizePaymentMethod("OTHER")).toBe(PaymentMethod.OTHER);
    });

    it("returns null for empty or null inputs", () => {
      expect(normalizePaymentMethod(null)).toBeNull();
      expect(normalizePaymentMethod(undefined)).toBeNull();
      expect(normalizePaymentMethod("")).toBeNull();
      expect(normalizePaymentMethod("   ")).toBeNull();
    });
  });

  describe("isValidUpiVpa", () => {
    it("validates well-formed UPI VPAs", () => {
      expect(isValidUpiVpa("user@okhdfcbank")).toBe(true);
      expect(isValidUpiVpa("merchant.shop@upi")).toBe(true);
      expect(isValidUpiVpa("9876543210@paytm")).toBe(true);
      expect(isValidUpiVpa("swiggy@axisbank")).toBe(true);
    });

    it("rejects invalid or malformed strings", () => {
      expect(isValidUpiVpa("")).toBe(false);
      expect(isValidUpiVpa(null)).toBe(false);
      expect(isValidUpiVpa("not-a-vpa")).toBe(false);
      expect(isValidUpiVpa("@upi")).toBe(false);
      expect(isValidUpiVpa("user@")).toBe(false);
      expect(isValidUpiVpa("user@@upi")).toBe(false);
    });
  });

  describe("isValidUpiReference", () => {
    it("validates 12-digit standard UPI RRNs", () => {
      expect(isValidUpiReference("425189201928")).toBe(true);
      expect(isValidUpiReference("123456789012")).toBe(true);
    });

    it("validates alphanumeric bank reference numbers", () => {
      expect(isValidUpiReference("UPI123456789")).toBe(true);
      expect(isValidUpiReference("REF987654321")).toBe(true);
    });

    it("rejects too short or empty strings", () => {
      expect(isValidUpiReference("")).toBe(false);
      expect(isValidUpiReference(null)).toBe(false);
      expect(isValidUpiReference("123")).toBe(false);
    });
  });

  describe("detectPaymentMetadata", () => {
    it("prioritizes explicit mapped column values", () => {
      const res = detectPaymentMetadata({
        explicitMethod: "UPI",
        explicitVpa: "seller@okicici",
        explicitReference: "425189201928",
        memo: "Regular payment",
      });

      expect(res.paymentMethod).toBe(PaymentMethod.UPI);
      expect(res.upiVpa).toBe("seller@okicici");
      expect(res.upiReference).toBe("425189201928");
    });

    it("detects UPI and extracts RRN and VPA from structured Indian bank narration", () => {
      const res = detectPaymentMetadata({
        memo: "UPI/425189201928/Swiggy/swiggy@icici/Order123",
        payee: "SWIGGY",
      });

      expect(res.paymentMethod).toBe(PaymentMethod.UPI);
      expect(res.upiReference).toBe("425189201928");
      expect(res.upiVpa).toBe("swiggy@icici");
    });

    it("detects IMPS from structured prefix", () => {
      const res = detectPaymentMetadata({
        memo: "IMPS/P2A/401928374829/Beneficiary Name",
      });
      expect(res.paymentMethod).toBe(PaymentMethod.IMPS);
    });

    it("detects NEFT from structured prefix", () => {
      const res = detectPaymentMetadata({
        memo: "NEFT-HDFC0001234-Rent Payment",
      });
      expect(res.paymentMethod).toBe(PaymentMethod.NEFT);
    });

    it("detects RTGS from structured prefix", () => {
      const res = detectPaymentMetadata({
        memo: "RTGS-ICIC0000011-Property Advance",
      });
      expect(res.paymentMethod).toBe(PaymentMethod.RTGS);
    });

    it("detects CARD POS from structured prefix", () => {
      const res = detectPaymentMetadata({
        memo: "POS 402837XXXXXX1029 RELIANCE FRESH",
      });
      expect(res.paymentMethod).toBe(PaymentMethod.CARD);
    });

    it("detects Cheque from structured prefix", () => {
      const res = detectPaymentMetadata({
        memo: "CHQ NO 000128 CLEARING",
      });
      expect(res.paymentMethod).toBe(PaymentMethod.CHEQUE);
    });

    it("does NOT guess or fabricate payment method when source data is ambiguous", () => {
      const res = detectPaymentMetadata({
        memo: "Monthly grocery purchase",
        payee: "General Store",
      });

      expect(res.paymentMethod).toBeNull();
      expect(res.upiVpa).toBeNull();
      expect(res.upiReference).toBeNull();
    });

    it("does NOT infer a VPA from arbitrary merchant text containing no @ handle", () => {
      const res = detectPaymentMetadata({
        memo: "UPI/425189201928/Amazon India",
      });

      expect(res.paymentMethod).toBe(PaymentMethod.UPI);
      expect(res.upiReference).toBe("425189201928");
      expect(res.upiVpa).toBeNull();
    });
  });
});
