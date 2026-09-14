import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import RulesPage from './page';
import { rulesApi } from '@/lib/rules';
import { categoriesApi } from '@/lib/categories';
import { TransactionRule } from '@/types/rule';

// Mock ProtectedRoute
vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock APIs
vi.mock('@/lib/rules', () => ({
  rulesApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    test: vi.fn(),
    apply: vi.fn(),
  },
}));

vi.mock('@/lib/categories', () => ({
  categoriesApi: {
    getAll: vi.fn(),
  },
}));

const mockRules: TransactionRule[] = [
  {
    id: 'rule-1',
    userId: 'u1',
    name: 'Uber rule',
    priority: 1,
    isActive: true,
    matchMode: 'ALL',
    conditions: [{ field: 'payee', operator: 'CONTAINS', value: 'Uber' }],
    actions: { setCategoryId: 'cat-1', stopProcessing: true },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockCategories = [
  { id: 'cat-1', name: 'Transport' },
];

describe('RulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rulesApi.getAll).mockResolvedValue(mockRules);
    vi.mocked(categoriesApi.getAll).mockResolvedValue(mockCategories as any);
  });

  it('loads and renders rules and summary metrics', async () => {
    render(<RulesPage />);

    expect(await screen.findByText('Transaction Rules')).toBeInTheDocument();
    expect(screen.getByText('Uber rule')).toBeInTheDocument();
    expect(screen.getByText('Total Rules')).toBeInTheDocument();
  });

  it('opens add rule modal and displays form', async () => {
    render(<RulesPage />);

    expect(await screen.findByText('Transaction Rules')).toBeInTheDocument();

    // Click New Rule button
    const newRuleBtn = screen.getByRole('button', { name: /new rule/i });
    fireEvent.click(newRuleBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: /new rule/i })).toBeInTheDocument();
  });

  it('opens apply rules modal', async () => {
    render(<RulesPage />);

    expect(await screen.findByText('Transaction Rules')).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /apply rules/i });
    fireEvent.click(applyBtn);

    expect(screen.getByRole('heading', { name: /apply rules to transactions/i })).toBeInTheDocument();
  });
});
