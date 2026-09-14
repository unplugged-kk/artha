import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { RuleTestModal } from './RuleTestModal';
import { TransactionRule } from '@/types/rule';
import { rulesApi } from '@/lib/rules';

vi.mock('@/lib/rules', () => ({
  rulesApi: {
    test: vi.fn(),
  },
}));

const mockRule: TransactionRule = {
  id: 'rule-1',
  userId: 'u1',
  name: 'Uber rule',
  priority: 1,
  isActive: true,
  matchMode: 'ALL',
  conditions: [{ field: 'payee', operator: 'CONTAINS', value: 'Uber' }],
  actions: { setCategoryId: 'cat-1' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('RuleTestModal', () => {
  it('renders modal and tests candidate transaction', async () => {
    vi.mocked(rulesApi.test).mockResolvedValueOnce({
      candidateMatch: {
        matches: true,
        actions: { setCategoryId: 'cat-1' },
      },
      details: [{ field: 'payee', operator: 'CONTAINS', matched: true }],
    });

    const onClose = vi.fn();
    render(<RuleTestModal rule={mockRule} isOpen={true} onClose={onClose} />);

    expect(screen.getByText(/test rule:/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. swiggy bangalore/i), {
      target: { value: 'Uber Trips' },
    });

    fireEvent.click(screen.getByRole('button', { name: /evaluate sample/i }));

    await waitFor(() => {
      expect(rulesApi.test).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: 'rule-1',
          candidate: expect.objectContaining({ payee: 'Uber Trips' }),
        })
      );
    });

    expect(await screen.findByText(/candidate matches this rule/i)).toBeInTheDocument();
  });
});
