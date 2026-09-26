import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@/test/render';
import { FundRollingReturnsCard } from './FundRollingReturnsCard';
import type {
  FundRollingReturnsView,
  RollingPeriodResult,
  RollingPeriodStatus,
  RollingReturnPeriod,
} from '@/types/investment';

// The real number and date hooks, driven by a real preference row: every
// expectation below is a literal string, never built with the formatter the
// card itself uses.
let mockNumberFormat = 'en-US';
let mockDateFormat = 'YYYY-MM-DD';
vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: (selector: (s: unknown) => unknown) =>
    selector({
      preferences: {
        numberFormat: mockNumberFormat,
        dateFormat: mockDateFormat,
        defaultCurrency: 'INR',
      },
    }),
}));

const mockGetFundRollingReturns = vi.fn();
vi.mock('@/lib/investments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/investments')>();
  return {
    ...actual,
    investmentsApi: {
      ...actual.investmentsApi,
      getFundRollingReturns: (...args: unknown[]) => mockGetFundRollingReturns(...args),
    },
  };
});

const MONTHS: Record<RollingReturnPeriod, number> = { '1Y': 12, '3Y': 36, '5Y': 60 };

function ok(
  period: RollingReturnPeriod,
  over: Partial<RollingPeriodResult> & Pick<RollingPeriodResult, 'min' | 'max'>,
): RollingPeriodResult {
  return {
    period,
    months: MONTHS[period],
    annualized: period !== '1Y',
    status: 'OK',
    completeness: 'complete',
    windowCount: 1,
    missingWindowCount: 0,
    median: over.min!.returnPct,
    mean: over.min!.returnPct,
    positiveShare: 100,
    gaps: [],
    ...over,
  };
}

function refused(
  period: RollingReturnPeriod,
  status: Exclude<RollingPeriodStatus, 'OK'>,
  missingWindowCount = 0,
): RollingPeriodResult {
  return {
    period,
    months: MONTHS[period],
    annualized: period !== '1Y',
    status,
    completeness: missingWindowCount > 0 ? 'incomplete' : 'complete',
    windowCount: 0,
    missingWindowCount,
    min: null,
    max: null,
    median: null,
    mean: null,
    positiveShare: null,
    gaps: missingWindowCount > 0 ? [{ from: '2024-01-02', to: '2024-01-05' }] : [],
  };
}

function view(
  periods: RollingPeriodResult[],
  history: Partial<FundRollingReturnsView['history']> = {},
  securityId = 'fund-a',
): FundRollingReturnsView {
  return {
    securityId,
    eligibility: 'ELIGIBLE',
    currencyCode: 'INR',
    history: {
      firstDate: '2021-06-30',
      lastDate: '2026-06-30',
      observationCount: 4,
      excludedObservationCount: 0,
      lastIsStale: false,
      ...history,
    },
    periods,
  };
}

// FX-A of docs/specs/fund-rolling-returns.md section 8, as the server reports it.
const fxA = view([
  ok('1Y', {
    min: { returnPct: 25, startDate: '2025-06-30', endDate: '2026-06-30' },
    max: { returnPct: 25, startDate: '2025-06-30', endDate: '2026-06-30' },
    completeness: 'incomplete',
    missingWindowCount: 2,
    gaps: [{ from: '2023-06-30', to: '2025-06-30' }],
  }),
  ok('3Y', {
    min: { returnPct: 25.9855, startDate: '2023-06-30', endDate: '2026-06-30' },
    max: { returnPct: 25.9855, startDate: '2023-06-30', endDate: '2026-06-30' },
    completeness: 'incomplete',
    missingWindowCount: 1,
    gaps: [{ from: '2025-06-30', to: '2025-06-30' }],
  }),
  ok('5Y', {
    min: { returnPct: 20.1155, startDate: '2021-06-30', endDate: '2026-06-30' },
    max: { returnPct: 20.1155, startDate: '2021-06-30', endDate: '2026-06-30' },
  }),
]);

