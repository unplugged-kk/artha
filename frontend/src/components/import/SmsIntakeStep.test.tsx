import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { SmsIntakeStep } from './SmsIntakeStep';
import { smsIntakeApi } from '@/lib/sms-intake';
import { Account, AccountType } from '@/types/account';

vi.mock('@/lib/sms-intake', () => ({
  smsIntakeApi: {
    parse: vi.fn(),
    import: vi.fn(),
    getKnownSenders: vi.fn(),
  },
}));

vi.mock('@/hooks/useNumberFormat', () => ({
  useNumberFormat: () => ({
    formatCurrency: (amount: number, _currency: string) => `₹${amount.toFixed(2)}`,
  }),
}));

const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'HDFC Bank **1234',
    accountType: 'CHEQUING' as AccountType,
    currencyCode: 'INR',
    currentBalance: 50000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Account,
];

describe('SmsIntakeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input fields and parse button', () => {
    render(<SmsIntakeStep accounts={mockAccounts} />);

    expect(screen.getByLabelText(/SMS Message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parse SMS/i })).toBeInTheDocument();
  });

  it('parses valid SMS and displays parsed candidate transaction', async () => {
    // The payload the API really sends (`ParsedSmsResponseDto`), so this spec
    // fails if the frontend and backend contracts drift apart again.
    vi.mocked(smsIntakeApi.parse).mockResolvedValueOnce({
      status: 'parsed',
      candidate: {
        date: '2026-09-14',
        amount: -1250,
        type: 'debit',
        payee: 'Swiggy',
        paymentMethod: 'UPI',
        upiReference: '425812345678',
        accountMask: '1234',
        bankName: 'HDFC Bank',
      },
    });

    render(<SmsIntakeStep accounts={mockAccounts} />);

    const textarea = screen.getByLabelText(/SMS Message/i);
    fireEvent.change(textarea, { target: { value: 'Rs 1250 debited for Swiggy UPI' } });

    const parseBtn = screen.getByRole('button', { name: /Parse SMS/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(smsIntakeApi.parse).toHaveBeenCalledWith({
        message: 'Rs 1250 debited for Swiggy UPI',
        sender: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Swiggy')).toBeInTheDocument();
      expect(screen.getByText('₹1250.00')).toBeInTheDocument();
      expect(screen.getByText('HDFC Bank')).toBeInTheDocument();
      expect(screen.getByText('UPI')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Import Transaction/i })).toBeInTheDocument();
  });

  it('imports candidate transaction into ledger', async () => {
    vi.mocked(smsIntakeApi.parse).mockResolvedValueOnce({
      status: 'parsed',
      candidate: {
        date: '2026-09-14',
        amount: -1250,
        type: 'debit',
        payee: 'Swiggy',
        paymentMethod: 'UPI',
        bankName: 'HDFC Bank',
      },
    });

    vi.mocked(smsIntakeApi.import).mockResolvedValueOnce({
      status: 'imported',
      transactionId: 'tx-123',
    });

    render(<SmsIntakeStep accounts={mockAccounts} />);

    const textarea = screen.getByLabelText(/SMS Message/i);
    fireEvent.change(textarea, { target: { value: 'Rs 1250 debited' } });

    fireEvent.click(screen.getByRole('button', { name: /Parse SMS/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Import Transaction/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Import Transaction/i }));

    await waitFor(() => {
      expect(smsIntakeApi.import).toHaveBeenCalledWith({
        message: 'Rs 1250 debited',
        sender: undefined,
        accountId: 'acc-1',
        categoryId: undefined,
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Transaction imported successfully into/i),
      ).toBeInTheDocument();
    });
  });
});
