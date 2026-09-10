import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/render';
import SettingsLoading from './loading';

vi.mock('@/components/ui/LoadingSkeleton', () => ({
  PageHeaderSkeleton: () => <div data-testid="page-header-skeleton" />,
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe('SettingsLoading', () => {
  it('renders without crashing', () => {
    const { container } = render(<SettingsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders page header skeleton', () => {
    const { getByTestId } = render(<SettingsLoading />);
    expect(getByTestId('page-header-skeleton')).toBeInTheDocument();
  });

  it('renders skeleton form fields', () => {
    const { getAllByTestId } = render(<SettingsLoading />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});
