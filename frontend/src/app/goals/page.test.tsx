import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import GoalsPage from './page';
import { goalsApi } from '@/lib/goals';
import { accountsApi } from '@/lib/accounts';
import { Goal, GoalsSummary } from '@/types/goal';

vi.mock('@/lib/goals', () => ({
  goalsApi: {
    getAll: vi.fn(),
    getSummary: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    linkTransaction: vi.fn(),
    unlinkTransaction: vi.fn(),
    getTransactions: vi.fn(),
  },
}));

vi.mock('@/lib/accounts', () => ({
  accountsApi: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('GoalsPage', () => {
  const mockSummary: GoalsSummary = {
    totalGoals: 2,
    activeGoals: 1,
    completedGoals: 1,
    totalTargetAmount: 15000,
    totalCurrentAmount: 11000,
    emergencyFundsCount: 1,
  };

  const mockGoals: Goal[] = [
    {
      id: 'goal-1',
      userId: 'user-1',
      name: 'Emergency Fund',
      description: '6 months buffer',
      type: 'EMERGENCY_FUND',
      status: 'ACTIVE',
      targetMode: 'MONTHS_OF_EXPENSES',
      targetAmount: 10000,
      targetMonths: 6,
      currency: 'USD',
      targetDate: null,
      accountId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      progress: {
        currentAmount: 6000,
        targetAmount: 10000,
        percentage: 60,
        remainingAmount: 4000,
        monthsRemaining: null,
        requiredMonthlyContribution: null,
        contributionStatus: 'ON_TRACK',
        baselineMonthlyExpense: 1666.67,
      },
    },
    {
      id: 'goal-2',
      userId: 'user-1',
      name: 'Japan Vacation',
      description: 'Tokyo trip',
      type: 'REGULAR',
      status: 'COMPLETED',
      targetMode: 'FIXED_AMOUNT',
      targetAmount: 5000,
      targetMonths: null,
      currency: 'USD',
      targetDate: '2026-10-31',
      accountId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      progress: {
        currentAmount: 5000,
        targetAmount: 5000,
        percentage: 100,
        remainingAmount: 0,
        monthsRemaining: 1,
        requiredMonthlyContribution: 0,
        contributionStatus: 'COMPLETED',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(goalsApi.getAll).mockResolvedValue(mockGoals);
    vi.mocked(goalsApi.getSummary).mockResolvedValue(mockSummary);
    vi.mocked(accountsApi.getAll).mockResolvedValue([]);
  });

  it('renders goals page with summary cards and goals list', async () => {
    render(<GoalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Financial Goals & Emergency Funds')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Emergency Fund' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Japan Vacation' })).toBeInTheDocument();
    expect(screen.getByText('Total Goals')).toBeInTheDocument();
  });

  it('filters goals when clicking status filters', async () => {
    render(<GoalsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Emergency Fund' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Japan Vacation' })).toBeInTheDocument();
    });

    // Click 'Completed' filter
    const completedTab = screen.getAllByRole('button', { name: 'Completed' })[0];
    fireEvent.click(completedTab);

    // Japan Vacation is completed, Emergency Fund is active
    expect(screen.getByRole('heading', { name: 'Japan Vacation' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Emergency Fund' })).not.toBeInTheDocument();
  });

  it('opens new goal modal when clicking New Goal button', async () => {
    render(<GoalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Financial Goals & Emergency Funds')).toBeInTheDocument();
    });

    const newGoalBtn = screen.getAllByRole('button', { name: /New Goal/i })[0];
    fireEvent.click(newGoalBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\., Emergency Fund/)).toBeInTheDocument();
    });
  });
});
