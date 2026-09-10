import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@/test/render';
import CustomReportsPage from './page';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  usePathname: () => '/reports/custom',
  useSearchParams: () => ({ get: () => null }),
}));

describe('CustomReportsPage', () => {
  it('redirects to /reports on mount', async () => {
    render(<CustomReportsPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/reports');
    });
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(<CustomReportsPage />);
    expect(container.firstChild).toBeNull();
  });
});
