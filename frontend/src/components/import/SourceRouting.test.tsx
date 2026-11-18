import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { MapSourceAccountsStep } from './MapSourceAccountsStep';
import { SourceReviewStep, plannedAccountChanges } from './SourceReviewStep';
import { initialSourceMappings } from '@/hooks/useImportSourceRouting';
import type { ParsedSourceRow } from '@/lib/import';
import type { Account } from '@/types/account';

const account = (id: string, name: string, extra: Partial<Account> = {}) =>
  ({ id, name, currencyCode: 'INR', isClosed: false, accountSubType: null, ...extra }) as unknown as Account;
const bank = account('bank', 'Test Bank');
const card = account('card', 'Test Card');
const accounts = [bank, card, account('brk', 'Broker', { accountSubType: 'INVESTMENT_BROKERAGE' } as Partial<Account>)];

const row = (rowNumber: number, sourceAccount: string, amount: number, transferAccount = ''): ParsedSourceRow => ({
  rowNumber, date: '2026-11-01', amount, payee: `p${rowNumber}`, sourceAccount,
  isTransfer: !!transferAccount, transferAccount, category: '',
});
// The A1 workbook after the sign rule: expenses negative, card payment a transfer.
const A1 = [row(2, 'Test Bank', -100), row(3, 'Test Card', -40), row(4, 'Test Bank', -40, 'Test Card'), row(5, 'Test Bank', -100)];
const mapped = [{ originalName: 'Test Bank', accountId: 'bank' }, { originalName: 'Test Card', accountId: 'card' }];

describe('source-account routing', () => {
  it('pre-matches only exact account names, never a brokerage, never a blank', () => {
    expect(initialSourceMappings(['test bank ', 'Broker', '', 'Bank + Card'], accounts)).toEqual([
      { originalName: 'test bank ', accountId: 'bank' },
      { originalName: 'Broker' },
      { originalName: '' },
      { originalName: 'Bank + Card' },
    ]);
  });

  it('plans the A1 balance changes: bank -240, card nets to zero', () => {
    const changes = plannedAccountChanges(A1, mapped, {}, [{ originalName: 'Test Card', accountId: 'card' }]);
    expect(Object.fromEntries(changes)).toEqual({ bank: -240, card: 0 });
  });

  it('applies a per-row override and a skip', () => {
    const changes = plannedAccountChanges(A1, mapped, { 5: { rowNumber: 5, skip: true }, 3: { rowNumber: 3, accountId: 'bank' } }, []);
    expect(Object.fromEntries(changes)).toEqual({ bank: -180 });
  });

  it('blocks Next until every source has an account or an explicit skip', () => {
    const onNext = vi.fn();
    render(
      <MapSourceAccountsStep mappings={[mapped[0], { originalName: '' }]} rows={A1} accounts={accounts}
        onChange={vi.fn()} onBack={vi.fn()} onNext={onNext} />,
    );
    expect(screen.getByText('(no source)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('blocks the import while unreadable rows are neither fixed nor skipped', () => {
    const props = {
      fileName: 'tracker.xlsx', rows: A1, rejectedRows: [{ rowNumber: 9, reason: 'missing amount' }],
      accounts, mappings: mapped, overrides: {}, accountMappings: [], skipRejectedRows: false,
      overlaps: { key: 'k', status: 'ready' as const, rows: [] }, acknowledged: [] as number[], onAcknowledge: vi.fn(),
      onOverride: vi.fn(), onSkipRejectedRowsChange: vi.fn(), isLoading: false, onBack: vi.fn(), onImport: vi.fn(),
    };
    const { rerender } = render(<SourceReviewStep {...props} />);
    expect(screen.getByText('Row 9: missing amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Transactions' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.onSkipRejectedRowsChange).toHaveBeenCalledWith(true);
    rerender(<SourceReviewStep {...props} skipRejectedRows />);
    expect(screen.getByRole('button', { name: 'Import Transactions' })).toBeEnabled();
  });

  it('blocks the import until a look-alike row is kept or skipped, and while the check has failed', () => {
    const overlap = {
      rowNumber: 3, reason: 'otherAccount' as const,
      existing: { accountName: 'Test Bank', date: '2026-11-01', amount: -40, payee: 'p3' },
    };
    const props = {
      fileName: 'tracker.xlsx', rows: A1, rejectedRows: [], accounts, mappings: mapped, overrides: {},
      accountMappings: [], skipRejectedRows: false,
      overlaps: { key: 'k', status: 'ready' as const, rows: [overlap] }, acknowledged: [] as number[],
      onAcknowledge: vi.fn(), onOverride: vi.fn(), onSkipRejectedRowsChange: vi.fn(),
      isLoading: false, onBack: vi.fn(), onImport: vi.fn(),
    };
    const { rerender } = render(<SourceReviewStep {...props} />);
    const importButton = () => screen.getByRole('button', { name: 'Import Transactions' });
    expect(screen.getByText(/may have moved to another account/)).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Import row 3 anyway'));
    expect(props.onAcknowledge).toHaveBeenCalledWith(3, true);
    rerender(<SourceReviewStep {...props} acknowledged={[3]} />);
    expect(importButton()).toBeEnabled();
    rerender(<SourceReviewStep {...props} overlaps={{ key: 'k', status: 'failed', rows: [] }} />);
    expect(importButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not check/i);
  });
});
