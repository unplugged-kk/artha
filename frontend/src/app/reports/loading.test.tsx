import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/render';
import ReportsLoading from './loading';

vi.mock('@/components/ui/LoadingSkeleton', () => ({
  ChartSkeleton: () => <div data-testid="chart-skeleton" />,
  PageHeaderSkeleton: () => <div data-testid="page-header-skeleton" />,
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe('ReportsLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<ReportsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders page header skeleton', () => {
    const { getByTestId } = render(<ReportsLoading />);
    expect(getByTestId('page-header-skeleton')).toBeInTheDocument();
  });

  it('renders chart skeleton', () => {
    const { getByTestId } = render(<ReportsLoading />);
    expect(getByTestId('chart-skeleton')).toBeInTheDocument();
  });

  it('renders skeleton elements for report type selection', () => {
    const { getAllByTestId } = render(<ReportsLoading />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});
