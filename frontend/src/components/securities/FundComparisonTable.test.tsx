import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@/test/render';
import { FundComparisonTable } from './FundComparisonTable';
import type {
  FundComparisonGroup,
  FundComparisonMember,
  FundComparisonView,
  RollingPeriodResult,
  RollingReturnPeriod,
} from '@/types/investment';

// The real number and date hooks, driven by a real preference row, so every
// expectation below is a literal string rather than the formatter the
// component itself uses.
vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: (selector: (s: unknown) => unknown) =>
    selector({
      preferences: {
        numberFormat: 'en-US',
        dateFormat: 'YYYY-MM-DD',
        defaultCurrency: 'INR',
      },
    }),
}));

const mockGetFundComparison = vi.fn();
vi.mock('@/lib/investments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/investments')>();
  return {
    ...actual,
    investmentsApi: {
      ...actual.investmentsApi,
      getFundComparison: (...args: unknown[]) => mockGetFundComparison(...args),
    },
  };
});

const MONTHS: Record<RollingReturnPeriod, number> = { '1Y': 12, '3Y': 36, '5Y': 60 };

function ok(
  period: RollingReturnPeriod,
  median: number,
  over: Partial<RollingPeriodResult> = {},
): RollingPeriodResult {
  return {
    period,
    months: MONTHS[period],
    annualized: period !== '1Y',
    status: 'OK',
    completeness: 'complete',
    windowCount: 1,
    missingWindowCount: 0,
    min: { returnPct: median, startDate: '2025-06-30', endDate: '2026-06-30' },
    max: { returnPct: median, startDate: '2025-06-30', endDate: '2026-06-30' },
    median,
    mean: median,
    positiveShare: 100,
    gaps: [],
    ...over,
  };
}

function refused(
  period: RollingReturnPeriod,
  status: 'INSUFFICIENT_HISTORY' | 'ALL_WINDOWS_MISSING' | 'NO_PRICE_HISTORY',
): RollingPeriodResult {
  return {
    period,
    months: MONTHS[period],
    annualized: period !== '1Y',
    status,
    completeness: 'complete',
    windowCount: 0,
    missingWindowCount: 0,
    min: null,
    max: null,
    median: null,
    mean: null,
    positiveShare: null,
    gaps: [],
  };
}

function member(
  id: string,
  over: Partial<FundComparisonMember> = {},
): FundComparisonMember {
  return {
    securityId: id,
    symbol: `FUND-${id}`,
    name: `Example Fund ${id}`,
    currencyCode: 'INR',
    fundHouse: 'Example Mutual Fund',
    fundSchemeType: 'Open Ended Schemes',
    fundCategory: 'Equity Scheme - Large Cap Fund',
    eligibility: 'ELIGIBLE',
    history: {
      firstDate: '2021-06-30',
      lastDate: '2026-06-30',
      observationCount: 4,
      excludedObservationCount: 0,
      lastIsStale: false,
    },
    periods: [ok('1Y', 25), ok('3Y', 25.9855), ok('5Y', 20.1155)],
    ...over,
  };
}

/** The API's grouping: categories sorted, Unclassified last. */
function group(members: FundComparisonMember[]): FundComparisonGroup[] {
  const byCategory = new Map<string | null, string[]>();
  for (const m of members) {
    const ids = byCategory.get(m.fundCategory) ?? [];
    ids.push(m.securityId);
    byCategory.set(m.fundCategory, ids);
  }
  return [...byCategory.entries()]
    .map(([category, securityIds]) => ({ category, securityIds }))
    .sort((a, b) =>
      a.category === null ? 1 : b.category === null ? -1 : a.category.localeCompare(b.category),
    );
}

function view(members: FundComparisonMember[], status?: 'complete' | 'incomplete'): FundComparisonView {
  return {
    members,
    groups: group(members),
    periods: ['1Y', '3Y', '5Y'],
    status:
      status ??
      (members.every(
        (m) =>
          m.eligibility === 'ELIGIBLE' &&
          m.periods.every((p) => p.status === 'OK' && p.completeness === 'complete'),
      )
        ? 'complete'
        : 'incomplete'),
  };
}

const IDS = ['fund-a', 'fund-b'];

function displayFund(response: FundComparisonView) {
  mockGetFundComparison.mockResolvedValue(response);
  render(<FundComparisonTable securityIds={IDS} />);
  return screen.findByTestId('fund-comparison');
}

