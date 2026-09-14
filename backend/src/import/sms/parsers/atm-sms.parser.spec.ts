import { AtmSmsParser } from "./atm-sms.parser";
import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";

describe("AtmSmsParser", () => {
  let parser: AtmSmsParser;

  beforeEach(() => {
    parser = new AtmSmsParser();
  });

  it("parses HDFC Bank ATM cash withdrawal", () => {
    const msg =
      "INR 2,000.00 withdrawn from HDFC Bank A/C **1234 at HDFC ATM KORAMANGALA on 14-09-26. Avl Bal: INR 38,000.00.";
    const res = parser.parse(msg, "VM-HDFCBK");

    expect(res.success).toBe(true);
    expect(res.status).toBe("parsed");
    expect(res.transaction?.type).toBe("debit");
    expect(res.transaction?.amount).toBe(2000);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CASH);
    expect(res.transaction?.payee).toContain("ATM");
    expect(res.transaction?.accountMask).toBe("1234");
    expect(res.transaction?.balance).toBe(38000);
  });

  it("parses ICICI Bank cash withdrawal at ATM", () => {
    const msg =
      "Dear Customer, your ICICI Bank A/C **1234 has been debited with INR 5,000.00 on 14-Sep-26 towards cash withdrawal at ATM. Avl Bal: INR 12,340.00.";
    const res = parser.parse(msg, "AD-ICICIB");

    expect(res.success).toBe(true);
    expect(res.status).toBe("parsed");
    expect(res.transaction?.type).toBe("debit");
    expect(res.transaction?.amount).toBe(5000);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CASH);
  });

  it("parses SBI ATM debit", () => {
    const msg =
      "Your A/C ending 1234 debited by Rs 2000.00 on 14Sep26 at SBI ATM. Avl Bal Rs 13432.10.";
    const res = parser.parse(msg, "CP-SBIINB");

    expect(res.success).toBe(true);
    expect(res.status).toBe("parsed");
    expect(res.transaction?.type).toBe("debit");
    expect(res.transaction?.amount).toBe(2000);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CASH);
  });
});
