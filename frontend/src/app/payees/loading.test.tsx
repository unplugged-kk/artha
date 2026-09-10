import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/render';
import PayeesLoading from './loading';

vi.mock('@/components/ui/LoadingSkeleton', () => ({
  PageHeaderSkeleton: () => <div data-testid="page-header-skeleton" />,
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}));

describe('PayeesLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<PayeesLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders page header skeleton', () => {
    const { getByTestId } = render(<PayeesLoading />);
    expect(getByTestId('page-header-skeleton')).toBeInTheDocument();
  });

  it('renders table skeleton', () => {
    const { getByTestId } = render(<PayeesLoading />);
    expect(getByTestId('table-skeleton')).toBeInTheDocument();
  });
});
