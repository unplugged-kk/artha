import { BankTransferSmsParser } from "./bank-transfer-sms.parser";
import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";

describe("BankTransferSmsParser", () => {
  let parser: BankTransferSmsParser;

  beforeEach(() => {
    parser = new BankTransferSmsParser();
  });

  describe("canParse", () => {
    it("returns true for NEFT, IMPS, RTGS or bank transfer messages", () => {
      expect(parser.canParse("A/C debited Rs 1200 via NEFT to Zomato")).toBe(
        true,
      );
      expect(parser.canParse("Credited Rs 5000 via IMPS Ref 123456")).toBe(
        true,
      );
      expect(parser.canParse("A/C credited Rs 50000 by RTGS")).toBe(true);
    });

    it("returns false for UPI or Card messages", () => {
      expect(parser.canParse("Debited via UPI Ref 123456789012")).toBe(false);
      expect(parser.canParse("Spent on Card ending 1234")).toBe(false);
    });
  });

  describe("parse - NEFT", () => {
    it("parses NEFT debit transfer to counterparty", () => {
      const msg =
        "Debited from HDFC Bank A/C **1234 for Rs.1,200.00 on 14-Sep-26 via NEFT to Zomato Ref N123456789.";
      const res = parser.parse(msg, "VM-HDFCBK");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(1200);
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.NEFT);
      expect(res.transaction?.referenceNumber).toBe("N123456789");
      expect(res.transaction?.payee).toBe("Zomato");
    });

    it("parses NEFT salary / inflow credit with hyphenated pattern", () => {
      const msg =
        "HDFC Bank: Rs 85,000.00 credited to A/C ending 1234 on 14-Sep-26 by NEFT-ACME CORP-N123456789. Avl Bal INR 1,25,000.00.";
      const res = parser.parse(msg, "VM-HDFCBK");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("credit");
      expect(res.transaction?.amount).toBe(85000);
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.NEFT);
      expect(res.transaction?.payee).toBe("ACME CORP");
      expect(res.transaction?.accountMask).toBe("1234");
      expect(res.transaction?.balance).toBe(125000);
    });
  });

  describe("parse - IMPS", () => {
    it("parses IMPS debit transfer", () => {
      const msg =
        "Your A/C **1234 debited INR 5,000.00 on 14-09-26 via IMPS Ref 425789123456 to ACME CORP.";
      const res = parser.parse(msg, "AD-ICICIB");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(5000);
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.IMPS);
      expect(res.transaction?.payee).toBe("ACME CORP");
      expect(res.transaction?.referenceNumber).toBe("425789123456");
    });

    it("parses IMPS credit transfer", () => {
      const msg =
        "Your A/C ending 1234 is credited with INR 2,500.00 on 14-Sep-26 via IMPS Ref 425789123457 from RAJESH.";
      const res = parser.parse(msg, "AD-ICICIB");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("credit");
      expect(res.transaction?.amount).toBe(2500);
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.IMPS);
      expect(res.transaction?.payee).toBe("RAJESH");
      expect(res.transaction?.referenceNumber).toBe("425789123457");
    });
  });

  describe("parse - RTGS", () => {
    it("parses RTGS high-value debit transfer", () => {
      const msg =
        "Rs. 50,000.00 debited from A/C 1234 on 14-09-26 by RTGS Ref R123456789 to VENDOR.";
      const res = parser.parse(msg, "CP-SBIINB");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(50000);
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.RTGS);
      expect(res.transaction?.payee).toBe("VENDOR");
      expect(res.transaction?.referenceNumber).toBe("R123456789");
    });
  });
});
