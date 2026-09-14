import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, any>) => {
    if (params) {
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      );
    }
    return key;
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

    expect(screen.getByLabelText(/smsIntake.messageLabel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /smsIntake.parseButton/i })).toBeInTheDocument();
  });

  it('parses valid SMS and displays parsed candidate transaction', async () => {
    vi.mocked(smsIntakeApi.parse).mockResolvedValueOnce({
      status: 'PARSED',
      confidence: 0.95,
      detectedBank: 'HDFC Bank',
      rawMessage: 'Rs 1250 debited for Swiggy UPI',
      parsedTransaction: {
        amount: 1250,
        type: 'EXPENSE',
        date: '2026-09-14',
        merchant: 'Swiggy',
        paymentRail: 'UPI',
        upiRefNumber: '425812345678',
        accountNumberMask: '**1234',
      },
    });

    render(<SmsIntakeStep accounts={mockAccounts} />);

    const textarea = screen.getByLabelText(/smsIntake.messageLabel/i);
    fireEvent.change(textarea, { target: { value: 'Rs 1250 debited for Swiggy UPI' } });

    const parseBtn = screen.getByRole('button', { name: /smsIntake.parseButton/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(smsIntakeApi.parse).toHaveBeenCalledWith({
        message: 'Rs 1250 debited for Swiggy UPI',
        senderHeader: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Swiggy')).toBeInTheDocument();
      expect(screen.getByText('₹1250.00')).toBeInTheDocument();
      expect(screen.getByText('HDFC Bank')).toBeInTheDocument();
      expect(screen.getByText('UPI')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /smsIntake.importButton/i })).toBeInTheDocument();
  });

  it('imports candidate transaction into ledger', async () => {
    vi.mocked(smsIntakeApi.parse).mockResolvedValueOnce({
      status: 'PARSED',
      confidence: 0.95,
      detectedBank: 'HDFC Bank',
      rawMessage: 'Rs 1250 debited',
      parsedTransaction: {
        amount: 1250,
        type: 'EXPENSE',
        date: '2026-09-14',
        merchant: 'Swiggy',
        paymentRail: 'UPI',
      },
    });

    vi.mocked(smsIntakeApi.import).mockResolvedValueOnce({
      status: 'IMPORTED',
      transactionId: 'tx-123',
      message: 'Transaction successfully imported',
    });

    render(<SmsIntakeStep accounts={mockAccounts} />);

    const textarea = screen.getByLabelText(/smsIntake.messageLabel/i);
    fireEvent.change(textarea, { target: { value: 'Rs 1250 debited' } });

    fireEvent.click(screen.getByRole('button', { name: /smsIntake.parseButton/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /smsIntake.importButton/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /smsIntake.importButton/i }));

    await waitFor(() => {
      expect(smsIntakeApi.import).toHaveBeenCalledWith({
        message: 'Rs 1250 debited',
        senderHeader: undefined,
        accountId: 'acc-1',
        categoryId: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Transaction successfully imported/i)).toBeInTheDocument();
    });
  });
});
