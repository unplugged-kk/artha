import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/render';
import { GoalSummaryHeader } from './GoalSummaryHeader';
import { GoalsSummary } from '@/types/goal';

describe('GoalSummaryHeader', () => {
  const mockSummary: GoalsSummary = {
    totalGoals: 5,
    activeGoals: 3,
    completedGoals: 2,
    totalTargetAmount: 25000,
    totalCurrentAmount: 18000,
    emergencyFundsCount: 1,
  };

  it('renders all summary metrics correctly', () => {
    render(
      <GoalSummaryHeader
        summary={mockSummary}
        formatCurrency={(val) => `$${val.toLocaleString()}`}
      />
    );

    expect(screen.getByText('Total Goals')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(screen.getByText('Total Target')).toBeInTheDocument();
    expect(screen.getByText('$25,000')).toBeInTheDocument();

    expect(screen.getByText('Total Saved')).toBeInTheDocument();
    expect(screen.getByText('$18,000')).toBeInTheDocument();
  });
});
