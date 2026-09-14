import { CardSmsParser } from "./card-sms.parser";
import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";

describe("CardSmsParser", () => {
  let parser: CardSmsParser;

  beforeEach(() => {
    parser = new CardSmsParser();
  });

  describe("canParse", () => {
    it("returns true for card spend and transaction messages", () => {
      expect(
        parser.canParse(
          "You have spent INR 1,450.00 on HDFC Bank Card ending 1234",
        ),
      ).toBe(true);
      expect(
        parser.canParse(
          "Your Credit Card ending with 1234 has been used for a transaction",
        ),
      ).toBe(true);
    });

    it("returns false for non-card messages", () => {
      expect(parser.canParse("Rs 500 debited via UPI")).toBe(false);
    });
  });

  describe("parse - Card Spends", () => {
    it("parses HDFC Bank credit card spend at SWIGGY", () => {
      const msg =
        "Alert: You have spent INR 1,450.00 on HDFC Bank Card ending 1234 at SWIGGY on 2026-09-14:14:30:15. Avl limit: INR 45,000.00.";
      const res = parser.parse(msg, "VM-HDFCBK");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction).toBeDefined();
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(1450);
      expect(res.transaction?.date).toBe("2026-09-14");
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CARD);
      expect(res.transaction?.payee).toBe("SWIGGY");
      expect(res.transaction?.accountMask).toBe("1234");
      expect(res.transaction?.bankName).toBe("HDFC Bank");
      expect(res.transaction?.balance).toBe(45000);
    });

    it("parses ICICI Bank credit card transaction at FLIPKART", () => {
      const msg =
        "Dear Customer, your ICICI Bank Credit Card ending with 1234 has been used for a transaction of INR 2,999.00 on 14-Sep-26 at FLIPKART.";
      const res = parser.parse(msg, "AD-ICICIB");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(2999);
      expect(res.transaction?.payee).toBe("FLIPKART");
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CARD);
    });

    it("parses Axis Bank credit card transaction at AMAZON", () => {
      const msg =
        "Transaction of INR 1,599.00 made on Axis Bank Card ending 1234 at AMAZON on 14-09-26. Avl Limit: INR 80,000.00.";
      const res = parser.parse(msg, "BW-AXISBK");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(1599);
      expect(res.transaction?.payee).toBe("AMAZON");
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CARD);
    });
  });

  describe("parse - Card Refunds", () => {
    it("parses card refund credit from merchant", () => {
      const msg =
        "Refund of INR 450.00 credited to your Card ending 1234 on 14-Sep-26 from SWIGGY.";
      const res = parser.parse(msg, "VM-HDFCBK");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("credit");
      expect(res.transaction?.amount).toBe(450);
      expect(res.transaction?.payee).toBe("SWIGGY");
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CARD);
    });
  });
});
