import { parseBankSms, ParsedSms } from "./sms-parser";

function parsed(text: string): ParsedSms {
  const r = parseBankSms(text);
  if (r.status !== "parsed") throw new Error(`unparsed: ${r.reason}`);
  return r;
}

describe("parseBankSms fixtures", () => {
  it("HDFC UPI debit", () => {
    const r = parsed(
      "HDFC Bank: Rs.1,250.00 debited from a/c **1234 on 12-03-25 to VPA swiggy@icici (UPI Ref No 412345678901). Not you? Call 18002586161",
    );
    expect(r).toMatchObject({
      bank: "hdfc",
      direction: "debit",
      amount: 1250,
      accountLast4: "1234",
      date: "2025-03-12",
      vpa: "swiggy@icici",
      reference: "412345678901",
      isUpi: true,
    });
  });

  it("HDFC 'Sent' format names the bank and counterparty", () => {
    const r = parsed(
      "Sent Rs.500.00 From HDFC Bank A/C *1234 To RAMESH KUMAR On 12/03/25 Ref 412345678901",
    );
    expect(r).toMatchObject({
      bank: "hdfc",
      amount: 500,
      counterparty: "RAMESH KUMAR",
      date: "2025-03-12",
      confidence: "high",
    });
  });

  it("ICICI debit with named month", () => {
    const r = parsed(
      "ICICI Bank Acct XX123 debited for Rs 1,500.00 on 12-Mar-25; ZOMATO credited. UPI:412345678901.",
    );
    expect(r).toMatchObject({
      bank: "icici",
      direction: "debit",
      amount: 1500,
      accountLast4: "123",
      date: "2025-03-12",
      counterparty: "ZOMATO",
      reference: "412345678901",
    });
  });

  it("SBI UPI alert has no bank name", () => {
    const r = parsed(
      "Dear UPI user A/C X1234 debited by 250.0 on date 12Mar25 trf to AMIT SHARMA Refno 412345678901",
    );
    expect(r).toMatchObject({
      bank: "sbi",
      amount: 250,
      date: "2025-03-12",
      counterparty: "AMIT SHARMA",
      reference: "412345678901",
    });
  });

  it("Axis slash-delimited UPI string", () => {
    const r = parsed(
      "INR 1,200.00 debited A/c no. XX1234 12-03-25 14:22:10 UPI/P2M/412345678901/Big Bazaar - Axis Bank",
    );
    expect(r).toMatchObject({
      bank: "axis",
      amount: 1200,
      counterparty: "Big Bazaar - Axis Bank",
      reference: "412345678901",
    });
  });

  it("Kotak credit", () => {
    const r = parsed(
      "Received Rs.300.00 in your Kotak Bank AC X1234 from priya@ybl on 12-03-25.UPI Ref 412345678901.",
    );
    expect(r).toMatchObject({
      bank: "kotak",
      direction: "credit",
      amount: 300,
      vpa: "priya@ybl",
    });
  });
});

describe("parseBankSms refuses to guess", () => {
  it("rejects OTP messages", () => {
    expect(
      parseBankSms("123456 is your OTP for Rs.500 txn. Do not share."),
    ).toEqual({
      status: "unparsed",
      reason: "not_a_transaction",
    });
  });

  it("rejects a message with no amount", () => {
    expect(parseBankSms("Your account was debited. Visit branch.")).toEqual({
      status: "unparsed",
      reason: "no_amount",
    });
  });

  it("rejects ambiguous direction", () => {
    expect(
      parseBankSms("Rs.100 debited and credited back to your account").status,
    ).toBe("unparsed");
  });

  it("an impossible date becomes null and lowers confidence", () => {
    const r = parsed("Rs.100 debited from HDFC Bank a/c 1234 on 31-02-25");
    expect(r.date).toBeNull();
    expect(r.confidence).toBe("low");
  });

  it("a message without a date is low confidence, not today", () => {
    const r = parsed("HDFC Bank: Rs.100 debited from a/c 1234");
    expect(r.date).toBeNull();
    expect(r.confidence).toBe("low");
  });

  it("amount is always positive and rounded to paise", () => {
    expect(parsed("Rs.99.5 debited from a/c 1234").amount).toBe(99.5);
  });
});