describe('FundComparisonTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the figures the server returned, never a recomputed one", async () => {
    // The median deliberately disagrees with the worst/median/best midpoint:
    // a component that derived it from min and max would print 7.50% here.
    const fund = member('fund-a', {
      periods: [
        ok('1Y', 7.5, {
          min: { returnPct: 5, startDate: '2025-06-30', endDate: '2026-06-30' },
          max: { returnPct: 10, startDate: '2025-06-30', endDate: '2026-06-30' },
        }),
        ok('3Y', 25.9855),
        ok('5Y', 20.1155),
      ],
    });
    const panel = await displayFund(view([fund, member('fund-b')]));

    const row = within(panel).getByTestId('fund-comparison-fund-a');
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('+7.50%');
    expect(cells[0]).toHaveTextContent('Worst +5.00%');
    expect(cells[0]).toHaveTextContent('Best +10.00%');
    expect(cells[1]).toHaveTextContent('+25.99%');
    expect(cells[2]).toHaveTextContent('+20.12%');
  });

  it('groups funds by the AMFI category the response carries, Uncategorised last', async () => {
    const large = member('fund-a');
    const small = member('fund-b', {
      fundCategory: 'Equity Scheme - Small Cap Fund',
    });
    const unclassified = member('fund-c', { fundCategory: null });
    const panel = await displayFund(view([large, small, unclassified]));

    const headings = within(panel)
      .getAllByRole('heading', { level: 4 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      'Equity Scheme - Large Cap Fund',
      'Equity Scheme - Small Cap Fund',
      'Uncategorised',
    ]);
    expect(
      within(panel).getByText(/AMFI has not published a category/i),
    ).toBeInTheDocument();
  });

  it('shows the reason, not 0%, for a period the server could not compute', async () => {
    const fund = member('fund-a', {
      periods: [
        ok('1Y', 25),
        refused('3Y', 'INSUFFICIENT_HISTORY'),
        refused('5Y', 'NO_PRICE_HISTORY'),
      ],
    });
    const panel = await displayFund(view([fund, member('fund-b')]));

    const row = within(panel).getByTestId('fund-comparison-fund-a');
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('n/a');
    expect(cells[1]).toHaveTextContent('History is shorter than this period.');
    expect(cells[2]).toHaveTextContent('No usable NAV history yet.');
    for (const cell of cells) {
      expect(cell.textContent).not.toMatch(/(^|\s)0(\.00)?%/);
    }
    expect(within(panel).getByRole('status')).toHaveTextContent(
      'Some figures are unavailable or incomplete',
    );
  });

  it('surfaces missing windows and a stale last observation', async () => {
    const fund = member('fund-a', {
      history: {
        firstDate: '2021-06-30',
        lastDate: '2026-05-01',
        observationCount: 4,
        excludedObservationCount: 2,
        lastIsStale: true,
      },
      periods: [ok('1Y', 25, { missingWindowCount: 3, completeness: 'incomplete' })],
    });
    const panel = await displayFund(view([fund, member('fund-b')]));

    const row = within(panel).getByTestId('fund-comparison-fund-a');
    expect(row).toHaveTextContent('NAV data is stale: last observation 2026-05-01');
    expect(row).toHaveTextContent('3 windows could not be priced');
    expect(row).toHaveTextContent('2 observations were excluded as unusable.');
  });

  it('reports a security that is not an AMFI fund instead of drawing it as a zero', async () => {
    const stock = member('fund-b', {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      fundHouse: null,
      fundSchemeType: null,
      fundCategory: null,
      eligibility: 'NOT_AN_AMFI_FUND',
      history: {
        firstDate: null,
        lastDate: null,
        observationCount: 0,
        excludedObservationCount: 0,
        lastIsStale: false,
      },
      periods: [],
    });
    const panel = await displayFund(view([member('fund-a'), stock]));

    expect(
      within(panel).getByText(/AAPL is not an AMFI mutual fund/i),
    ).toBeInTheDocument();
    const row = within(panel).getByTestId('fund-comparison-fund-b');
    expect(row).toHaveTextContent('Not an AMFI mutual fund.');
    expect(row.textContent).not.toContain('+0.00%');
  });

  it('says when a repeated fund was collapsed', async () => {
    const fund = member('fund-a', { deduplicated: true });
    const panel = await displayFund(view([fund, member('fund-b')]));

    expect(
      within(panel).getByText(/selected more than once is shown once/i),
    ).toBeInTheDocument();
  });

  it('shows a loading state, then an error with a retry that recovers', async () => {
    let reject: (e: Error) => void = () => {};
    mockGetFundComparison.mockImplementation(
      () => new Promise((_resolve, r) => { reject = r; }),
    );
    render(<FundComparisonTable securityIds={IDS} />);
    expect(screen.getByTestId('fund-comparison-loading')).toBeInTheDocument();

    const failure = new Error('comparison down');
    reject(failure);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the fund comparison.');

    mockGetFundComparison.mockResolvedValue(view([member('fund-a'), member('fund-b')]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(screen.getByTestId('fund-comparison')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the answer with the selection it was asked for', async () => {
    // A slow answer for the previous pair must not be shown under the new one.
    let resolveFirst: (v: FundComparisonView) => void = () => {};
    mockGetFundComparison
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce(view([member('fund-c'), member('fund-d')]));

    const { rerender } = render(<FundComparisonTable securityIds={IDS} />);
    rerender(<FundComparisonTable securityIds={['fund-c', 'fund-d']} />);

    await screen.findByTestId('fund-comparison-fund-c');
    resolveFirst(view([member('fund-a'), member('fund-b')]));

    await waitFor(() => {
      expect(screen.queryByTestId('fund-comparison-fund-a')).not.toBeInTheDocument();
    });
    expect(mockGetFundComparison).toHaveBeenLastCalledWith(['fund-c', 'fund-d']);
  });
});
