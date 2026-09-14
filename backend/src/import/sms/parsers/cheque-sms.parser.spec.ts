import { ChequeSmsParser } from "./cheque-sms.parser";
import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";

describe("ChequeSmsParser", () => {
  let parser: ChequeSmsParser;

  beforeEach(() => {
    parser = new ChequeSmsParser();
  });

  it("parses Cheque debit clearance with cheque number", () => {
    const msg =
      "Cheque No. 123456 for Rs. 15,000.00 debited from A/C **1234 on 14-09-26.";
    const res = parser.parse(msg, "VM-HDFCBK");

    expect(res.success).toBe(true);
    expect(res.status).toBe("parsed");
    expect(res.transaction?.type).toBe("debit");
    expect(res.transaction?.amount).toBe(15000);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CHEQUE);
    expect(res.transaction?.referenceNumber).toBe("123456");
  });

  it("parses Cheque credit deposit", () => {
    const msg =
      "Cheque No. 654321 for Rs. 25,000.00 credited to A/C **1234 on 14-09-26.";
    const res = parser.parse(msg, "AD-ICICIB");

    expect(res.success).toBe(true);
    expect(res.status).toBe("parsed");
    expect(res.transaction?.type).toBe("credit");
    expect(res.transaction?.amount).toBe(25000);
    expect(res.transaction?.paymentMethod).toBe(PaymentMethod.CHEQUE);
    expect(res.transaction?.referenceNumber).toBe("654321");
  });
});
