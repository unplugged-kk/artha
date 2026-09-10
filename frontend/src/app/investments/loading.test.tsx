import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/render';
import InvestmentsLoading from './loading';

vi.mock('@/components/ui/LoadingSkeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
  ChartSkeleton: () => <div data-testid="chart-skeleton" />,
  PageHeaderSkeleton: () => <div data-testid="page-header-skeleton" />,
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}));

describe('InvestmentsLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<InvestmentsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders page header skeleton', () => {
    const { getByTestId } = render(<InvestmentsLoading />);
    expect(getByTestId('page-header-skeleton')).toBeInTheDocument();
  });

  it('renders card skeletons', () => {
    const { getAllByTestId } = render(<InvestmentsLoading />);
    expect(getAllByTestId('card-skeleton').length).toBeGreaterThan(0);
  });

  it('renders chart skeleton', () => {
    const { getByTestId } = render(<InvestmentsLoading />);
    expect(getByTestId('chart-skeleton')).toBeInTheDocument();
  });
});
