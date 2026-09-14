import {
  extractTransactionDate,
  extractDateOrDefaultToday,
} from "./date-parser.util";

describe("Date Parser Utility", () => {
  describe("extractTransactionDate", () => {
    it("parses ISO date format (YYYY-MM-DD)", () => {
      expect(
        extractTransactionDate("Transaction on 2026-09-14:14:30:15 at SWIGGY"),
      ).toBe("2026-09-14");
    });

    it("parses alphanumeric month with hyphens (DD-Mon-YY and DD-Mon-YYYY)", () => {
      expect(
        extractTransactionDate("Debited for INR 450.00 on 14-Sep-26 Info: UPI"),
      ).toBe("2026-09-14");
      expect(
        extractTransactionDate(
          "Debited for INR 450.00 on 14-Sep-2026 Info: UPI",
        ),
      ).toBe("2026-09-14");
      expect(extractTransactionDate("credited on 05-Jan-26 via NEFT")).toBe(
        "2026-01-05",
      );
    });

    it("parses compact month without hyphens (DDMonYY)", () => {
      expect(
        extractTransactionDate(
          "A/C 1234 debited by 750.00 on 14Sep26 transfer to ZOMATO",
        ),
      ).toBe("2026-09-14");
      expect(
        extractTransactionDate("A/C 1234 credited on 01Jan26 by transfer"),
      ).toBe("2026-01-01");
    });

    it("parses Indian numeric dates (DD-MM-YY and DD/MM/YYYY)", () => {
      expect(
        extractTransactionDate("debited from A/C on 14-09-26 to VPA"),
      ).toBe("2026-09-14");
      expect(
        extractTransactionDate("debited from A/C on 14/09/2026 to VPA"),
      ).toBe("2026-09-14");
      expect(
        extractTransactionDate("debited from A/C on 14/09/26 to VPA"),
      ).toBe("2026-09-14");
    });

    it("returns null for invalid or missing dates", () => {
      expect(extractTransactionDate("You have spent Rs 500")).toBeNull();
      expect(extractTransactionDate("OTP is 123456")).toBeNull();
      expect(extractTransactionDate("32-13-26")).toBeNull();
    });
  });

  describe("extractDateOrDefaultToday", () => {
    it("returns extracted date when present", () => {
      expect(
        extractDateOrDefaultToday("Transaction on 14-09-26 at merchant"),
      ).toBe("2026-09-14");
    });

    it("falls back to today in YYYY-MM-DD format when date is missing", () => {
      const result = extractDateOrDefaultToday(
        "Transaction of Rs 500 at merchant",
      );
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