// FX-R's 1Y distribution: 390 windows, worst -10, median 12.5, best 20.
const fxR = view(
  [
    ok('1Y', {
      windowCount: 390,
      min: { returnPct: -10, startDate: '2024-07-01', endDate: '2025-07-01' },
      max: { returnPct: 20, startDate: '2024-01-01', endDate: '2025-01-01' },
      median: 12.5,
      mean: 7.3654,
      positiveShare: 66.1538,
    }),
    refused('3Y', 'INSUFFICIENT_HISTORY'),
    refused('5Y', 'INSUFFICIENT_HISTORY'),
  ],
  { firstDate: '2024-01-01', observationCount: 652 },
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderCard(securityId = 'fund-a') {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<FundRollingReturnsCard securityId={securityId} />);
  });
  return result!;
}

const card = () => screen.getByRole('region', { name: 'Rolling returns' });
const cells = (period: RollingReturnPeriod) =>
  within(screen.getByTestId(`rolling-${period}`))
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

beforeEach(() => {
  mockNumberFormat = 'en-US';
  mockDateFormat = 'YYYY-MM-DD';
  mockGetFundRollingReturns.mockReset();
});

describe('FundRollingReturnsCard', () => {
  it('asks for the security it was given, and shows a titled loading state', async () => {
    const pending = deferred<FundRollingReturnsView>();
    mockGetFundRollingReturns.mockReturnValue(pending.promise);
    await renderCard();

    expect(mockGetFundRollingReturns).toHaveBeenCalledWith('fund-a');
    expect(card()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('rolling-returns-loading')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();

    await act(async () => pending.resolve(fxA));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders the server figures for each period, in en-US', async () => {
    mockGetFundRollingReturns.mockResolvedValue(fxA);
    await renderCard();

    expect(screen.getByRole('rowheader', { name: '1 year absolute' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '3 years p.a.' })).toBeInTheDocument();
    expect(cells('1Y')).toEqual([
      'Worst+25.00%2025-06-30 to 2026-06-30',
      'Median+25.00%',
      'Best+25.00%2025-06-30 to 2026-06-30',
      'Positive100.00%',
      'Periods measured12 missing',
    ]);
    expect(cells('3Y')).toEqual([
      'Worst+25.99%2023-06-30 to 2026-06-30',
      'Median+25.99%',
      'Best+25.99%2023-06-30 to 2026-06-30',
      'Positive100.00%',
      'Periods measured11 missing',
    ]);
    expect(cells('5Y')).toEqual([
      'Worst+20.12%2021-06-30 to 2026-06-30',
      'Median+20.12%',
      'Best+20.12%2021-06-30 to 2026-06-30',
      'Positive100.00%',
      'Periods measured1',
    ]);
  });

  it('renders a distribution with a negative worst period, in en-US', async () => {
    mockGetFundRollingReturns.mockResolvedValue(fxR);
    await renderCard();

    expect(cells('1Y')).toEqual([
      'Worst-10.00%2024-07-01 to 2025-07-01',
      'Median+12.50%',
      'Best+20.00%2024-01-01 to 2025-01-01',
      'Positive66.15%',
      'Periods measured390',
    ]);
  });

  it('follows a de-DE number and date preference', async () => {
    mockNumberFormat = 'de-DE';
    mockDateFormat = 'DD.MM.YYYY';
    mockGetFundRollingReturns.mockResolvedValue(
      view([
        ok('1Y', {
          windowCount: 1234,
          min: { returnPct: -10, startDate: '2024-07-01', endDate: '2025-07-01' },
          max: { returnPct: 25.9855, startDate: '2024-01-01', endDate: '2025-01-01' },
          median: 12.5,
          positiveShare: 66.1538,
        }),
        refused('3Y', 'INSUFFICIENT_HISTORY'),
        refused('5Y', 'INSUFFICIENT_HISTORY'),
      ]),
    );
    await renderCard();

    // Typed by hand: formatSignedPercent appends a bare "%", while the
    // positive share goes through Intl's percent style, which puts a
    // no-break space before it in de-DE.
    expect(cells('1Y')).toEqual([
      'Worst-10,00%01.07.2024 to 01.07.2025',
      'Median+12,50%',
      'Best+25,99%01.01.2024 to 01.01.2025',
      'Positive66,15 %',
      'Periods measured1.234',
    ]);
  });

  it.each([
    [
      'INSUFFICIENT_HISTORY',
      refused('3Y', 'INSUFFICIENT_HISTORY'),
      'n/aThe stored NAV history is shorter than this period.',
    ],
    [
      'ALL_WINDOWS_MISSING',
      refused('3Y', 'ALL_WINDOWS_MISSING', 12),
      'n/aNo period could be measured: every one of its 12 start dates has no NAV within 14 days.',
    ],
    [
      'NO_PRICE_HISTORY',
      refused('3Y', 'NO_PRICE_HISTORY'),
      'n/aNo NAV history is stored for this fund yet.',
    ],
  ])('says n/a and why for %s, never 0%%', async (_status, period, expected) => {
    mockGetFundRollingReturns.mockResolvedValue(
      view([fxA.periods[0], period, fxA.periods[2]]),
    );
    await renderCard();

    expect(cells('3Y')).toEqual([expected]);
    expect(within(screen.getByTestId('rolling-3Y')).queryByText(/0[.,]00/)).toBeNull();
  });

  it('shows every period n/a for a fund with no NAV history', async () => {
    mockGetFundRollingReturns.mockResolvedValue(
      view(
        [
          refused('1Y', 'NO_PRICE_HISTORY'),
          refused('3Y', 'NO_PRICE_HISTORY'),
          refused('5Y', 'NO_PRICE_HISTORY'),
        ],
        { firstDate: null, lastDate: null, observationCount: 0 },
      ),
    );
    await renderCard();

    expect(screen.getAllByText('n/a')).toHaveLength(3);
    expect(screen.queryByText(/%/)).toBeNull();
    // No NAV, so no "as of" date to name.
    expect(screen.queryByText(/Based on NAVs up to/)).toBeNull();
  });

  it('discloses the periods it could not measure, with their end dates', async () => {
    mockGetFundRollingReturns.mockResolvedValue(fxA);
    await renderCard();

    const note = screen.getByRole('status');
    expect(within(note).getByText('Some periods could not be measured')).toBeInTheDocument();
    expect(
      within(note).getByText(
        '1 year: 2 periods have no NAV within 14 days of its start date, so the figures describe only the periods that could be measured. Missing periods end 2023-06-30 to 2025-06-30.',
      ),
    ).toBeInTheDocument();
    expect(
      within(note).getByText(
        '3 years: 1 period has no NAV within 14 days of its start date, so the figures describe only the periods that could be measured. Missing periods end 2025-06-30 to 2025-06-30.',
      ),
    ).toBeInTheDocument();
    // 5Y is complete, so it is not named.
    expect(within(note).queryByText(/^5 years/)).toBeNull();
  });

  it('names a few gap ranges and counts the rest', async () => {
    const gaps = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'].map((m) => ({
      from: `${m}-10`,
      to: `${m}-12`,
    }));
    mockGetFundRollingReturns.mockResolvedValue(
      view([
        { ...fxA.periods[0], missingWindowCount: 15, gaps },
        fxA.periods[1],
        fxA.periods[2],
      ]),
    );
    await renderCard();

    expect(
      screen.getByText(
        /Missing periods end 2025-01-10 to 2025-01-12; 2025-02-10 to 2025-02-12; 2025-03-10 to 2025-03-12; and 2 more ranges\.$/,
      ),
    ).toBeInTheDocument();
  });

  it('shows no incompleteness note when every period was measured', async () => {
    mockGetFundRollingReturns.mockResolvedValue(fxR);
    await renderCard();

    expect(screen.queryByText('Some periods could not be measured')).toBeNull();
  });

  it('states the NAV date the figures run to', async () => {
    mockGetFundRollingReturns.mockResolvedValue(fxA);
    await renderCard();

    expect(screen.getByText('Based on NAVs up to 2026-06-30.')).toBeInTheDocument();
    expect(screen.queryByText(/more than 14 days ago/)).toBeNull();
  });

  it('warns when the NAV feed is stale, keeping the figures', async () => {
    mockGetFundRollingReturns.mockResolvedValue(
      view(fxA.periods, { lastDate: '2026-05-01', lastIsStale: true }),
    );
    await renderCard();

    expect(
      screen.getByText(
        'The latest NAV is from 2026-05-01, more than 14 days ago. The NAV feed may be behind, so recent periods are missing.',
      ),
    ).toBeInTheDocument();
    expect(cells('5Y')[0]).toBe('Worst+20.12%2021-06-30 to 2026-06-30');
  });

  it('says how many NAV rows were left out', async () => {
    mockGetFundRollingReturns.mockResolvedValue(
      view(fxA.periods, { excludedObservationCount: 2 }),
    );
    await renderCard();

    expect(
      screen.getByText(
        '2 NAV rows were left out because they were zero, negative or dated in the future.',
      ),
    ).toBeInTheDocument();
  });

  it('always carries the basis and IDCW captions', async () => {
    mockGetFundRollingReturns.mockResolvedValue(fxA);
    await renderCard();

    expect(
      screen.getByText('1-year figures are absolute; 3- and 5-year figures are annualized (p.a.).'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Based on NAV. For IDCW (dividend) plans, payouts are not added back.'),
    ).toBeInTheDocument();
  });

  it('renders nothing for a security the server says is not an AMFI fund', async () => {
    mockGetFundRollingReturns.mockResolvedValue({
      ...view([], { firstDate: null, lastDate: null, observationCount: 0 }),
      eligibility: 'NOT_AN_AMFI_FUND',
    });
    const { container } = await renderCard();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows a failed request as an error with a retry, never as a status', async () => {
    mockGetFundRollingReturns.mockRejectedValueOnce(new Error('boom'));
    await renderCard();

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Rolling returns could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('n/a')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();

    mockGetFundRollingReturns.mockResolvedValueOnce(fxA);
    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    });
    expect(mockGetFundRollingReturns).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(cells('5Y')[0]).toBe('Worst+20.12%2021-06-30 to 2026-06-30');
  });

  describe('switching security', () => {
    it('drops a response for the previous security that lands late', async () => {
      const forA = deferred<FundRollingReturnsView>();
      const forB = deferred<FundRollingReturnsView>();
      mockGetFundRollingReturns.mockImplementation((id: string) =>
        id === 'fund-a' ? forA.promise : forB.promise,
      );
      const { rerender } = await renderCard('fund-a');
      await act(async () => {
        rerender(<FundRollingReturnsCard securityId="fund-b" />);
      });

      await act(async () => forB.resolve({ ...fxR, securityId: 'fund-b' }));
      await act(async () => forA.resolve(fxA));

      // Still B's distribution: A's 5Y figure never appears.
      expect(cells('1Y')[0]).toBe('Worst-10.00%2024-07-01 to 2025-07-01');
      expect(screen.queryByText(/\+20\.12%/)).toBeNull();
    });

    it('does not present the previous security while the next one loads', async () => {
      const forB = deferred<FundRollingReturnsView>();
      mockGetFundRollingReturns.mockImplementation((id: string) =>
        id === 'fund-a' ? Promise.resolve(fxA) : forB.promise,
      );
      const { rerender } = await renderCard('fund-a');
      expect(screen.getByRole('table')).toBeInTheDocument();

      await act(async () => {
        rerender(<FundRollingReturnsCard securityId="fund-b" />);
      });
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.getByTestId('rolling-returns-loading')).toBeInTheDocument();

      await act(async () => forB.resolve({ ...fxR, securityId: 'fund-b' }));
      expect(cells('1Y')[3]).toBe('Positive66.15%');
    });

    it('shows the next security failing as an error, not the previous figures', async () => {
      mockGetFundRollingReturns.mockImplementation((id: string) =>
        id === 'fund-a' ? Promise.resolve(fxA) : Promise.reject(new Error('down')),
      );
      const { rerender } = await renderCard('fund-a');
      await act(async () => {
        rerender(<FundRollingReturnsCard securityId="fund-b" />);
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Rolling returns could not be loaded.');
      expect(screen.queryByRole('table')).toBeNull();
    });
  });
});
