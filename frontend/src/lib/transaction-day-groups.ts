import { Transaction, TransactionStatus } from '@/types/transaction';

/**
 * Day grouping for the register.
 *
 * The subtotal is presentation arithmetic: it is derived from rows the user can
 * already see and never feeds valuation, balances or reporting. Sums are
 * accumulated as scaled integers and divided once at the end, which is the same
 * convention the running-balance column uses, so a day of many rows cannot
 * drift the way repeated float addition would.
 */
const SCALE = 10000;

const DAY_MS = 86_400_000;

export type DayLabelKey = 'today' | 'yesterday';

export interface TransactionDayGroup {
  /** The group's date, `YYYY-MM-DD` -- the stored transaction date, unmodified. */
  date: string;
  /** A relative name for the date, or null when neither applies. */
  label: DayLabelKey | null;
  transactions: Transaction[];
  /**
   * The day's income and expense, or **null** when there is no single total to
   * state: either the day's rows are not all in one currency -- and two
   * currencies cannot be added without an FX rate -- or no row on the day counts
   * toward income or expense at all (a day of nothing but transfers). Both cases
   * report no total rather than a fabricated or misleading one.
   */
  income: number | null;
  expense: number | null;
  /** The single currency the totals are expressed in, or null when there is no total. */
  currencyCode: string | null;
}

/**
 * Names a date relative to today, using only the date strings.
 *
 * Both are `YYYY-MM-DD`, so the comparison is a string equality for today and
 * exact UTC day arithmetic for yesterday -- no local parsing, and therefore no
 * timezone or daylight-saving edge that could call yesterday "two days ago".
 */
export function dayLabelKey(date: string, today: string): DayLabelKey | null {
  if (date === today) return 'today';
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(todayMs) || Number.isNaN(dateMs)) return null;
  return todayMs - dateMs === DAY_MS ? 'yesterday' : null;
}

/**
 * Whether a row counts toward its day's income/expense subtotal.
 *
 * Three exclusions, each for its own reason:
 *
 * - **VOID** rows moved no money, so counting them would invent a day that the
 *   ledger deliberately says did not happen.
 * - **Split children** are already represented by their parent's amount;
 *   counting both would double the day.
 * - **Transfers** are not income or expense. A transfer between the user's own
 *   accounts would otherwise appear as both, inflating each side by the same
 *   amount while the user's position is unchanged. This matches the reporting
 *   convention, which excludes transfers unless explicitly asked for them.
 */
export function contributesToDayTotals(transaction: Transaction): boolean {
  return (
    transaction.status !== TransactionStatus.VOID &&
    !transaction.parentTransactionId &&
    !transaction.isTransfer
  );
}

/**
 * Groups a register page into its days, preserving the order it was given (the
 * query already sorts by date, so the groups come out newest-first).
 *
 * `amountOf` lets the caller supply the amount the row actually displays: a
 * split parent whose visible splits were narrowed by a filter shows the filtered
 * total, and the subtotal has to agree with the number beside it.
 */
export function groupTransactionsByDay(
  transactions: Transaction[],
  today: string,
  amountOf: (transaction: Transaction) => number = (transaction) =>
    Number(transaction.amount),
): TransactionDayGroup[] {
  const groups: TransactionDayGroup[] = [];
  const byDate = new Map<string, TransactionDayGroup>();
  const totals = new Map<
    string,
    { income: number; expense: number; currencies: Set<string> }
  >();

  for (const transaction of transactions) {
    const date = transaction.transactionDate;
    let group = byDate.get(date);
    if (!group) {
      group = {
        date,
        label: dayLabelKey(date, today),
        transactions: [],
        income: null,
        expense: null,
        currencyCode: null,
      };
      byDate.set(date, group);
      totals.set(date, { income: 0, expense: 0, currencies: new Set() });
      groups.push(group);
    }
    group.transactions.push(transaction);

    if (!contributesToDayTotals(transaction)) continue;
    const amount = amountOf(transaction);
    if (!Number.isFinite(amount)) continue;
    const dayTotals = totals.get(date)!;
    dayTotals.currencies.add(transaction.currencyCode || '');
    const cents = Math.round(amount * SCALE);
    if (cents >= 0) dayTotals.income += cents;
    else dayTotals.expense += -cents;
  }

  for (const group of groups) {
    const dayTotals = totals.get(group.date)!;
    if (dayTotals.currencies.size !== 1) continue;
    group.currencyCode = [...dayTotals.currencies][0];
    group.income = dayTotals.income / SCALE;
    group.expense = dayTotals.expense / SCALE;
  }

  return groups;
}
