import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/render';
import InsightsPage from './page';

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector?: any) => {
      const state = {
        user: { id: 'test-user-id', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'user', hasPassword: true },
        isAuthenticated: true,
        isLoading: false,
        _hasHydrated: true,
        logout: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
    {
      getState: vi.fn(() => ({
        user: { id: 'test-user-id', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'user', hasPassword: true },
        isAuthenticated: true,
        isLoading: false,
        _hasHydrated: true,
      })),
    },
  ),
}));

vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: (selector?: any) => {
    const state = {
      preferences: { twoFactorEnabled: false, theme: 'system', defaultCurrency: 'USD' },
      isLoaded: true,
      _hasHydrated: true,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/lib/auth', () => ({
  authApi: {
    getAuthMethods: vi.fn().mockResolvedValue({
      local: true, oidc: false, registration: true, smtp: false, force2fa: false, demo: false,
    }),
  },
}));

vi.mock('@/components/insights/InsightsList', () => ({
  InsightsList: () => <div data-testid="insights-list">InsightsList</div>,
}));

vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="page-layout">{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

describe('InsightsPage', () => {
  it('renders the page heading', () => {
    render(<InsightsPage />);
    expect(screen.getByText('Spending Insights')).toBeInTheDocument();
  });

  it('renders the page subtitle', () => {
    render(<InsightsPage />);
    expect(screen.getByText(/AI-powered analysis/i)).toBeInTheDocument();
  });

  it('renders the InsightsList component', () => {
    render(<InsightsPage />);
    expect(screen.getByTestId('insights-list')).toBeInTheDocument();
  });

  it('renders within page layout', () => {
    render(<InsightsPage />);
    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
  });
});
