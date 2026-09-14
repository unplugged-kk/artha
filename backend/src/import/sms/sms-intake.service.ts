import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../../common/db/scoped-db";
import { Account } from "../../accounts/entities/account.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { ImportRegularProcessorService } from "../import-regular-processor.service";
import { ImportContext } from "../import-context";
import { ImportResultDto } from "../dto/import.dto";
import { QifTransaction } from "../qif-parser";
import { computeTransactionImportIdentity } from "../import-identity.util";
import { CompositeSmsParser } from "./parsers/composite-sms-parser";
import { SmsSenderRegistryService } from "./sms-sender-registry.service";
import { ParseSmsDto } from "./dto/parse-sms.dto";
import { ImportSmsDto } from "./dto/import-sms.dto";
import {
  ParsedSmsResponseDto,
  SmsImportResultDto,
} from "./dto/parsed-sms-response.dto";
import { matchMerchantReference } from "../../payees/merchant-matcher.util";

@Injectable()
export class SmsIntakeService {
  private readonly logger = new Logger(SmsIntakeService.name);
  private readonly parser = new CompositeSmsParser();

  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ImportRegularProcessorService))
    private readonly regularProcessor: ImportRegularProcessorService,
    private readonly senderRegistryService: SmsSenderRegistryService,
  ) {}

  /**
   * Parses an SMS message and extracts a structured transaction candidate.
   * Does NOT persist any transaction or raw message text.
   */
  async parseSms(
    userId: string,
    dto: ParseSmsDto,
  ): Promise<ParsedSmsResponseDto> {
    const parseResult = this.parser.parse(dto.message, dto.sender);

    if (!parseResult.success || !parseResult.transaction) {
      return {
        status: parseResult.status,
        reason: parseResult.reason,
      };
    }

    const candidate = parseResult.transaction;

    // Signed amount: negative for debit/expense, positive for credit/income
    const signedAmount =
      candidate.type === "debit" ? -candidate.amount : candidate.amount;

    // Resolve merchant reference suggestion (Priority 10)
    const merchantMatch = matchMerchantReference(candidate.payee);

    // Resolve destination account candidate
    const resolvedAccount = await this.resolveAccount(
      userId,
      dto.sender,
      candidate.accountMask,
    );

    return {
      status: "parsed",
      candidate: {
        date: candidate.date,
        amount: signedAmount,
        type: candidate.type,
        payee: candidate.payee,
        paymentMethod: candidate.paymentMethod,
        upiVpa: candidate.upiVpa,
        upiReference: candidate.upiReference,
        referenceNumber: candidate.referenceNumber,
        accountMask: candidate.accountMask,
        bankName: candidate.bankName,
        balance: candidate.balance,
      },
      resolvedAccountId: resolvedAccount?.id,
      resolvedAccountName: resolvedAccount?.name,
      suggestedCategory: merchantMatch?.categorySuggestion ?? undefined,
      canonicalMerchantName: merchantMatch?.canonicalName ?? undefined,
    };
  }

  /**
   * Parses and imports an SMS message into the canonical transaction ledger.
   * Feeds directly into Artha's existing ImportRegularProcessorService and
   * enforces Priority 8 import identity/idempotency and Priority 9 payment metadata.
   */
  async importSms(
    userId: string,
    dto: ImportSmsDto,
  ): Promise<SmsImportResultDto> {
    const parseResult = this.parser.parse(dto.message, dto.sender);

    if (!parseResult.success || !parseResult.transaction) {
      return {
        status:
          parseResult.status === "parsed" ? "invalid" : parseResult.status,
        reason: parseResult.reason,
      };
    }

    const candidate = parseResult.transaction;
    const signedAmount =
      candidate.type === "debit" ? -candidate.amount : candidate.amount;

    return withScopedDb(this.dataSource, async (manager) => {
      // 1. Resolve target account
      let account: Account | null = null;
      if (dto.accountId) {
        account = await manager.findOne(Account, {
          where: { id: dto.accountId, userId },
        });
        if (!account) {
          throw new NotFoundException("Selected account not found");
        }
      } else {
        account = await this.resolveAccount(
          userId,
          dto.sender,
          candidate.accountMask,
        );
      }

      if (!account) {
        return {
          status: "review_needed",
          reason: "account_unresolved",
        };
      }

      // 2. Build canonical QifTransaction representation
      const memo = candidate.referenceNumber
        ? `SMS Ref: ${candidate.referenceNumber}`
        : candidate.bankName
          ? `SMS from ${candidate.bankName}`
          : "SMS Transaction";

      const sourceId =
        candidate.upiReference || candidate.referenceNumber || undefined;

      const qifTx: QifTransaction = {
        date: candidate.date,
        amount: signedAmount,
        payee: candidate.payee,
        memo,
        number: candidate.referenceNumber || candidate.upiReference || "",
        cleared: true,
        reconciled: false,
        category: "",
        isTransfer: false,
        transferAccount: "",
        splits: [],
        fitid: sourceId,
        paymentMethod: candidate.paymentMethod,
        upiVpa: candidate.upiVpa,
        upiReference: candidate.upiReference,
        security: "",
        action: "",
        price: 0,
        quantity: 0,
        commission: 0,
      };

      // 3. Setup ImportContext for existing regular processor
      const importResult: ImportResultDto = {
        imported: 0,
        skipped: 0,
        errors: 0,
        errorMessages: [],
        categoriesCreated: 0,
        accountsCreated: 0,
        payeesCreated: 0,
        securitiesCreated: 0,
      };

      const categoryMap = new Map<string, string | null>();
      if (dto.categoryId) {
        categoryMap.set("", dto.categoryId);
      }

      const ctx: ImportContext = {
        manager,
        userId,
        accountId: account.id,
        account,
        categoryMap,
        accountMap: new Map(),
        loanCategoryMap: new Map(),
        securityMap: new Map(),
        tagMap: new Map(),
        importStartTime: new Date(),
        dateCounters: new Map(),
        affectedAccountIds: new Set([account.id]),
        importResult,
        transferDupCounts: new Map(),
        contentDupCounts: new Map(),
      };

      // 4. Execute through existing canonical regular processor
      const savepointName = "sms_intake_tx";
      await manager.query(`SAVEPOINT ${savepointName}`);
      try {
        await this.regularProcessor.processTransaction(ctx, qifTx);
        await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
      } catch (err) {
        await manager.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        this.logger.warn(`Error processing SMS transaction: ${err.message}`);
        return {
          status: "invalid",
          reason: err.message,
        };
      }

      // Compute expected import identity hash for verification
      const identity = computeTransactionImportIdentity({
        accountId: account.id,
        date: qifTx.date,
        amount: qifTx.amount,
        payee: qifTx.payee,
        memo: qifTx.memo,
        sourceId: qifTx.fitid || qifTx.number,
        isTransfer: qifTx.isTransfer,
        ordinal: 1,
      });

      // 5. Evaluate result
      if (importResult.skipped > 0) {
        return {
          status: "skipped",
          accountId: account.id,
          importHash: identity.hash,
          reason: "duplicate_import_hash",
        };
      }

      if (importResult.imported > 0) {
        const savedTx = await manager.findOne(Transaction, {
          where: {
            accountId: account.id,
            importHash: identity.hash,
          },
        });

        return {
          status: "imported",
          transactionId: savedTx?.id,
          importHash: identity.hash,
          accountId: account.id,
          transactionDate: candidate.date,
          amount: signedAmount,
          payeeName: savedTx?.payeeName || candidate.payee,
          paymentMethod: candidate.paymentMethod,
          upiVpa: candidate.upiVpa,
          upiReference: candidate.upiReference,
        };
      }

      return {
        status: "invalid",
        reason: importResult.errorMessages.join("; ") || "failed_to_import",
      };
    });
  }

  /**
   * Resolves target account from sender registry or account mask.
   */
  private async resolveAccount(
    userId: string,
    sender?: string,
    accountMask?: string,
  ): Promise<Account | null> {
    // 1. Try resolving via user's sender registry
    if (sender) {
      const registryAccount =
        await this.senderRegistryService.resolveAccountForSender(
          userId,
          sender,
        );
      if (registryAccount) {
        return registryAccount;
      }
    }

    // 2. Try resolving via account mask against user's active accounts
    if (accountMask) {
      return withScopedDb(this.dataSource, async (manager) => {
        const userAccounts = await manager.find(Account, {
          where: { userId, isClosed: false },
        });

        const matched = userAccounts.filter((acc) => {
          if (acc.accountNumber && acc.accountNumber.endsWith(accountMask)) {
            return true;
          }
          if (
            acc.name &&
            (acc.name.endsWith(accountMask) || acc.name.includes(accountMask))
          ) {
            return true;
          }
          return false;
        });

        // Only return if unambiguous single match
        if (matched.length === 1) {
          return matched[0];
        }

        return null;
      });
    }

    return null;
  }
}
