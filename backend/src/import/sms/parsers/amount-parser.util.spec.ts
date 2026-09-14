import {
  normalizeAmount,
  extractTransactionAmount,
  extractAvailableBalance,
} from "./amount-parser.util";

describe("Amount Parser Utility", () => {
  describe("normalizeAmount", () => {
    it("parses valid decimal strings into numbers", () => {
      expect(normalizeAmount("1450.50")).toBe(1450.5);
      expect(normalizeAmount("500")).toBe(500);
      expect(normalizeAmount("1,234.56")).toBe(1234.56);
      expect(normalizeAmount("1,00,000.00")).toBe(100000);
    });

    it("rounds to max 4 decimal places", () => {
      expect(normalizeAmount("10.12345")).toBe(10.1235);
    });

    it("rejects zero, negative, empty or non-numeric strings", () => {
      expect(normalizeAmount("0")).toBeNull();
      expect(normalizeAmount("-500")).toBeNull();
      expect(normalizeAmount("")).toBeNull();
      expect(normalizeAmount("abc")).toBeNull();
    });
  });

  describe("extractTransactionAmount", () => {
    it("extracts amount with INR currency prefix", () => {
      expect(
        extractTransactionAmount(
          "You have spent INR 1,450.00 on card ending 1234",
        ),
      ).toBe(1450);
      expect(
        extractTransactionAmount("A/C is debited for INR 450.00 on 14-Sep-26"),
      ).toBe(450);
    });

    it("extracts amount with Rs. currency prefix", () => {
      expect(
        extractTransactionAmount("Rs.500.00 debited from HDFC Bank A/C **1234"),
      ).toBe(500);
      expect(
        extractTransactionAmount("Sent Rs. 1,200.50 from Kotak Bank"),
      ).toBe(1200.5);
    });

    it("extracts amount with ₹ symbol", () => {
      expect(
        extractTransactionAmount("₹850.00 debited from A/C no. XX1234"),
      ).toBe(850);
    });

    it("extracts amount following debited by / credited with", () => {
      expect(
        extractTransactionAmount("A/C 1234 debited by 750.00 on 14Sep26"),
      ).toBe(750);
      expect(
        extractTransactionAmount("A/C 1234 credited by 10,000.00 on 14Sep26"),
      ).toBe(10000);
    });

    it("does NOT confuse available balance with transaction amount", () => {
      const msg =
        "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26. Avl Bal: Rs.25,000.00.";
      expect(extractTransactionAmount(msg)).toBe(500);
      expect(extractAvailableBalance(msg)).toBe(25000);

      const msg2 =
        "Alert: You have spent INR 1,450.00 on Card ending 1234. Avl limit: INR 45,000.00.";
      expect(extractTransactionAmount(msg2)).toBe(1450);
      expect(extractAvailableBalance(msg2)).toBe(45000);
    });

    it("returns null if no transaction amount is found", () => {
      expect(extractTransactionAmount("Your OTP is 123456")).toBeNull();
      expect(extractTransactionAmount("")).toBeNull();
    });
  });
});
