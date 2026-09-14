import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { ApplyRulesModal } from './ApplyRulesModal';
import { rulesApi } from '@/lib/rules';

vi.mock('@/lib/rules', () => ({
  rulesApi: {
    apply: vi.fn(),
  },
}));

describe('ApplyRulesModal', () => {
  it('runs preview (dry run) and applies rules', async () => {
    vi.mocked(rulesApi.apply).mockResolvedValueOnce({
      matchedCount: 4,
      updatedCount: 4,
      dryRun: true,
      details: [
        {
          transactionId: 'tx-1',
          ruleId: 'r-1',
          ruleName: 'Swiggy',
          payee: 'Swiggy',
          amount: '-250.00',
          appliedCategoryId: 'cat-food',
        },
      ],
    });

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <ApplyRulesModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText('Apply Rules to Transactions')).toBeInTheDocument();

    // Click preview dry run
    fireEvent.click(screen.getByRole('button', { name: /preview matches/i }));

    await waitFor(() => {
      expect(rulesApi.apply).toHaveBeenCalledWith({
        onlyUncategorized: true,
        dryRun: true,
      });
    });

    expect(await screen.findByText(/preview: 4 transactions would be updated/i)).toBeInTheDocument();
  });
});
