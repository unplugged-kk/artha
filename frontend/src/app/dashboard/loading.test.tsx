import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/render';
import DashboardLoading from './loading';

vi.mock('@/components/ui/LoadingSkeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
  ChartSkeleton: () => <div data-testid="chart-skeleton" />,
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}));

describe('DashboardLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<DashboardLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders skeleton elements', () => {
    const { getAllByTestId } = render(<DashboardLoading />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders card skeletons', () => {
    const { getAllByTestId } = render(<DashboardLoading />);
    expect(getAllByTestId('card-skeleton').length).toBeGreaterThan(0);
  });

  it('renders chart skeletons', () => {
    const { getAllByTestId } = render(<DashboardLoading />);
    expect(getAllByTestId('chart-skeleton').length).toBeGreaterThan(0);
  });
});
