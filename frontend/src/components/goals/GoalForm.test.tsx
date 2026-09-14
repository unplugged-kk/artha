import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { GoalForm } from './GoalForm';

describe('GoalForm', () => {
  const mockAccounts = [
    { id: 'acc-1', name: 'Checking', currencyCode: 'USD', currentBalance: 5000 },
    { id: 'acc-2', name: 'Savings', currencyCode: 'USD', currentBalance: 10000 },
  ];

  it('renders form and submits new fixed goal', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <GoalForm
        isOpen={true}
        accounts={mockAccounts}
        defaultCurrency="USD"
        onClose={onClose}
        onSave={onSave}
      />
    );

    expect(screen.getByText('New Goal')).toBeInTheDocument();

    // Fill in name
    const nameInput = screen.getByPlaceholderText(/e\.g\., Emergency Fund/);
    fireEvent.change(nameInput, { target: { value: 'Vacation' } });

    // Fill in target amount
    const targetAmountInput = screen.getByLabelText(/Target Amount/i);
    fireEvent.change(targetAmountInput, { target: { value: '5000' } });

    // Submit
    const saveBtn = screen.getByRole('button', { name: 'Save Goal' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Vacation',
          type: 'REGULAR',
          targetMode: 'FIXED_AMOUNT',
          targetAmount: 5000,
          currency: 'USD',
        }),
      );
    });
  });

  it('allows selecting Emergency Fund with months of expenses mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <GoalForm
        isOpen={true}
        accounts={mockAccounts}
        defaultCurrency="USD"
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    // Change type to Emergency Fund
    const typeSelect = screen.getByDisplayValue('Regular Goal');
    fireEvent.change(typeSelect, { target: { value: 'EMERGENCY_FUND' } });

    // Fill in name
    const nameInput = screen.getByPlaceholderText(/e\.g\., Emergency Fund/);
    fireEvent.change(nameInput, { target: { value: 'Reserve' } });

    // Target months input should be visible with default 6
    const monthsInput = screen.getByPlaceholderText(/e\.g\., 3, 6, 12/);
    expect(monthsInput).toHaveValue('6');
    fireEvent.change(monthsInput, { target: { value: '9' } });

    // Submit
    const saveBtn = screen.getByRole('button', { name: 'Save Goal' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Reserve',
          type: 'EMERGENCY_FUND',
          targetMode: 'MONTHS_OF_EXPENSES',
          targetMonths: 9,
        }),
      );
    });
  });
});
