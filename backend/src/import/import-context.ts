import { EntityManager } from "typeorm";
import { Account } from "../accounts/entities/account.entity";
import { ImportResultDto } from "./dto/import.dto";

export interface ImportContext {
  manager: EntityManager;
  userId: string;
  accountId: string;
  account: Account;
  categoryMap: Map<string, string | null>;
  accountMap: Map<string, string | null>;
  loanCategoryMap: Map<string, string>;
  securityMap: Map<string, string | null>;
  /** Maps tag name (case-insensitive key) to tag ID */
  tagMap: Map<string, string>;
  importStartTime: Date;
  dateCounters: Map<string, number>;
  affectedAccountIds: Set<string>;
  importResult: ImportResultDto;
  /** Tracks how many QIF entries with each transfer signature have been seen in the current block,
   *  used to distinguish genuinely different transfers that share date/amount/account. */
  transferDupCounts: Map<string, number>;
  /**
   * Existing payees keyed by their normalised name, so the same merchant
   * written one way by one bank and another way by the next resolves to a
   * single payee instead of one per spelling. Built on first use and carried
   * for the rest of the import, so the lookup costs one query per import rather
   * than one per transaction. Payees created *during* the import register
   * themselves here, so a spelling first seen in row 3 is matched in row 300.
   */
  payeeByNormalizedName?: Map<string, ImportedPayeeRef>;
}

/** What the import matching needs to know about an existing payee. */
export interface ImportedPayeeRef {
  id: string;
  name: string;
  defaultCategoryId: string | null;
}

/**
 * Update account balance with proper decimal rounding.
 * Uses explicit read-modify-write to avoid TypeORM increment precision issues.
 */
export async function updateAccountBalance(
  manager: EntityManager,
  accountId: string,
  amount: number,
): Promise<void> {
  const account = await manager.findOne(Account, {
    where: { id: accountId },
  });
  if (account) {
    const currentBalance = Number(account.currentBalance) || 0;
    const newBalance =
      Math.round((currentBalance + Number(amount)) * 100) / 100;
    await manager.update(Account, accountId, {
      currentBalance: newBalance,
    });
  }
}
