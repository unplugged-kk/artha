import { UpiSmsParser } from "./upi-sms.parser";
import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";

describe("UpiSmsParser", () => {
  let parser: UpiSmsParser;

  beforeEach(() => {
    parser = new UpiSmsParser();
  });

  describe("canParse", () => {
    it("returns true for messages containing UPI or VPA", () => {
      expect(parser.canParse("Rs 500 debited via UPI Ref 123456789012")).toBe(
        true,
      );
      expect(parser.canParse("Sent to VPA swiggy@icici")).toBe(true);
    });

    it("returns false for messages without UPI keywords", () => {
      expect(parser.canParse("Spent Rs 500 on credit card ending 1234")).toBe(
        false,
      );
      expect(parser.canParse("")).toBe(false);
    });
  });

  describe("parse - UPI Debits", () => {
    it("parses HDFC Bank UPI debit SMS with VPA and Ref No", () => {
      const msg =
        "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No 425789123456). Avl Bal: Rs.25,000.00.";
      const res = parser.parse(msg, "VM-HDFCBK");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction).toBeDefined();
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(500);
      expect(res.transaction?.date).toBe("2026-09-14");
      expect(res.transaction?.paymentMethod).toBe(PaymentMethod.UPI);
      expect(res.transaction?.upiVpa).toBe("swiggy@icici");
      expect(res.transaction?.upiReference).toBe("425789123456");
      expect(res.transaction?.payee).toBe("swiggy");
      expect(res.transaction?.accountMask).toBe("1234");
      expect(res.transaction?.bankName).toBe("HDFC Bank");
      expect(res.transaction?.balance).toBe(25000);
    });

    it("parses ICICI Bank slash narration pattern: Info: UPI/RRN/Payee", () => {
      const msg =
        "Dear Customer, A/C **1234 is debited for INR 450.00 on 14-Sep-26. Info: UPI/425789123456/Swiggy. Bal: INR 12,340.00.";
      const res = parser.parse(msg, "AD-ICICIB");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(450);
      expect(res.transaction?.payee).toBe("Swiggy");
      expect(res.transaction?.upiReference).toBe("425789123456");
      expect(res.transaction?.bankName).toBe("ICICI Bank");
    });

    it("parses Kotak Bank UPI debit: Sent Rs... to ... UPI Ref ...", () => {
      const msg =
        "Sent Rs.320.00 from Kotak Bank AC X1234 to zomato@hdfcbank on 14-09-2026. UPI Ref 425789123456. Bal: Rs.8,500.00.";
      const res = parser.parse(msg, "JM-KOTAKB");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("debit");
      expect(res.transaction?.amount).toBe(320);
      expect(res.transaction?.upiVpa).toBe("zomato@hdfcbank");
      expect(res.transaction?.payee).toBe("zomato");
      expect(res.transaction?.bankName).toBe("Kotak Mahindra Bank");
    });
  });

  describe("parse - UPI Credits", () => {
    it("parses HDFC Bank UPI credit with counterparty VPA", () => {
      const msg =
        "Rs.15,000.00 credited to HDFC Bank A/C **1234 on 14-09-26 by A/C linked to UPI VPA user@okhdfcbank (UPI Ref No 425789123457). Avl Bal: Rs.40,000.00.";
      const res = parser.parse(msg, "VM-HDFCBK");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("credit");
      expect(res.transaction?.amount).toBe(15000);
      expect(res.transaction?.date).toBe("2026-09-14");
      expect(res.transaction?.upiVpa).toBe("user@okhdfcbank");
      expect(res.transaction?.upiReference).toBe("425789123457");
      expect(res.transaction?.bankName).toBe("HDFC Bank");
    });

    it("parses ICICI Bank UPI refund credit", () => {
      const msg =
        "Dear Customer, A/C **1234 is credited with INR 5,000.00 on 14-Sep-26 by UPI/425789123457/refund. Bal: INR 17,340.00.";
      const res = parser.parse(msg, "AD-ICICIB");

      expect(res.success).toBe(true);
      expect(res.status).toBe("parsed");
      expect(res.transaction?.type).toBe("credit");
      expect(res.transaction?.amount).toBe(5000);
      expect(res.transaction?.upiReference).toBe("425789123457");
    });
  });

  describe("parse - Edge cases and rejections", () => {
    it("rejects non-transactional OTP messages containing UPI", () => {
      const msg =
        "Your OTP to register for UPI services is 482910. Do not share this with anyone.";
      const res = parser.parse(msg);

      expect(res.success).toBe(false);
      expect(res.status).toBe("unsupported");
      expect(res.reason).toBe("otp_or_auth_message");
    });

    it("rejects messages with conflicting debit and credit keywords as ambiguous", () => {
      const msg =
        "A/C 1234 was debited for Rs 500 and credited with Rs 500 via UPI";
      const res = parser.parse(msg);

      expect(res.success).toBe(false);
      expect(res.status).toBe("ambiguous");
    });

    it("rejects messages with missing transaction amount as invalid", () => {
      const msg = "A/C **1234 was debited on 14-09-26 via UPI Ref 123456789012";
      const res = parser.parse(msg);

      expect(res.success).toBe(false);
      expect(res.status).toBe("invalid");
    });
  });
});
