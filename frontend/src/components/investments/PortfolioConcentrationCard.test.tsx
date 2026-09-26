import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@/test/render';
import { PortfolioConcentrationCard } from './PortfolioConcentrationCard';
import type { ConcentrationResult } from '@/types/investment';

// The real number hook, driven by a real preference row: the expectations below
// are literal strings, never built with the formatter the card itself uses.
let mockNumberFormat = 'en-US';
vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: (selector: (s: unknown) => unknown) =>
    selector({ preferences: { numberFormat: mockNumberFormat, defaultCurrency: 'INR' } }),
}));

beforeEach(() => {
  mockNumberFormat = 'en-US';
});

// Two holdings worth 6000 and 2000, plus 2000 cash -- the fixture the E2E
// journey builds. Holdings basis: weights .75/.25, HHI .625, 1/HHI 1.6.
// Portfolio basis: .6/.2/.2, HHI .44, 1/HHI 2.2727...
const complete: ConcentrationResult = {
  status: 'complete',
  currencyCode: 'INR',
  holdings: {
    basis: 'holdings',
    positions: 2,
    drawnValue: 8000,
    herfindahl: 0.625,
    effectiveHoldings: 1.6,
    top1Percent: 75,
    top5Percent: 100,
    largest: [
      { name: 'Alpha Ltd', value: 6000, percent: 75 },
      { name: 'Beta Ltd', value: 2000, percent: 25 },
    ],
  },
  portfolio: {
    basis: 'portfolio',
    positions: 3,
    drawnValue: 10000,
    herfindahl: 0.44,
    effectiveHoldings: 1 / 0.44,
    top1Percent: 60,
    top5Percent: 100,
    largest: [
      { name: 'Alpha Ltd', value: 6000, percent: 60 },
      { name: 'Cash', value: 2000, percent: 20 },
      { name: 'Beta Ltd', value: 2000, percent: 20 },
    ],
  },
  pricedPositions: 2,
  unpricedPositions: 0,
  missingRatePairs: [],
  nonPositiveValuePositions: 0,
};

const row = (key: string) => screen.getByTestId(`concentration-${key}`);
const cells = (key: string) =>
  within(row(key))
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

describe('PortfolioConcentrationCard', () => {
  it('renders nothing when the server sent no concentration (older backend)', () => {
    const { container } = render(
      <PortfolioConcentrationCard concentration={undefined} isLoading={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a titled loading state while the summary loads', () => {
    render(<PortfolioConcentrationCard concentration={undefined} isLoading />);
    expect(screen.getByRole('region', { name: 'Concentration' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows both bases side by side, exactly as the server measured them', () => {
    render(<PortfolioConcentrationCard concentration={complete} isLoading={false} />);

    expect(cells('effective')).toEqual(['1.6 of 2', '2.3 of 3']);
    expect(cells('top1')).toEqual(['75.0%', '60.0%']);
    expect(cells('top5')).toEqual(['100.0%', '100.0%']);
    expect(cells('hhi')).toEqual(['0.625', '0.440']);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lists the largest positions from the securities-only basis (never cash)', () => {
    render(<PortfolioConcentrationCard concentration={complete} isLoading={false} />);

    const positions = screen.getAllByTestId('concentration-position');
    expect(positions.map((p) => p.textContent)).toEqual([
      'Alpha Ltd₹6,000.0075.0%',
      'Beta Ltd₹2,000.0025.0%',
    ]);
  });

  it('says which part of the portfolio a partial figure leaves out', () => {
    render(
      <PortfolioConcentrationCard
        concentration={{
          ...complete,
          status: 'partial',
          unpricedPositions: 1,
          missingRatePairs: ['EUR->INR'],
        }}
        isLoading={false}
      />,
    );

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('These figures cover part of the portfolio');
    expect(notice).toHaveTextContent('Not included: 1 holding with no current price.');
    expect(notice).toHaveTextContent(
      'No exchange rate for EUR->INR, so the holdings in those currencies are not included.',
    );
    // The measured part is still shown, under the notice that qualifies it.
    expect(cells('top1')).toEqual(['75.0%', '60.0%']);
  });

  it('renders no measure when nothing could be measured', () => {
    render(
      <PortfolioConcentrationCard
        concentration={{
          ...complete,
          status: 'unavailable',
          holdings: null,
          portfolio: null,
          pricedPositions: 0,
          unpricedPositions: 2,
        }}
        isLoading={false}
      />,
    );

    expect(
      screen.getByText('There are no priced holdings to measure concentration against yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('concentration-position')).toHaveLength(0);
  });

  it('marks a basis with no measure as not available rather than zero', () => {
    render(
      <PortfolioConcentrationCard
        concentration={{ ...complete, holdings: null, pricedPositions: 0 }}
        isLoading={false}
      />,
    );

    expect(cells('top1')).toEqual(['Not available', '60.0%']);
    expect(screen.queryAllByTestId('concentration-position')).toHaveLength(0);
  });

  it("formats in the reader's number preference, not the host's", () => {
    mockNumberFormat = 'de-DE';
    render(<PortfolioConcentrationCard concentration={complete} isLoading={false} />);

    expect(cells('top1')).toEqual(['75,0 %', '60,0 %']);
    expect(cells('hhi')).toEqual(['0,625', '0,440']);
  });
});
