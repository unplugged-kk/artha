import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@/test/render';

vi.mock('@/hooks/useFinancialToday', () => ({ useFinancialToday: () => '2026-11-03' }));

import { WhereYouStand } from './WhereYouStand';
import { ScheduledTransaction } from '@/types/scheduled-transaction';

afterEach(() => cleanup());

const st = (over: Partial<ScheduledTransaction>) =>
  ({ id: 'x', isActive: true, isTransfer: false, nextDueDate: '2026-11-05', nextOverride: null, ...over }) as unknown as ScheduledTransaction;

const pt = (month: string, netWorth: number) => ({ month, assets: netWorth + 50, liabilities: -50, netWorth });

describe('WhereYouStand', () => {
  it('says not available rather than showing zero when there is no data', () => {
    render(<WhereYouStand netWorthData={[]} scheduledTransactions={[]} isLoading={false} />);
    expect(screen.getAllByText('Not available yet').length).toBeGreaterThan(0);
  });

  it('renders nothing while loading', () => {
    const { container } = render(<WhereYouStand netWorthData={[]} scheduledTransactions={[]} isLoading />);
    expect(container).toBeEmptyDOMElement();
  });

  it('puts words beside the colour for a fall', () => {
    render(
      <WhereYouStand
        netWorthData={[pt('2026-09-01', 1000), pt('2026-10-01', 900)]}
        scheduledTransactions={[]}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/Down .*100.* since last month/)).toBeInTheDocument();
  });

  it('counts only active, non-transfer items inside the seven days, using the moved date', () => {
    render(
      <WhereYouStand
        netWorthData={[]}
        isLoading={false}
        scheduledTransactions={[
          st({ id: 'a' }),
          st({ id: 'b', nextDueDate: '2026-11-20' }),
          st({ id: 'c', nextDueDate: '2026-11-20', nextOverride: { overrideDate: '2026-11-04' } as never }),
          st({ id: 'd', isTransfer: true }),
          st({ id: 'e', isActive: false }),
          st({ id: 'f', nextDueDate: '2026-11-10' }),
          st({ id: 'g', nextDueDate: '2026-11-11' }),
        ]}
      />,
    );
    expect(screen.getByText('Due in the next 7 days').nextElementSibling).toHaveTextContent('3');
  });
});
