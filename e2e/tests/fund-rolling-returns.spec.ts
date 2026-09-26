import type { Page, Response } from '@playwright/test';
import { test, expect } from '../fixtures';
import { createSecurity } from '../helpers/factories';
import { rawApiRequest, uniqueId } from '../helpers/api';
import { registerUser } from '../helpers/auth';

// Fund rolling returns on the security detail page, seeded with FX-A from
// docs/specs/fund-rolling-returns.md section 8 as `manual` NAV rows. The scheme
// code is one mfapi does not serve, so the stored rows are the whole series
// and the figures are the spec's oracles: 1Y +25.00%, 3Y +25.99%, 5Y +20.12%.
// The page's own `rolling-returns` response is awaited and the card is checked
// against it, so a card that formats something other than what the server
// sent fails even when the server is right.

const ROLLING_RETURNS_PATH = /\/investments\/performance\/securities\/[^/]+\/rolling-returns$/;

const FX_A: Array<[string, number]> = [
  ['2021-06-30', 80],
  ['2023-06-30', 100],
  ['2025-06-30', 160],
  ['2026-06-30', 200],
];

/** The literal each period's row must show. */
const EXPECTED: Array<[period: string, median: number, text: string]> = [
  ['1Y', 25, '+25.00%'],
  ['3Y', 25.9855, '+25.99%'],
  ['5Y', 20.1155, '+20.12%'],
];

interface RollingPeriod {
  period: string;
  status: string;
  windowCount: number;
  median: number | null;
  min: { returnPct: number } | null;
  max: { returnPct: number } | null;
}

interface RollingView {
  securityId: string;
  eligibility: string;
  periods: RollingPeriod[];
}

function isRollingReturns(res: Response): boolean {
  return (
    res.request().method() === 'GET' &&
    ROLLING_RETURNS_PATH.test(new URL(res.url()).pathname)
  );
}

/**
 * The card: a `<section>` labelled by its "Rolling returns" heading, so the
 * accessible region is the stable handle rather than position on the page.
 */
function rollingCard(page: Page) {
  return page.getByRole('region', { name: 'Rolling returns' });
}

test.describe('Fund rolling returns', () => {
  test('shows the FX-A distribution the server computed', async ({
    authedPage: page,
    api,
  }) => {
    const fund = await createSecurity(api, {
      symbol: `RR${uniqueId().slice(-6).toUpperCase()}`,
      name: `Rolling Fund ${uniqueId()}`,
      securityType: 'MUTUAL_FUND',
      currencyCode: 'INR',
      amfiSchemeCode: '9999999999',
    });
    for (const [priceDate, closePrice] of FX_A) {
      await api.post(`/securities/${fund.id}/prices`, { priceDate, closePrice });
    }

    const responsePromise = page.waitForResponse(
      (res) => isRollingReturns(res) && res.ok(),
    );
    await page.goto(`/securities/${fund.id}`);
    const view = (await (await responsePromise).json()) as RollingView;

    // The JSON is the oracle's first half: the server's numbers.
    expect(view.securityId).toBe(fund.id);
    expect(view.eligibility).toBe('ELIGIBLE');
    expect(view.periods.map((p) => p.period)).toEqual(['1Y', '3Y', '5Y']);
    for (const [period, median] of EXPECTED) {
      const p = view.periods.find((r) => r.period === period)!;
      expect(p.status).toBe('OK');
      expect(p.windowCount).toBe(1);
      expect(p.median).toBe(median);
      // One window: worst, median and best are the same figure.
      expect(p.min?.returnPct).toBe(median);
      expect(p.max?.returnPct).toBe(median);
    }

    // The card is the second half: each row carries the literal the JSON
    // formats to, en-US, 2dp, signed.
    const card = rollingCard(page);
    await expect(card).toBeVisible();
    for (const [period, median, text] of EXPECTED) {
      expect(`+${median.toFixed(2)}%`).toBe(text);
      // Cells in order: worst, median, best, % positive, periods measured.
      const cells = card.getByTestId(`rolling-${period}`).getByRole('cell');
      await expect(cells).toHaveCount(5);
      for (const i of [0, 1, 2]) {
        await expect(cells.nth(i)).toContainText(text);
      }
      await expect(cells.nth(3)).toContainText('100.00%');
    }
  });

  test('shows no card for a security without a scheme code', async ({
    authedPage: page,
    api,
  }) => {
    const plain = await createSecurity(api, {
      symbol: `RN${uniqueId().slice(-6).toUpperCase()}`,
      name: `Plain Fund ${uniqueId()}`,
      securityType: 'MUTUAL_FUND',
      currencyCode: 'INR',
    });
    for (const [priceDate, closePrice] of FX_A) {
      await api.post(`/securities/${plain.id}/prices`, { priceDate, closePrice });
    }

    const requested: string[] = [];
    page.on('request', (req) => {
      if (ROLLING_RETURNS_PATH.test(new URL(req.url()).pathname)) {
        requested.push(req.url());
      }
    });

    await page.goto(`/securities/${plain.id}`);
    await expect(
      page.getByRole('heading', { name: new RegExp(plain.name) }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Security performance' }),
    ).toBeVisible();

    await expect(
      page.getByRole('region', { name: 'Rolling returns' }),
    ).toHaveCount(0);
    expect(requested).toEqual([]);
  });

  test('shows another user nothing of the fund', async ({ api, browser }) => {
    const fund = await createSecurity(api, {
      symbol: `RX${uniqueId().slice(-6).toUpperCase()}`,
      name: `Private Fund ${uniqueId()}`,
      securityType: 'MUTUAL_FUND',
      currencyCode: 'INR',
      amfiSchemeCode: '9999999999',
    });
    for (const [priceDate, closePrice] of FX_A) {
      await api.post(`/securities/${fund.id}/prices`, { priceDate, closePrice });
    }

    const otherContext = await browser.newContext();
    try {
      const other = await otherContext.newPage();
      await registerUser(other);

      const res = await rawApiRequest(
        other.request,
        'GET',
        `/investments/performance/securities/${fund.id}/rolling-returns`,
      );
      expect(res.status()).toBe(404);

      await other.goto(`/securities/${fund.id}`);
      await other.waitForLoadState('networkidle');
      await expect(
        other.getByRole('heading', { name: /rolling returns/i }),
      ).toHaveCount(0);
      for (const [, , text] of EXPECTED) {
        await expect(other.getByText(text)).toHaveCount(0);
      }
      await expect(other.getByText(fund.name)).toHaveCount(0);
    } finally {
      await otherContext.close();
    }
  });
});
