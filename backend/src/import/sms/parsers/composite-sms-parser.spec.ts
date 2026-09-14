import { CompositeSmsParser } from "./composite-sms-parser";
import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";

describe("CompositeSmsParser", () => {
  let parser: CompositeSmsParser;

  beforeEach(() => {
    parser = new CompositeSmsParser();
  });

  it("dispatches to UpiSmsParser for UPI debit messages", () => {
    const res = parser.parse(
      "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No 425789123456).",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(true);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.UPI);
    expect(res.transaction?.amount).toBe(500);
  });

  it("dispatches to CardSmsParser for Card spend messages", () => {
    const res = parser.parse(
      "Alert: You have spent INR 1,450.00 on HDFC Bank Card ending 1234 at SWIGGY on 2026-09-14:14:30:15.",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(true);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CARD);
    expect(res.transaction?.payee).toBe("SWIGGY");
  });

  it("dispatches to AtmSmsParser for cash withdrawals", () => {
    const res = parser.parse(
      "INR 2,000.00 withdrawn from HDFC Bank A/C **1234 at HDFC ATM KORAMANGALA on 14-09-26.",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(true);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CASH);
  });

  it("dispatches to ChequeSmsParser for cheque transactions", () => {
    const res = parser.parse(
      "Cheque No. 123456 for Rs. 15,000.00 debited from A/C **1234 on 14-09-26.",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(true);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CHEQUE);
  });

  it("dispatches to BankTransferSmsParser for NEFT/IMPS/RTGS", () => {
    const res = parser.parse(
      "HDFC Bank: Rs 85,000.00 credited to A/C ending 1234 on 14-Sep-26 by NEFT-ACME CORP-N123456789.",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(true);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.NEFT);
  });

  it("rejects OTP messages as unsupported", () => {
    const res = parser.parse(
      "Your OTP for NetBanking login is 894102. Do not share it with anyone.",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe("unsupported");
    expect(res.reason).toBe("otp_or_auth_message");
  });

  it("rejects promotional loan offers as unsupported", () => {
    const res = parser.parse(
      "Congratulations! You are eligible for a pre-approved loan of Rs 5,00,000. Apply now.",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe("unsupported");
    expect(res.reason).toBe("promotional_message");
  });

  it("rejects scheduled auto-debit reminders as unsupported", () => {
    const res = parser.parse(
      "Dear Customer, auto-debit of Rs 1,499.00 is scheduled on 18-Sep-26 for your broadband.",
      "VM-HDFCBK",
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe("unsupported");
    expect(res.reason).toBe("scheduled_reminder");
  });

  it("rejects empty message as invalid", () => {
    const res = parser.parse("   ");
    expect(res.success).toBe(false);
    expect(res.status).toBe("invalid");
  });

  it("rejects unsupported arbitrary text", () => {
    const res = parser.parse("Hello world how are you doing today?");
    expect(res.success).toBe(false);
    expect(res.status).toBe("unsupported");
  });
});
