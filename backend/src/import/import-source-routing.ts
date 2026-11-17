import { EntityManager } from "typeorm";
import { ImportCsvDto } from "./dto/import.dto";
import { QifParseResult } from "./qif-parser";

type ParsedRow = QifParseResult["transactions"][number];

export interface RoutedSourceRows {
  /** Rows per target account id, in file order. */
  groups: Map<string, ParsedRow[]>;
  /** "row N (label)" for every row with neither an account nor a skip. */
  unresolved: string[];
  skippedByUser: number;
}

/**
 * Decide where each row of a source-account-routed file goes: its per-row
 * override first, else its label's mapping. Pure -- nothing here touches the
 * database, so the preview and the commit route rows identically.
 */
export function routeSourceRows(
  dto: Pick<ImportCsvDto, "sourceAccountMappings" | "sourceRowOverrides">,
  transactions: ParsedRow[],
): RoutedSourceRows {
  const byLabel = new Map(
    (dto.sourceAccountMappings ?? []).map((m) => [m.originalName, m]),
  );
  const byRow = new Map(
    (dto.sourceRowOverrides ?? []).map((o) => [o.rowNumber, o]),
  );
  const groups = new Map<string, ParsedRow[]>();
  const unresolved: string[] = [];
  let skippedByUser = 0;
  for (const tx of transactions) {
    const choice =
      byRow.get(tx.sourceRowNumber!) ?? byLabel.get(tx.sourceAccount ?? "");
    if (choice?.skip) {
      skippedByUser++;
    } else if (choice?.accountId) {
      groups.set(choice.accountId, [
        ...(groups.get(choice.accountId) ?? []),
        tx,
      ]);
    } else {
      unresolved.push(
        `row ${tx.sourceRowNumber} ("${tx.sourceAccount || "(blank)"}")`,
      );
    }
  }
  return { groups, unresolved, skippedByUser };
}

export interface SourceRowOverlap {
  rowNumber: number;
  reason: "otherAccount" | "changedAmount";
  existing: {
    accountName: string;
    date: string;
    amount: number;
    payee: string;
  };
}

interface ExistingRow {
  id: string;
  account_id: string;
  account_name: string;
  transaction_date: string;
  amount: string;
  payee_name: string | null;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const units = (n: number | string) => Math.round(Number(n) * 10000);

/**
 * Rows that look like something already in the register without being an
 * exact repeat of it. An exact repeat (same account, date, signed amount and
 * payee) is a retry and converges on the import hash; these are what a retry
 * cannot explain and must be reviewed rather than posted beside the original:
 *
 * - otherAccount: the same date and signed amount already sits in a different
 *   account -- the row was remapped since the last import, or two accounts
 *   share a coincidental purchase.
 * - changedAmount: the same account, date and payee already holds a different
 *   amount -- the row was edited in the workbook since the last import.
 *
 * Existing rows that are exact repeats of some file row are set aside first,
 * so re-importing an unchanged file reports nothing.
 */
export async function findSourceRowOverlaps(
  manager: EntityManager,
  userId: string,
  groups: Map<string, ParsedRow[]>,
): Promise<SourceRowOverlap[]> {
  const rows = [...groups].flatMap(([accountId, txs]) =>
    txs.map((tx) => ({ accountId, tx })),
  );
  const dates = [...new Set(rows.map((r) => r.tx.date))];
  if (dates.length === 0) return [];
  const existing: ExistingRow[] = await manager.query(
    `SELECT t.id, t.account_id, a.name AS account_name,
            to_char(t.transaction_date, 'YYYY-MM-DD') AS transaction_date,
            t.amount, t.payee_name
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
      WHERE t.user_id = $1
        AND t.parent_transaction_id IS NULL
        AND t.status <> 'VOID'
        AND t.transaction_date = ANY($2::date[])`,
    [userId, dates],
  );

  const exact = (e: ExistingRow, accountId: string, tx: ParsedRow) =>
    e.account_id === accountId &&
    e.transaction_date === tx.date &&
    units(e.amount) === units(tx.amount) &&
    norm(e.payee_name) === norm(tx.payee);
  const accountedFor = new Set(
    existing
      .filter((e) => rows.some((r) => exact(e, r.accountId, r.tx)))
      .map((e) => e.id),
  );
  const candidates = existing.filter((e) => !accountedFor.has(e.id));

  const overlaps: SourceRowOverlap[] = [];
  for (const { accountId, tx } of rows) {
    if (existing.some((e) => exact(e, accountId, tx))) continue;
    const describe = (e: ExistingRow, reason: SourceRowOverlap["reason"]) =>
      overlaps.push({
        rowNumber: tx.sourceRowNumber!,
        reason,
        existing: {
          accountName: e.account_name,
          date: e.transaction_date,
          amount: Number(e.amount),
          payee: e.payee_name ?? "",
        },
      });
    const elsewhere = candidates.find(
      (e) =>
        e.account_id !== accountId &&
        e.transaction_date === tx.date &&
        units(e.amount) === units(tx.amount),
    );
    if (elsewhere) {
      describe(elsewhere, "otherAccount");
      continue;
    }
    const edited = candidates.find(
      (e) =>
        e.account_id === accountId &&
        e.transaction_date === tx.date &&
        norm(e.payee_name) === norm(tx.payee) &&
        norm(tx.payee) !== "" &&
        units(e.amount) !== units(tx.amount),
    );
    if (edited) describe(edited, "changedAmount");
  }
  return overlaps;
}
