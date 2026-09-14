import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/render';
import { BudgetToleranceIndicator } from './BudgetToleranceIndicator';

describe('BudgetToleranceIndicator', () => {
  it('renders "On target" badge for UNDER_BUDGET status', () => {
    render(<BudgetToleranceIndicator status="UNDER_BUDGET" varianceRatio={-0.1} />);

    expect(screen.getByText('On target')).toBeInTheDocument();
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'Under budget');
  });

  it('renders "Within 5% tolerance" badge with variance percentage for WITHIN_TOLERANCE', () => {
    render(<BudgetToleranceIndicator status="WITHIN_TOLERANCE" varianceRatio={0.03} />);

    expect(screen.getByText('Within 5% tolerance')).toBeInTheDocument();
    expect(screen.getByText('(+3%)')).toBeInTheDocument();
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'Within 5% tolerance');
  });

  it('renders "Over tolerance" badge with variance percentage for OVER_TOLERANCE', () => {
    render(<BudgetToleranceIndicator status="OVER_TOLERANCE" varianceRatio={0.12} />);

    expect(screen.getByText('Over tolerance')).toBeInTheDocument();
    expect(screen.getByText('(+12%)')).toBeInTheDocument();
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'Over tolerance');
  });

  it('renders "N/A" badge for NOT_APPLICABLE or zero-budget', () => {
    render(<BudgetToleranceIndicator status="NOT_APPLICABLE" varianceRatio={null} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'N/A');
  });

  it('preserves accessible text not relying solely on color', () => {
    const { container } = render(
      <BudgetToleranceIndicator status="WITHIN_TOLERANCE" varianceRatio={0.05} />,
    );

    const badge = container.querySelector('[role="status"]');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toContain('Within 5% tolerance');
    expect(badge?.textContent).toContain('(+5%)');
  });
});
