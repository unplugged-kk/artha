import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/render';

vi.mock('@/hooks/useFinancialToday', () => ({ useFinancialToday: () => '2026-11-03' }));
const get = vi.fn();
vi.mock('@/lib/anomalies', () => ({ anomaliesApi: { get: (...a: unknown[]) => get(...a) } }));

import { AttentionList } from './AttentionList';

const report = (over = {}) => ({
  asOf: '2026-11-03',
  spendingSpikes: [],
  subscriptionIncreases: [],
  ...over,
});

beforeEach(() => { get.mockClear(); });

describe('AttentionList', () => {
  it('asks for the user day, not the server clock', async () => {
    get.mockResolvedValue(report());
    render(<AttentionList />);
    await screen.findByText('Nothing stands out right now.');
    expect(get).toHaveBeenCalledWith('2026-11-03');
  });

  it('draws nothing while loading', async () => {
    let finish: (r: ReturnType<typeof report>) => void = () => {};
    get.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { container } = render(<AttentionList />);
    expect(container).toBeEmptyDOMElement();
    finish(report());
    await screen.findByText('Nothing stands out right now.');
  });

  it('says it could not check, instead of claiming all is well, when the lookup fails', async () => {
    get.mockImplementation(() => Promise.reject(new Error('500')));
    render(<AttentionList />);
    await screen.findByText(/Could not check for unusual activity/);
    expect(screen.queryByText('Nothing stands out right now.')).not.toBeInTheDocument();
  });

  it('lists a spike in its own currency and a subscription increase without inventing one', async () => {
    get.mockResolvedValue(
      report({
        spendingSpikes: [
          { categoryId: 'c1', categoryName: 'Dining', currencyCode: 'CAD', current: 420, mean: 200, threshold: 300 },
          { categoryId: null, categoryName: null, currencyCode: 'USD', current: 90, mean: 10, threshold: 30 },
        ],
        subscriptionIncreases: [
          { payeeName: 'StreamCo', payeeId: 'p1', previous: 10, latest: 12.5, increasePct: 25 },
        ],
      }),
    );
    render(<AttentionList />);
    expect(await screen.findByText(/Dining is at .*420.* above its usual .*200/)).toBeInTheDocument();
    expect(screen.getByText(/Uncategorized is at/)).toBeInTheDocument();
    expect(screen.getByText(/StreamCo now costs 25% more than its previous charge/)).toBeInTheDocument();
  });

  it('does not leave a settled request on screen after the failure of a later one', async () => {
    get.mockResolvedValue(report({ subscriptionIncreases: [{ payeeName: 'A', payeeId: null, previous: 1, latest: 2, increasePct: 100 }] }));
    render(<AttentionList />);
    await waitFor(() => expect(screen.getByText(/A now costs 100%/)).toBeInTheDocument());
  });
});
