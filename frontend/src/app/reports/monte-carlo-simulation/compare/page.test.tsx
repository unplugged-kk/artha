import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import CompareScenariosPage from './page';

let mockIdsParam: string | null = 'id1,id2';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/reports/monte-carlo-simulation/compare',
  useSearchParams: () => ({ get: (key: string) => key === 'ids' ? mockIdsParam : null }),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector?: any) => {
      const state = {
        user: { id: 'u1', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'user', hasPassword: true },
        isAuthenticated: true,
        isLoading: false,
        _hasHydrated: true,
        logout: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
    { getState: vi.fn(() => ({ isAuthenticated: true, _hasHydrated: true })) },
  ),
}));

vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: (selector?: any) => {
    const state = { preferences: { twoFactorEnabled: false, theme: 'system' }, isLoaded: true, _hasHydrated: true };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/lib/auth', () => ({
  authApi: {
    getAuthMethods: vi.fn().mockResolvedValue({ local: true, oidc: false, registration: true, smtp: false, force2fa: false, demo: false }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/components/layout/AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header">AppHeader</div>,
}));

vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: any) => <div data-testid="page-layout">{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle, actions }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {actions}
    </div>
  ),
}));

vi.mock('@/components/reports/monte-carlo/CompareScenariosView', () => ({
  CompareScenariosView: ({ ids }: any) => (
    <div data-testid="compare-scenarios-view" data-ids={ids.join(',')}>CompareScenariosView</div>
  ),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

describe('CompareScenariosPage', () => {
  it('renders the page heading', async () => {
    render(<CompareScenariosPage />);
    await waitFor(() => {
      expect(screen.getByText('Compare Monte Carlo Scenarios')).toBeInTheDocument();
    });
  });

  it('renders the CompareScenariosView component', async () => {
    render(<CompareScenariosPage />);
    await waitFor(() => {
      expect(screen.getByTestId('compare-scenarios-view')).toBeInTheDocument();
    });
  });

  it('passes parsed ids to CompareScenariosView', async () => {
    render(<CompareScenariosPage />);
    await waitFor(() => {
      const view = screen.getByTestId('compare-scenarios-view');
      expect(view.getAttribute('data-ids')).toBe('id1,id2');
    });
  });

  it('renders Back to Monte Carlo button', async () => {
    render(<CompareScenariosPage />);
    await waitFor(() => {
      expect(screen.getByText('Back to Monte Carlo')).toBeInTheDocument();
    });
  });

  it('passes empty ids array when ids param is null', async () => {
    mockIdsParam = null;
    render(<CompareScenariosPage />);
    await waitFor(() => {
      const view = screen.getByTestId('compare-scenarios-view');
      expect(view.getAttribute('data-ids')).toBe('');
    });
  });
});
