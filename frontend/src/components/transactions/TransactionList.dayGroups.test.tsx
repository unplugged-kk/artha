import { describe, it, expect, vi, beforeEach } from 'vitest';
import { within } from '@testing-library/react';
import { render, screen, cleanup } from '@/test/render';
import { TransactionList } from './TransactionList';
import { Transaction, TransactionStatus } from '@/types/transaction';
import { getLocalDateString } from '@/lib/utils';

vi.mock('@/lib/transactions', () => ({
  transactionsApi: {
    delete: vi.fn(),
    deleteTransfer: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('@/hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateFormat: 'browser',
    datePattern: 'YYYY-MM-DD',
    formatDate: (d: string) => d,
    formatDateWithoutYear: (d: Date | string) => String(d).slice(5),
  }),
}));

vi.mock('@/hooks/useNumberFormat', async () => {
  const { numberFormatMockDefaults } = await import('@/test/number-format-mock');
  return {
    useNumberFormat: () => ({
      ...numberFormatMockDefaults(),
      formatCurrency: (n: number) => `$${n.toFixed(2)}`,
    }),
  };
});

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    account: null,
    transactionDate: '2026-09-11',
    payeeId: null,
    payeeName: 'Grocery Store',
    payee: null,
    categoryId: null,
    category: null,
    amount: -50,
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

// Derived from the same helper the component uses, so the relative labels are
// asserted against the real local date rather than a frozen one.
const TODAY = getLocalDateString();
const YESTERDAY = new Date(Date.parse(`${TODAY}T00:00:00Z`) - 86_400_000)
  .toISOString()
  .slice(0, 10);

describe('TransactionList day grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('draws no day headings unless the caller asks for them', () => {
    render(
      <TransactionList
        transactions={[createTransaction({ transactionDate: TODAY })]}
      />,
    );

    expect(screen.queryByTestId(`day-group-${TODAY}`)).toBeNull();
    cleanup();
  });

  it('heads each day, naming today and yesterday', () => {
    render(
      <TransactionList
        groupByDate
        transactions={[
          createTransaction({ id: 'a', transactionDate: TODAY, amount: -50 }),
          createTransaction({ id: 'b', transactionDate: YESTERDAY, amount: -25 }),
        ]}
      />,
    );

    const todayHeader = screen.getByTestId(`day-group-${TODAY}`);
    expect(within(todayHeader).getByText(TODAY)).toBeTruthy();
    expect(todayHeader.textContent).toContain('Today');

    const yesterdayHeader = screen.getByTestId(`day-group-${YESTERDAY}`);
    expect(yesterdayHeader.textContent).toContain('Yesterday');
    cleanup();
  });

  it('carries the day income and expense', () => {
    render(
      <TransactionList
        groupByDate
        transactions={[
          createTransaction({ id: 'in', transactionDate: TODAY, amount: 1000 }),
          createTransaction({ id: 'out', transactionDate: TODAY, amount: -250 }),
        ]}
      />,
    );

    const header = screen.getByTestId(`day-group-${TODAY}`);
    expect(header.textContent).toContain('+$1000.00');
    expect(header.textContent).toContain('-$250.00');
    cleanup();
  });

  it('heads a day once, however many rows share it', () => {
    render(
      <TransactionList
        groupByDate
        transactions={[
          createTransaction({ id: 'a', transactionDate: TODAY }),
          createTransaction({ id: 'b', transactionDate: TODAY }),
          createTransaction({ id: 'c', transactionDate: TODAY }),
        ]}
      />,
    );

    expect(screen.getAllByTestId(`day-group-${TODAY}`)).toHaveLength(1);
    cleanup();
  });

  it('states no total for a day of nothing but transfers', () => {
    render(
      <TransactionList
        groupByDate
        transactions={[
          createTransaction({
            id: 'xfer',
            transactionDate: TODAY,
            amount: -900,
            isTransfer: true,
          }),
        ]}
      />,
    );

    const header = screen.getByTestId(`day-group-${TODAY}`);
    expect(header.textContent).not.toContain('$');
    cleanup();
  });

  it('states no total for a day whose rows are in different currencies', () => {
    render(
      <TransactionList
        groupByDate
        transactions={[
          createTransaction({ id: 'inr', transactionDate: TODAY, amount: -100 }),
          createTransaction({
            id: 'usd',
            transactionDate: TODAY,
            amount: -100,
            currencyCode: 'USD',
          }),
        ]}
      />,
    );

    const header = screen.getByTestId(`day-group-${TODAY}`);
    expect(header.textContent).not.toContain('$');
    cleanup();
  });
});
