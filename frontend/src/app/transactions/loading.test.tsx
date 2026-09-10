import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/render';
import TransactionsLoading from './loading';

vi.mock('@/components/ui/LoadingSkeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
  FilterBarSkeleton: () => <div data-testid="filter-bar-skeleton" />,
  PageHeaderSkeleton: () => <div data-testid="page-header-skeleton" />,
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}));

describe('TransactionsLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<TransactionsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders page header skeleton', () => {
    const { getByTestId } = render(<TransactionsLoading />);
    expect(getByTestId('page-header-skeleton')).toBeInTheDocument();
  });

  it('renders card skeletons', () => {
    const { getAllByTestId } = render(<TransactionsLoading />);
    expect(getAllByTestId('card-skeleton').length).toBeGreaterThan(0);
  });

  it('renders filter bar skeleton', () => {
    const { getByTestId } = render(<TransactionsLoading />);
    expect(getByTestId('filter-bar-skeleton')).toBeInTheDocument();
  });
});
