import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { BudgetBucketSummary } from './BudgetBucketSummary';
import type { BudgetBucketSummaryItem } from '@/types/budget';

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

const sampleBucketSummary: BudgetBucketSummaryItem[] = [
  {
    bucket: 'NEEDS',
    budgeted: 2000,
    spent: 1900,
    remaining: 100,
    percentUsed: 95,
    varianceRatio: -0.05,
    toleranceStatus: 'UNDER_BUDGET',
    categoryCount: 4,
  },
  {
    bucket: 'WANTS',
    budgeted: 1000,
    spent: 1030,
    remaining: -30,
    percentUsed: 103,
    varianceRatio: 0.03,
    toleranceStatus: 'WITHIN_TOLERANCE',
    categoryCount: 2,
  },
  {
    bucket: 'SAVINGS_INVESTMENTS',
    budgeted: 1500,
    spent: 1500,
    remaining: 0,
    percentUsed: 100,
    varianceRatio: 0,
    toleranceStatus: 'UNDER_BUDGET',
    categoryCount: 1,
  },
  {
    bucket: 'DEBT_SERVICING',
    budgeted: 800,
    spent: 900,
    remaining: -100,
    percentUsed: 112.5,
    varianceRatio: 0.125,
    toleranceStatus: 'OVER_TOLERANCE',
    categoryCount: 1,
  },
  {
    bucket: 'UNCLASSIFIED',
    budgeted: 100,
    spent: 50,
    remaining: 50,
    percentUsed: 50,
    varianceRatio: -0.5,
    toleranceStatus: 'UNDER_BUDGET',
    categoryCount: 1,
  },
];

describe('BudgetBucketSummary', () => {
  it('renders all four bucket headers and labels', () => {
    render(
      <BudgetBucketSummary
        bucketSummary={sampleBucketSummary}
        formatCurrency={formatCurrency}
      />,
    );

    expect(screen.getByText('Four-Bucket Overview')).toBeInTheDocument();
    expect(screen.getByText('Needs')).toBeInTheDocument();
    expect(screen.getByText('Wants')).toBeInTheDocument();
    expect(screen.getByText('Savings / Investments')).toBeInTheDocument();
    expect(screen.getByText('Debt Servicing')).toBeInTheDocument();
    expect(screen.getByText('Unclassified')).toBeInTheDocument();
  });

  it('renders budget vs actual amounts for each bucket', () => {
    render(
      <BudgetBucketSummary
        bucketSummary={sampleBucketSummary}
        formatCurrency={formatCurrency}
      />,
    );

    // Needs: spent $1900.00 / budgeted $2000.00
    expect(screen.getByText('$1900.00')).toBeInTheDocument();
    expect(screen.getByText('/ $2000.00')).toBeInTheDocument();

    // Wants: spent $1030.00 / budgeted $1000.00
    expect(screen.getByText('$1030.00')).toBeInTheDocument();
    expect(screen.getByText('/ $1000.00')).toBeInTheDocument();
  });

  it('renders tolerance indicators for buckets', () => {
    render(
      <BudgetBucketSummary
        bucketSummary={sampleBucketSummary}
        formatCurrency={formatCurrency}
      />,
    );

    expect(screen.getByText('Within 5% tolerance')).toBeInTheDocument();
    expect(screen.getByText('Over tolerance')).toBeInTheDocument();
  });

  it('allows clicking a bucket to trigger onSelectBucket', () => {
    const onSelectBucket = vi.fn();
    render(
      <BudgetBucketSummary
        bucketSummary={sampleBucketSummary}
        formatCurrency={formatCurrency}
        selectedBucket={null}
        onSelectBucket={onSelectBucket}
      />,
    );

    const wantsCard = screen.getByText('Wants').closest('button');
    expect(wantsCard).toBeInTheDocument();
    fireEvent.click(wantsCard!);

    expect(onSelectBucket).toHaveBeenCalledWith('WANTS');
  });

  it('hides empty unclassified bucket when it has 0 categories and 0 amounts', () => {
    const summaryWithoutUnclassified = sampleBucketSummary.filter(
      (b) => b.bucket !== 'UNCLASSIFIED',
    );
    summaryWithoutUnclassified.push({
      bucket: 'UNCLASSIFIED',
      budgeted: 0,
      spent: 0,
      remaining: 0,
      percentUsed: 0,
      varianceRatio: null,
      toleranceStatus: 'NOT_APPLICABLE',
      categoryCount: 0,
    });

    render(
      <BudgetBucketSummary
        bucketSummary={summaryWithoutUnclassified}
        formatCurrency={formatCurrency}
      />,
    );

    expect(screen.queryByText('Unclassified')).not.toBeInTheDocument();
  });

  it('renders nothing when bucketSummary is empty or undefined', () => {
    const { container } = render(
      <BudgetBucketSummary bucketSummary={[]} formatCurrency={formatCurrency} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
