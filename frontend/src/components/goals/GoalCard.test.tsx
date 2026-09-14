import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { GoalCard } from './GoalCard';
import { Goal } from '@/types/goal';

describe('GoalCard', () => {
  const mockRegularGoal: Goal = {
    id: 'goal-1',
    userId: 'user-1',
    name: 'New Car',
    description: 'Down payment for a hybrid car',
    type: 'REGULAR',
    status: 'ACTIVE',
    targetMode: 'FIXED_AMOUNT',
    targetAmount: 10000,
    targetMonths: null,
    currency: 'USD',
    targetDate: '2026-12-31',
    accountId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    progress: {
      currentAmount: 4000,
      targetAmount: 10000,
      percentage: 40,
      remainingAmount: 6000,
      monthsRemaining: 3,
      requiredMonthlyContribution: 2000,
      contributionStatus: 'ON_TRACK',
      linkedTransactionCount: 2,
    },
  };

  const mockEmergencyFund: Goal = {
    id: 'goal-2',
    userId: 'user-1',
    name: 'Rainy Day Fund',
    description: '6 months emergency cushion',
    type: 'EMERGENCY_FUND',
    status: 'ACTIVE',
    targetMode: 'MONTHS_OF_EXPENSES',
    targetAmount: 18000,
    targetMonths: 6,
    currency: 'USD',
    targetDate: null,
    accountId: 'acc-1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    progress: {
      currentAmount: 12000,
      targetAmount: 18000,
      percentage: 66.67,
      remainingAmount: 6000,
      monthsRemaining: null,
      requiredMonthlyContribution: null,
      contributionStatus: 'ON_TRACK',
      baselineMonthlyExpense: 3000,
      linkedAccount: {
        id: 'acc-1',
        name: 'High Yield Savings',
        currency: 'USD',
        balance: 12000,
      },
    },
  };

  it('renders regular goal details and progress metrics', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onManage = vi.fn();

    render(
      <GoalCard
        goal={mockRegularGoal}
        formatCurrency={(val) => `$${val.toLocaleString()}`}
        onEdit={onEdit}
        onDelete={onDelete}
        onManageTransactions={onManage}
      />
    );

    expect(screen.getByText('New Car')).toBeInTheDocument();
    expect(screen.getByText('Down payment for a hybrid car')).toBeInTheDocument();
    expect(screen.getByText('$4,000')).toBeInTheDocument();
    expect(screen.getByText(/Target: \$10,000/)).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
    expect(screen.getByText(/Remaining: \$6,000/)).toBeInTheDocument();
    expect(screen.getByText('$2,000/ mo')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();

    // Trigger onEdit
    const editBtn = screen.getByTitle('Save Goal');
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockRegularGoal);

    // Trigger onDelete
    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockRegularGoal);

    // Trigger onManageTransactions
    const manageBtn = screen.getByText('Linked Transactions');
    fireEvent.click(manageBtn);
    expect(onManage).toHaveBeenCalledWith(mockRegularGoal);
  });

  it('renders emergency fund with months of expenses mode and account link', () => {
    render(
      <GoalCard
        goal={mockEmergencyFund}
        formatCurrency={(val) => `$${val.toLocaleString()}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onManageTransactions={vi.fn()}
      />
    );

    expect(screen.getByText('Rainy Day Fund')).toBeInTheDocument();
    expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    expect(
      screen.getByText(/Target dynamically calculated from 6 months of essential needs/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tracking balance of account: High Yield Savings/),
    ).toBeInTheDocument();
  });

  it('displays FX unavailable warning when isFxUnavailable is true', () => {
    const fxGoal: Goal = {
      ...mockEmergencyFund,
      progress: {
        ...mockEmergencyFund.progress,
        isFxUnavailable: true,
      },
    };

    render(
      <GoalCard
        goal={fxGoal}
        formatCurrency={(val) => `$${val.toLocaleString()}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onManageTransactions={vi.fn()}
      />
    );

    expect(
      screen.getByText('Current exchange rate unavailable for currency conversion.'),
    ).toBeInTheDocument();
  });

  it('displays no budget notice when essential expenses baseline is missing', () => {
    const missingBudgetGoal: Goal = {
      ...mockEmergencyFund,
      progress: {
        ...mockEmergencyFund.progress,
        baselineMonthlyExpense: null,
      },
    };

    render(
      <GoalCard
        goal={missingBudgetGoal}
        formatCurrency={(val) => `$${val.toLocaleString()}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onManageTransactions={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Active budget essential expenses data unavailable/),
    ).toBeInTheDocument();
  });
});
