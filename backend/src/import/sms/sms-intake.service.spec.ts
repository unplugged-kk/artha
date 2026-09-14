import { SmsIntakeService } from "./sms-intake.service";
import { ImportRegularProcessorService } from "../import-regular-processor.service";
import { SmsSenderRegistryService } from "./sms-sender-registry.service";
import { DataSource } from "typeorm";
import { PaymentMethod } from "../../transactions/entities/payment-method.enum";
import { Account, AccountType } from "../../accounts/entities/account.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { QifTransaction } from "../qif-parser";
import { ImportContext } from "../import-context";

jest.mock("../../common/db/scoped-db", () =>
  jest
    .requireActual("../../test-helpers/scoped-db-testing")
    .scopedDbMockModule(),
);

describe("SmsIntakeService", () => {
  let service: SmsIntakeService;
  let mockDataSource: any;
  let mockManager: any;
  let mockRegularProcessor: any;
  let mockSenderRegistryService: any;

  const userId = "user-uuid-1";
  const accountId = "acc-uuid-1";

  const mockAccount: Account = {
    id: accountId,
    userId,
    name: "HDFC Checking",
    accountType: AccountType.CHEQUING,
    currencyCode: "INR",
    accountNumber: "1234",
    isClosed: false,
  } as Account;

  beforeEach(() => {
    mockManager = {
      find: jest.fn().mockResolvedValue([mockAccount]),
      findOne: jest
        .fn()
        .mockImplementation((entityClass: any, _options: any) => {
          if (entityClass === Account) {
            return Promise.resolve(mockAccount);
          }
          if (entityClass === Transaction) {
            return Promise.resolve({
              id: "tx-123",
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
      resolveAccountForSender: jest.fn().mockResolvedValue(mockAccount),
    };

    service = new SmsIntakeService(
      mockDataSource as unknown as DataSource,
      mockRegularProcessor as unknown as ImportRegularProcessorService,
      mockSenderRegistryService as unknown as SmsSenderRegistryService,
    );
  });

  describe("parseSms", () => {
    it("parses UPI debit SMS and enriches with merchant reference metadata", async () => {
      const msg =
        "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No 425789123456). Avl Bal: Rs.25,000.00.";

      const res = await service.parseSms(userId, {
        message: msg,
        sender: "VM-HDFCBK",
      });

      expect(res.status).toBe("parsed");
      expect(res.candidate).toBeDefined();
      expect(res.candidate?.amount).toBe(-500); // Negative for debit/expense
      expect(res.candidate?.type).toBe("debit");
      expect(res.candidate?.paymentMethod).toBe(PaymentMethod.UPI);
      expect(res.candidate?.upiVpa).toBe("swiggy@icici");
      expect(res.candidate?.upiReference).toBe("425789123456");
      expect(res.resolvedAccountId).toBe(accountId);
      expect(res.resolvedAccountName).toBe("HDFC Checking");
      // Canonical merchant recognized from Priority 10 reference data
      expect(res.canonicalMerchantName).toBe("Swiggy");
      expect(res.suggestedCategory).toBe("Food & Dining");
    });

    it("parses UPI credit SMS with positive signed amount", async () => {
      const msg =
        "Rs.15,000.00 credited to HDFC Bank A/C **1234 on 14-09-26 by A/C linked to UPI VPA user@okhdfcbank (UPI Ref No 425789123457). Avl Bal: Rs.40,000.00.";

      const res = await service.parseSms(userId, {
        message: msg,
        sender: "VM-HDFCBK",
      });

      expect(res.status).toBe("parsed");
      expect(res.candidate?.amount).toBe(15000); // Positive for credit/income
      expect(res.candidate?.type).toBe("credit");
      expect(res.candidate?.paymentMethod).toBe(PaymentMethod.UPI);
    });

    it("returns unsupported status on non-transactional OTP messages", async () => {
      const res = await service.parseSms(userId, {
        message:
          "Your OTP for transaction is 123456. Do not share with anyone.",
        sender: "VM-HDFCBK",
      });

      expect(res.status).toBe("unsupported");
      expect(res.candidate).toBeUndefined();
    });

    it("returns invalid status when amount is missing", async () => {
      const res = await service.parseSms(userId, {
        message: "Your A/C ending 1234 was debited on 14-09-26 via UPI",
        sender: "VM-HDFCBK",
      });

      expect(res.status).toBe("invalid");
    });
  });

  describe("importSms - Canonical Processing & Invariants", () => {
    it("imports parsed UPI debit through canonical regularProcessor with negative sign", async () => {
      const msg =
        "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No 425789123456). Avl Bal: Rs.25,000.00.";

      const res = await service.importSms(userId, {
        message: msg,
        sender: "VM-HDFCBK",
        accountId,
      });

      expect(res.status).toBe("imported");
      expect(res.amount).toBe(-500);
      expect(res.paymentMethod).toBe(PaymentMethod.UPI);
      expect(res.upiVpa).toBe("swiggy@icici");
      expect(res.upiReference).toBe("425789123456");
      expect(res.importHash).toBeDefined();

      // Verify regularProcessor was called with valid QifTransaction
      expect(mockRegularProcessor.processTransaction).toHaveBeenCalled();
      const passedQifTx = mockRegularProcessor.processTransaction.mock
        .calls[0][1] as QifTransaction;
      expect(passedQifTx.amount).toBe(-500);
      expect(passedQifTx.paymentMethod).toBe(PaymentMethod.UPI);
      expect(passedQifTx.fitid).toBe("425789123456"); // Priority 8 sourceId mapping
    });

    it("returns skipped status on duplicate import (Priority 8 idempotency)", async () => {
      mockRegularProcessor.processTransaction.mockImplementationOnce(
        async (ctx: ImportContext) => {
          ctx.importResult.skipped++; // Existing import identity collision
        },
      );

      const msg =
        "Rs.500.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No 425789123456).";

      const res = await service.importSms(userId, {
        message: msg,
        sender: "VM-HDFCBK",
        accountId,
      });

      expect(res.status).toBe("skipped");
      expect(res.reason).toBe("duplicate_import_hash");
      expect(res.importHash).toBeDefined();
    });

    it("returns review_needed when account cannot be resolved safely", async () => {
      mockSenderRegistryService.resolveAccountForSender.mockResolvedValueOnce(
        null,
      );
      mockManager.find.mockResolvedValueOnce([]); // No account matching mask

      const msg = "Rs.500.00 debited via UPI Ref 425789123456 to merchant.";

      const res = await service.importSms(userId, {
        message: msg,
      });

      expect(res.status).toBe("review_needed");
      expect(res.reason).toBe("account_unresolved");
      expect(mockRegularProcessor.processTransaction).not.toHaveBeenCalled();
    });

    it("fails closed on unsupported or promotional messages", async () => {
      const res = await service.importSms(userId, {
        message: "Congratulations! You won a cashback coupon. Click here.",
      });

      expect(res.status).toBe("unsupported");
      expect(mockRegularProcessor.processTransaction).not.toHaveBeenCalled();
    });
  });
});
