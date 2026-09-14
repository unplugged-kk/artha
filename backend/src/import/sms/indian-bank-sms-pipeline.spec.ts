import { SmsIntakeService } from "./sms-intake.service";
import { CompositeSmsParser } from "./parsers/composite-sms-parser";
import { DataSource } from "typeorm";
import { PaymentMethod } from "../../transactions/entities/payment-method.enum";
import { Account, AccountType } from "../../accounts/entities/account.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { QifTransaction } from "../qif-parser";
import { ImportContext } from "../import-context";
import { computeTransactionImportIdentity } from "../import-identity.util";

jest.mock("../../common/db/scoped-db", () =>
  jest
    .requireActual("../../test-helpers/scoped-db-testing")
    .scopedDbMockModule(),
);

describe("Indian Bank SMS Intake Pipeline — Comprehensive Specification", () => {
  let parser: CompositeSmsParser;
  let service: SmsIntakeService;
  let mockDataSource: any;
  let mockManager: any;
  let mockRegularProcessor: any;
  let mockSenderRegistryService: any;

  const userId = "user-100";
  const otherUserId = "user-200";
  const accountId = "account-100";

  const userAccount: Account = {
    id: accountId,
    userId,
    name: "HDFC Primary Checking",
    accountType: AccountType.CHEQUING,
    currencyCode: "INR",
    accountNumber: "1234",
    isClosed: false,
  } as Account;

  beforeEach(() => {
    parser = new CompositeSmsParser();

    mockManager = {
      find: jest.fn().mockImplementation((entityClass: any, options: any) => {
        if (entityClass === Account) {
          if (options?.where?.userId === userId) {
            return Promise.resolve([userAccount]);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
      findOne: jest
        .fn()
        .mockImplementation((entityClass: any, options: any) => {
          if (entityClass === Account) {
            if (
              options?.where?.id === accountId &&
              options?.where?.userId === userId
            ) {
              return Promise.resolve(userAccount);
            }
            return Promise.resolve(null);
          }
          if (entityClass === Transaction) {
            return Promise.resolve({
              id: "tx-imported-1",
              accountId,
              amount: -500,
              payeeName: "Swiggy",
              paymentMethod: PaymentMethod.UPI,
              upiVpa: "swiggy@icici",
              upiReference: "425789123456",
            });
          }
          return Promise.resolve(null);
        }),
      query: jest.fn().mockResolvedValue([]),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (runInTransaction: any) => {
          return runInTransaction(mockManager);
        }),
    };

    mockRegularProcessor = {
      processTransaction: jest
        .fn()
        .mockImplementation(
          async (ctx: ImportContext, _qifTx: QifTransaction) => {
            ctx.importResult.imported++;
          },
        ),
    };

    mockSenderRegistryService = {
      resolveAccountForSender: jest
        .fn()
        .mockImplementation(async (uid: string, sender?: string) => {
          if (
            uid === userId &&
            sender &&
            (sender.includes("HDFC") || sender.includes("HDFCBK"))
          ) {
            return userAccount;
          }
          return null;
        }),
    };

    service = new SmsIntakeService(
      mockDataSource as unknown as DataSource,
      mockRegularProcessor,
      mockSenderRegistryService,
    );
  });

  // 1. UPI debit message
  it("1. parses UPI debit message into negative expense transaction", async () => {
    const msg =
      "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No 425789123456). Avl Bal: Rs.25,000.00.";
    const res = await service.importSms(userId, {
      message: msg,
      sender: "VM-HDFCBK",
    });

    expect(res.status).toBe("imported");
    expect(res.amount).toBe(-500);
    expect(res.paymentMethod).toBe(PaymentMethod.UPI);
  });

  // 2. UPI credit message
  it("2. parses UPI credit message into positive income transaction", async () => {
    const msg =
      "Rs.15,000.00 credited to HDFC Bank A/C **1234 on 14-09-26 by A/C linked to UPI VPA user@okhdfcbank (UPI Ref No 425789123457).";
    const res = await service.importSms(userId, {
      message: msg,
      sender: "VM-HDFCBK",
    });

    expect(res.status).toBe("imported");
    expect(res.amount).toBe(15000);
    expect(res.paymentMethod).toBe(PaymentMethod.UPI);
  });

  // 3. IMPS transfer
  it("3. parses IMPS transfer debit with IMPS reference", async () => {
    const msg =
      "Your A/C **1234 debited INR 5,000.00 on 14-09-26 via IMPS Ref 425789123456 to ACME CORP.";
    const parsed = parser.parse(msg, "AD-ICICIB");

    expect(parsed.success).toBe(true);
    expect(parsed.transaction?.paymentMethod).toBe(PaymentMethod.IMPS);
    expect(parsed.transaction?.referenceNumber).toBe("425789123456");
  });

  // 4. NEFT transfer
  it("4. parses NEFT transfer credit with NEFT reference", async () => {
    const msg =
      "HDFC Bank: Rs 85,000.00 credited to A/C ending 1234 on 14-Sep-26 by NEFT-ACME CORP-N123456789. Avl Bal INR 1,25,000.00.";
    const parsed = parser.parse(msg, "VM-HDFCBK");

    expect(parsed.success).toBe(true);
    expect(parsed.transaction?.paymentMethod).toBe(PaymentMethod.NEFT);
    expect(parsed.transaction?.payee).toBe("ACME CORP");
  });

  // 5. RTGS transfer
  it("5. parses RTGS transfer debit", async () => {
    const msg =
      "Rs. 50,000.00 debited from A/C 1234 on 14-09-26 by RTGS Ref R123456789 to VENDOR.";
    const parsed = parser.parse(msg, "CP-SBIINB");

    expect(parsed.success).toBe(true);
    expect(parsed.transaction?.paymentMethod).toBe(PaymentMethod.RTGS);
    expect(parsed.transaction?.amount).toBe(50000);
  });

  // 6. Card transaction
  it("6. parses Card spend with merchant and card mask", async () => {
    const msg =
      "Alert: You have spent INR 1,450.00 on HDFC Bank Card ending 1234 at SWIGGY on 2026-09-14:14:30:15. Avl limit: INR 45,000.00.";
    const parsed = parser.parse(msg, "VM-HDFCBK");

    expect(parsed.success).toBe(true);
    expect(parsed.transaction?.paymentMethod).toBe(PaymentMethod.CARD);
    expect(parsed.transaction?.payee).toBe("SWIGGY");
    expect(parsed.transaction?.accountMask).toBe("1234");
  });

  // 7. ATM withdrawal
  it("7. parses ATM withdrawal with cash payment method", async () => {
    const msg =
      "INR 2,000.00 withdrawn from HDFC Bank A/C **1234 at HDFC ATM KORAMANGALA on 14-09-26. Avl Bal: INR 38,000.00.";
    const parsed = parser.parse(msg, "VM-HDFCBK");

    expect(parsed.success).toBe(true);
    expect(parsed.transaction?.paymentMethod).toBe(PaymentMethod.CASH);
    expect(parsed.transaction?.type).toBe("debit");
  });

  // 8. Cheque clearance
  it("8. parses Cheque clearance with cheque number", async () => {
    const msg =
      "Cheque No. 123456 for Rs. 15,000.00 debited from A/C **1234 on 14-09-26.";
    const parsed = parser.parse(msg, "VM-HDFCBK");

    expect(parsed.success).toBe(true);
    expect(parsed.transaction?.paymentMethod).toBe(PaymentMethod.CHEQUE);
    expect(parsed.transaction?.referenceNumber).toBe("123456");
  });

  // 9. Malformed SMS
  it("9. rejects malformed SMS as invalid", async () => {
    const res = await service.importSms(userId, { message: "" });
    expect(res.status).toBe("invalid");
  });

  // 10. Unsupported sender with unrecognized body
  it("10. rejects unsupported sender with arbitrary body", async () => {
    const res = await service.importSms(userId, {
      message: "Hey buddy let us grab lunch today at 1pm",
      sender: "UNKNOWN",
    });
    expect(res.status).toBe("unsupported");
  });

  // 11. Recognized sender with malformed body
  it("11. fails safely when recognized sender sends non-financial body", async () => {
    const res = await service.importSms(userId, {
      message: "Dear customer, your bank branch will be closed this Friday.",
      sender: "VM-HDFCBK",
    });
    expect(res.status).toBe("unsupported");
  });

  // 12. Ambiguous message (conflicting debit/credit terms)
  it("12. marks message with conflicting debit and credit terms as ambiguous", async () => {
    const msg =
      "A/C 1234 was debited for Rs 500 and credited with Rs 500 via UPI";
    const parsed = parser.parse(msg);
    expect(parsed.status).toBe("ambiguous");
  });

  // 13. Missing amount
  it("13. marks message with missing amount as invalid", async () => {
    const msg = "A/C **1234 debited on 14-09-26 via UPI Ref 425789123456";
    const parsed = parser.parse(msg);
    expect(parsed.status).toBe("invalid");
  });

  // 14. Invalid amount (zero or negative)
  it("14. rejects zero amount", async () => {
    const msg = "Rs.0.00 debited from A/C **1234 via UPI";
    const parsed = parser.parse(msg);
    expect(parsed.status).toBe("invalid");
  });

  // 15. Invalid date fallback or default
  it("15. defaults to today when date is omitted but message is valid", () => {
    const msg = "Rs.500.00 debited from A/C **1234 to VPA swiggy@icici";
    const parsed = parser.parse(msg);
    expect(parsed.success).toBe(true);
    expect(parsed.transaction?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // 16. Debit sign correctness
  it("16. ensures debited messages have negative amount in ledger input", async () => {
    const msg = "Rs.300.00 debited via UPI to Swiggy";
    await service.importSms(userId, { message: msg, accountId });

    const passedQifTx = mockRegularProcessor.processTransaction.mock
      .calls[0][1] as QifTransaction;
    expect(passedQifTx.amount).toBe(-300);
  });

  // 17. Credit sign correctness
  it("17. ensures credited messages have positive amount in ledger input", async () => {
    mockRegularProcessor.processTransaction.mockClear();
    const msg = "Rs.1,200.00 credited via UPI from Alice";
    await service.importSms(userId, { message: msg, accountId });

    const passedQifTx = mockRegularProcessor.processTransaction.mock
      .calls[0][1] as QifTransaction;
    expect(passedQifTx.amount).toBe(1200);
  });

  // 18. Payment method detection
  it("18. sets PaymentMethod.UPI for UPI messages", async () => {
    mockRegularProcessor.processTransaction.mockClear();
    const msg = "Rs.500.00 debited via UPI to Swiggy";
    await service.importSms(userId, { message: msg, accountId });

    const passedQifTx = mockRegularProcessor.processTransaction.mock
      .calls[0][1] as QifTransaction;
    expect(passedQifTx.paymentMethod).toBe(PaymentMethod.UPI);
  });

  // 19. UPI VPA extraction
  it("19. extracts UPI VPA handle", async () => {
    const msg = "Rs.500.00 debited from A/C **1234 to VPA swiggy@icici";
    const parsed = parser.parse(msg);
    expect(parsed.transaction?.upiVpa).toBe("swiggy@icici");
  });

  // 20. UPI RRN extraction
  it("20. extracts 12-digit UPI RRN / reference number", async () => {
    const msg = "Rs.500.00 debited via UPI (UPI Ref No 425789123456)";
    const parsed = parser.parse(msg);
    expect(parsed.transaction?.upiReference).toBe("425789123456");
  });

  // 21. Source transaction ID propagation
  it("21. maps UPI reference into QifTransaction.fitid for Priority 8 identity", async () => {
    mockRegularProcessor.processTransaction.mockClear();
    const msg = "Rs.500.00 debited via UPI (UPI Ref No 425789123456)";
    await service.importSms(userId, { message: msg, accountId });

    const passedQifTx = mockRegularProcessor.processTransaction.mock
      .calls[0][1] as QifTransaction;
    expect(passedQifTx.fitid).toBe("425789123456");
  });

  // 22. Merchant normalization & reference enrichment (Priority 10)
  it("22. enriches parsed candidate with Priority 10 canonical merchant reference", async () => {
    const msg =
      "Alert: You have spent INR 1,450.00 on HDFC Bank Card ending 1234 at SWIGGY on 2026-09-14:14:30:15.";
    const preview = await service.parseSms(userId, {
      message: msg,
      sender: "VM-HDFCBK",
    });

    expect(preview.canonicalMerchantName).toBe("Swiggy");
    expect(preview.suggestedCategory).toBe("Food & Dining");
  });

  // 23. Repeated same SMS is idempotent (Priority 8)
  it("23. skips re-import of identical SMS via import_hash collision", async () => {
    mockRegularProcessor.processTransaction.mockImplementationOnce(
      async (ctx: ImportContext) => {
        ctx.importResult.skipped++; // Existing duplicate detected
      },
    );

    const msg =
      "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No 425789123456).";
    const res = await service.importSms(userId, {
      message: msg,
      sender: "VM-HDFCBK",
    });

    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("duplicate_import_hash");
    expect(res.importHash).toBeDefined();
  });

  // 24. Distinct transactions with different reference numbers remain distinct
  it("24. computes different import hashes for same amount and merchant with different RRNs", () => {
    const id1 = computeTransactionImportIdentity({
      accountId,
      date: "2026-09-14",
      amount: -500,
      payee: "Swiggy",
      memo: "SMS Ref: 425789123456",
      sourceId: "425789123456",
      isTransfer: false,
      ordinal: 1,
    });

    const id2 = computeTransactionImportIdentity({
      accountId,
      date: "2026-09-14",
      amount: -500,
      payee: "Swiggy",
      memo: "SMS Ref: 425789123457",
      sourceId: "425789123457",
      isTransfer: false,
      ordinal: 1,
    });

    expect(id1.hash).not.toBe(id2.hash);
  });

  // 25. Cross-user isolation
  it("25. refuses to import into an account belonging to another user", async () => {
    await expect(
      service.importSms(otherUserId, {
        message: "Rs.500 debited via UPI",
        accountId, // accountId belongs to userId, NOT otherUserId
      }),
    ).rejects.toThrow();
  });

  // 26. Account unresolved fails closed
  it("26. returns review_needed when destination account cannot be identified", async () => {
    mockSenderRegistryService.resolveAccountForSender.mockResolvedValueOnce(
      null,
    );
    mockManager.find.mockResolvedValueOnce([]); // No account matching mask

    const msg = "Rs.500.00 debited via UPI Ref 425789123456 to merchant.";
    const res = await service.importSms(userId, { message: msg });

    expect(res.status).toBe("review_needed");
    expect(res.reason).toBe("account_unresolved");
  });
});
