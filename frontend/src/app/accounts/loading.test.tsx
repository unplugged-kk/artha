import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/render';
import AccountsLoading from './loading';

vi.mock('@/components/ui/LoadingSkeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
  PageHeaderSkeleton: () => <div data-testid="page-header-skeleton" />,
  TableSkeleton: ({ rows, columns }: { rows: number; columns: number }) => (
    <div data-testid="table-skeleton" data-rows={rows} data-columns={columns} />
  ),
}));

describe('AccountsLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<AccountsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders page header skeleton', () => {
    const { getAllByTestId } = render(<AccountsLoading />);
    expect(getAllByTestId('page-header-skeleton').length).toBeGreaterThan(0);
  });

  it('renders card skeletons', () => {
    const { getAllByTestId } = render(<AccountsLoading />);
    expect(getAllByTestId('card-skeleton').length).toBeGreaterThan(0);
  });

  it('renders table skeleton', () => {
    const { getByTestId } = render(<AccountsLoading />);
    expect(getByTestId('table-skeleton')).toBeInTheDocument();
  });
});
