import { describe, it, expect } from 'vitest';
import { Transaction, TransactionStatus } from '@/types/transaction';
import {
  contributesToDayTotals,
  dayLabelKey,
  groupTransactionsByDay,
} from './transaction-day-groups';

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    account: null,
    transactionDate: '2026-09-11',
    payeeId: null,
    payeeName: null,
    payee: null,
    categoryId: null,
    category: null,
    amount: -10,
    currencyCode: 'INR',
    exchangeRate: 1,
    originalAmount: null,
    originalCurrencyCode: null,
    description: null,
    referenceNumber: null,
    status: TransactionStatus.UNRECONCILED,
    isCleared: false,
    isReconciled: false,
    isVoid: false,
    reconciledDate: null,
    isSplit: false,
    parentTransactionId: null,
    isTransfer: false,
    linkedTransactionId: null,
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
    ...overrides,
  };
}

const TODAY = '2026-09-11';

describe('dayLabelKey', () => {
  it('names today and yesterday', () => {
    expect(dayLabelKey('2026-09-11', TODAY)).toBe('today');
    expect(dayLabelKey('2026-09-10', TODAY)).toBe('yesterday');
  });

  it('names no other day', () => {
    expect(dayLabelKey('2026-09-09', TODAY)).toBeNull();
    expect(dayLabelKey('2026-09-12', TODAY)).toBeNull();
  });

  it('crosses a month and a year boundary', () => {
    expect(dayLabelKey('2026-08-31', '2026-09-01')).toBe('yesterday');
    expect(dayLabelKey('2025-12-31', '2026-01-01')).toBe('yesterday');
  });

  it('answers null rather than guessing on a malformed date', () => {
    expect(dayLabelKey('not-a-date', TODAY)).toBeNull();
    expect(dayLabelKey('2026-09-10', 'nonsense')).toBeNull();
  });
});

describe('contributesToDayTotals', () => {
  it('counts an ordinary row', () => {
    expect(contributesToDayTotals(createTransaction())).toBe(true);
  });

  it('excludes a voided row, a split child and a transfer', () => {
    expect(
      contributesToDayTotals(
        createTransaction({ status: TransactionStatus.VOID }),
      ),
    ).toBe(false);
    expect(
      contributesToDayTotals(createTransaction({ parentTransactionId: 'p-1' })),
    ).toBe(false);
    expect(
      contributesToDayTotals(createTransaction({ isTransfer: true })),
    ).toBe(false);
  });
});

describe('groupTransactionsByDay', () => {
  it('returns nothing for no rows', () => {
    expect(groupTransactionsByDay([], TODAY)).toEqual([]);
  });

  it('groups consecutive rows by date, preserving the given order', () => {
    const groups = groupTransactionsByDay(
      [
        createTransaction({ id: 'a', transactionDate: '2026-09-11' }),
        createTransaction({ id: 'b', transactionDate: '2026-09-11' }),
        createTransaction({ id: 'c', transactionDate: '2026-09-09' }),
      ],
      TODAY,
    );

    expect(groups.map((g) => g.date)).toEqual(['2026-09-11', '2026-09-09']);
    expect(groups[0].transactions.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups[1].transactions.map((t) => t.id)).toEqual(['c']);
    expect(groups[0].label).toBe('today');
    expect(groups[1].label).toBeNull();
  });

  it('separates income from expense by sign', () => {
    const groups = groupTransactionsByDay(
      [
        createTransaction({ id: 'in', amount: 5000 }),
        createTransaction({ id: 'out', amount: -1250.5 }),
      ],
      TODAY,
    );

    expect(groups[0].income).toBe(5000);
    expect(groups[0].expense).toBe(1250.5);
    expect(groups[0].currencyCode).toBe('INR');
  });

  it('sums without float drift across many rows', () => {
    const groups = groupTransactionsByDay(
      Array.from({ length: 3 }, (_, i) =>
        createTransaction({ id: `t${i}`, amount: -33.33 }),
      ),
      TODAY,
    );

    expect(groups[0].expense).toBe(99.99);
  });

  it('leaves voided, split-child and transfer rows out of the totals', () => {
    const groups = groupTransactionsByDay(
      [
        createTransaction({ id: 'kept', amount: -100 }),
        createTransaction({
          id: 'void',
          amount: -900,
          status: TransactionStatus.VOID,
        }),
        createTransaction({ id: 'child', amount: -900, parentTransactionId: 'p' }),
        createTransaction({ id: 'xfer', amount: -900, isTransfer: true }),
      ],
      TODAY,
    );

    expect(groups[0].expense).toBe(100);
    // The rows are still listed -- grouping organizes the register, it does not
    // hide rows from it.
    expect(groups[0].transactions).toHaveLength(4);
  });

  it('withholds a total when the day mixes currencies', () => {
    const groups = groupTransactionsByDay(
      [
        createTransaction({ id: 'inr', amount: -100, currencyCode: 'INR' }),
        createTransaction({ id: 'usd', amount: -100, currencyCode: 'USD' }),
      ],
      TODAY,
    );

    expect(groups[0].expense).toBeNull();
    expect(groups[0].income).toBeNull();
    expect(groups[0].currencyCode).toBeNull();
    expect(groups[0].transactions).toHaveLength(2);
  });

  it('reports a day whose rows all sit outside the totals as having none', () => {
    const groups = groupTransactionsByDay(
      [createTransaction({ id: 'xfer', amount: -900, isTransfer: true })],
      TODAY,
    );

    expect(groups[0].transactions).toHaveLength(1);
    expect(groups[0].income).toBeNull();
    expect(groups[0].expense).toBeNull();
    expect(groups[0].currencyCode).toBeNull();
  });

  it('uses the caller-supplied display amount', () => {
    const groups = groupTransactionsByDay(
      [createTransaction({ id: 'split', amount: -1000 })],
      TODAY,
      () => -250,
    );

    expect(groups[0].expense).toBe(250);
  });

  it('ignores a row whose amount is not a finite number', () => {
    const groups = groupTransactionsByDay(
      [
        createTransaction({ id: 'ok', amount: -10 }),
        createTransaction({ id: 'nan', amount: Number.NaN }),
      ],
      TODAY,
    );

    expect(groups[0].expense).toBe(10);
  });
});
