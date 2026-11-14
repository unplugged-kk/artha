import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { createSecurity } from '../helpers/factories';
import { rawApiRequest, uniqueId } from '../helpers/api';
import { registerUser } from '../helpers/auth';

/**
 * The fund comparison (`docs/specs/fund-categories-and-comparison.md`), end to
 * end on the Security Performance report.
 *
 * Two things are deliberately real rather than mocked:
 *
 * - The NAVs are seeded as `manual` price rows (the same FX-A series the
 *   rolling-returns spec uses), so the distributions are the engine's own and
 *   the panel is checked against the awaited API response.
 * - Only the user's own funds are ever selected; a second user is used to prove
 *   the API answers 404 and the selector never shows another owner's fund.
 *
 * The e2e stack has no AMFI provider, so a real fund's category is Unclassified
 * here -- which is exactly the missing-classification state the panel must
 * handle honestly. Grouping by a *published* category is a UI-contract test
 * with a route-intercepted response; the server's own grouping is covered by
 * `test/integration/fund-comparison.integration.spec.ts`.
 */

const SELECT_SECURITIES = 'Select securities...';
const COMPARISON_PATH = /\/investments\/performance\/funds\/comparison$/;
const REPORT_PATH = '/reports/security-performance';

/** FX-A of docs/specs/fund-rolling-returns.md section 8. */
const FX_A: Array<[string, number]> = [
  ['2021-06-30', 80],
  ['2023-06-30', 100],
  ['2025-06-30', 160],
  ['2026-06-30', 200],
];

interface ComparisonPeriod {
  period: string;
  status: string;
  median: number | null;
  min: { returnPct: number } | null;
  max: { returnPct: number } | null;
}

interface ComparisonMember {
  securityId: string;
  symbol: string;
  fundCategory: string | null;
  eligibility: string;
  periods: ComparisonPeriod[];
}

interface ComparisonView {
  members: ComparisonMember[];
  groups: Array<{ category: string | null; securityIds: string[] }>;
  periods: string[];
  status: string;
}

// Scheme codes are unique per user and digits only (the identity layer refuses
// anything else). A module counter keeps two seeded funds distinct.
let nextSchemeCode = 7_100_000_000;

async function seedFund(
  api: Parameters<typeof createSecurity>[0],
  options: { withSchemeCode?: boolean } = {},
) {
  const symbol = `FC${uniqueId().slice(-6).toUpperCase()}`;
  const fund = await createSecurity(api, {
    symbol,
    name: `Comparison Fund ${symbol}`,
    securityType: 'MUTUAL_FUND',
    currencyCode: 'INR',
    ...(options.withSchemeCode === false
      ? {}
      : { amfiSchemeCode: String(nextSchemeCode++) }),
  });
  for (const [priceDate, closePrice] of FX_A) {
    await api.post(`/securities/${fund.id}/prices`, { priceDate, closePrice });
  }
  return { ...fund, label: `${symbol} - Comparison Fund ${symbol}` };
}

/**
 * The selector is a searchable MultiSelect: trigger button (its aria-label is
 * the placeholder), then a portal dropdown whose options are wrapped labels.
 * Closing after each pick keeps the selected label out of the dropdown queries.
 */
async function selectInstrument(page: Page, label: string, trigger = SELECT_SECURITIES) {
  await page.getByRole('button', { name: trigger }).click();
  await page.getByText(label, { exact: true }).click();
  await page.getByRole('button', { name: trigger }).click();
}

function comparisonPanel(page: Page) {
  return page.getByRole('region', { name: 'Fund comparison' });
}

async function openReportWithFunds(page: Page, labels: string[]) {
  await page.goto(REPORT_PATH);
  await expect(
    page.getByRole('button', { name: SELECT_SECURITIES }),
  ).toBeVisible({ timeout: 15000 });
  for (const label of labels) {
    await selectInstrument(page, label);
  }
}

test.describe('Fund comparison', () => {
  test('compares two funds and marks them Unclassified, from the server response', async ({
    authedPage: page,
    api,
  }) => {
    const first = await seedFund(api);
    const second = await seedFund(api);

    await page.goto(REPORT_PATH);
    await expect(
      page.getByRole('button', { name: SELECT_SECURITIES }),
    ).toBeVisible({ timeout: 15000 });

    const responsePromise = page.waitForResponse(
      (res) => COMPARISON_PATH.test(new URL(res.url()).pathname) && res.ok(),
    );
    await selectInstrument(page, first.label);
    await selectInstrument(page, second.label);
    const view = (await (await responsePromise).json()) as ComparisonView;

    // The API is the oracle's first half: both funds, one Unclassified group,
    // and the engine's own figures.
    expect(view.periods).toEqual(['1Y', '3Y', '5Y']);
    expect(view.members.map((m) => m.securityId).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    expect(view.groups).toEqual([
      { category: null, securityIds: [first.id, second.id] },
    ]);
    for (const member of view.members) {
      expect(member.eligibility).toBe('ELIGIBLE');
      const oneYear = member.periods.find((p) => p.period === '1Y')!;
      expect(oneYear.status).toBe('OK');
      expect(oneYear.median).toBe(25);
    }

    const panel = comparisonPanel(page);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole('heading', { name: 'Uncategorised' }),
    ).toBeVisible();
    await expect(
      panel.getByText(/AMFI has not published a category/i),
    ).toBeVisible();
    // Each fund's 1Y median is the JSON's number formatted, not a recomputation.
    for (const member of view.members) {
      const row = panel.getByTestId(`fund-comparison-${member.securityId}`);
      await expect(row.getByRole('cell').first()).toContainText('+25.00%');
    }
  });

  test('offers no comparison for fewer than two funds', async ({
    authedPage: page,
    api,
  }) => {
    const fund = await seedFund(api);
    const stock = await createSecurity(api, {
      symbol: `ST${uniqueId().slice(-6).toUpperCase()}`,
      name: `Plain Stock ${uniqueId()}`,
      securityType: 'STOCK',
      currencyCode: 'USD',
    });

    const requested: string[] = [];
    page.on('request', (req) => {
      if (COMPARISON_PATH.test(new URL(req.url()).pathname)) {
        requested.push(req.url());
      }
    });

    await page.goto(REPORT_PATH);
    await expect(
      page.getByRole('button', { name: SELECT_SECURITIES }),
    ).toBeVisible({ timeout: 15000 });

    // The empty state, before anything is selected.
    await expect(
      page.getByText(/Select one or more securities above/),
    ).toBeVisible();
    await expect(comparisonPanel(page)).toHaveCount(0);

    // One fund and one stock: two instruments on the chart, but only one AMFI
    // fund, so there is no fund comparison to offer.
    await selectInstrument(page, fund.label);
    await selectInstrument(page, `${stock.symbol} - ${stock.name}`);
    await expect(
      page.getByText('Performance Comparison'),
    ).toBeVisible({ timeout: 15000 });
    await expect(comparisonPanel(page)).toHaveCount(0);
    expect(requested).toEqual([]);
  });

  test('groups published categories in the server order, Unclassified last', async ({
    authedPage: page,
    api,
  }) => {
    // A UI-contract fixture: the e2e stack cannot publish an AMFI category, so
    // the response shape is intercepted. The server's grouping is proven by the
    // PostgreSQL integration suite.
    const first = await seedFund(api);
    const second = await seedFund(api);
    const refused = (period: string): ComparisonPeriod => ({
      period,
      status: 'INSUFFICIENT_HISTORY',
      median: null,
      min: null,
      max: null,
    });
    const fixture: ComparisonView = {
      periods: ['1Y', '3Y', '5Y'],
      status: 'incomplete',
      groups: [
        {
          category: 'Equity Scheme - Large Cap Fund',
          securityIds: [first.id],
        },
        {
          category: 'Equity Scheme - Small Cap Fund',
          securityIds: [second.id],
        },
      ],
      members: [
        {
          securityId: first.id,
          symbol: first.symbol,
          fundCategory: 'Equity Scheme - Large Cap Fund',
          eligibility: 'ELIGIBLE',
          history: {
            firstDate: '2021-06-30',
            lastDate: '2026-06-30',
            observationCount: 4,
            excludedObservationCount: 0,
            lastIsStale: false,
          },
          periods: ['1Y', '3Y', '5Y'].map(refused),
        },
        {
          securityId: second.id,
          symbol: second.symbol,
          fundCategory: 'Equity Scheme - Small Cap Fund',
          eligibility: 'ELIGIBLE',
          history: {
            firstDate: '2021-06-30',
            lastDate: '2026-06-30',
            observationCount: 4,
            excludedObservationCount: 0,
            lastIsStale: false,
          },
          periods: ['1Y', '3Y', '5Y'].map(refused),
        },
      ],
    };
    await page.route('**/investments/performance/funds/comparison*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixture),
      }),
    );

    await openReportWithFunds(page, [first.label, second.label]);

    const panel = comparisonPanel(page);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole('heading', {
        name: 'Equity Scheme - Large Cap Fund',
      }),
    ).toBeVisible();
    await expect(
      panel.getByRole('heading', {
        name: 'Equity Scheme - Small Cap Fund',
      }),
    ).toBeVisible();
    // No Unclassified group is invented when every member has a category.
    await expect(
      panel.getByRole('heading', { name: 'Uncategorised' }),
    ).toHaveCount(0);
    // The periods the fixture refused render "n/a" with a reason, never 0%.
    const row = panel.getByTestId(`fund-comparison-${first.id}`);
    for (const cell of await row.getByRole('cell').all()) {
      await expect(cell).toContainText('n/a');
      await expect(cell).not.toContainText('0.00%');
    }
  });

  test('reports a security with no AMFI scheme code instead of drawing it', async ({
    authedPage: page,
    api,
  }) => {
    const fund = await seedFund(api);
    const plain = await seedFund(api, { withSchemeCode: false });
    // The API only sees a non-fund here if the panel is shown; the panel needs
    // two AMFI funds, so add a second real fund beside them.
    const otherFund = await seedFund(api);

    await openReportWithFunds(page, [
      fund.label,
      otherFund.label,
      plain.label,
    ]);

    const panel = comparisonPanel(page);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(
        new RegExp(`${plain.symbol} is not an AMFI mutual fund`, 'i'),
      ),
    ).toBeVisible();
    const row = panel.getByTestId(`fund-comparison-${plain.id}`);
    await expect(row).toContainText('Not an AMFI mutual fund.');
    await expect(row).not.toContainText('0.00%');
  });

  test('shows an error on a provider failure and recovers on retry', async ({
    authedPage: page,
    api,
  }) => {
    const first = await seedFund(api);
    const second = await seedFund(api);
    const endpoint = '**/investments/performance/funds/comparison*';
    await page.route(endpoint, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 500, message: 'comparison down' }),
      }),
    );

    await openReportWithFunds(page, [first.label, second.label]);

    const panel = comparisonPanel(page);
    await expect(panel.getByRole('alert')).toContainText(
      'Could not load the fund comparison.',
    );

    await page.unroute(endpoint);
    await panel.getByRole('button', { name: 'Try again' }).click();
    await expect(
      panel.getByTestId(`fund-comparison-${first.id}`),
    ).toBeVisible({ timeout: 15000 });
    await expect(panel.getByRole('alert')).toHaveCount(0);
  });

  test('surfaces the API rate limit and recovers when it clears', async ({
    authedPage: page,
    api,
  }) => {
    const first = await seedFund(api);
    const second = await seedFund(api);
    const endpoint = '**/investments/performance/funds/comparison*';
    await page.route(endpoint, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 429,
          message: 'ThrottlerException: Too Many Requests',
        }),
      }),
    );

    await openReportWithFunds(page, [first.label, second.label]);

    const panel = comparisonPanel(page);
    await expect(panel.getByRole('alert')).toContainText(
      'Could not load the fund comparison.',
    );

    await page.unroute(endpoint);
    await panel.getByRole('button', { name: 'Try again' }).click();
    await expect(panel.getByTestId(`fund-comparison-${second.id}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test('keeps another owner out of the comparison at the API and in the UI', async ({
    api,
    browser,
  }) => {
    const first = await seedFund(api);
    const second = await seedFund(api);

    const otherContext = await browser.newContext();
    try {
      const other = await otherContext.newPage();
      await registerUser(other);

      const res = await rawApiRequest(
        other.request,
        'GET',
        `/investments/performance/funds/comparison?securityIds=${first.id},${second.id}`,
      );
      expect(res.status()).toBe(404);

      await other.goto(REPORT_PATH);
      await expect(
        other.getByRole('button', { name: SELECT_SECURITIES }),
      ).toBeVisible({ timeout: 15000 });
      await other.getByRole('button', { name: SELECT_SECURITIES }).click();
      await expect(other.getByText(first.label, { exact: true })).toHaveCount(0);
      await expect(other.getByText(second.label, { exact: true })).toHaveCount(0);
    } finally {
      await otherContext.close();
    }
  });

  test('redirects an unauthenticated visitor to the login page', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    try {
      const anonymous = await context.newPage();
      await anonymous.goto(REPORT_PATH);
      await expect(anonymous).toHaveURL(/\/login/, { timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test.describe('localized and responsive', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('renders the comparison as cards at phone width, in the chosen language', async ({
      authedPage: page,
      api,
    }) => {
      const first = await seedFund(api);
      const second = await seedFund(api);

      // Switch the reader's language through the real settings control, which
      // persists it and sets the locale cookie.
      await page.goto('/settings');
      const language = page.getByLabel('Language', { exact: true }).first();
      await expect(language).toBeVisible({ timeout: 15000 });
      const saved = page.waitForResponse(
        (res) =>
          res.url().includes('/users/preferences') &&
          res.request().method() === 'PATCH' &&
          res.ok(),
      );
      await language.selectOption('hi');
      await saved;

      await page.goto(REPORT_PATH);
      const trigger = page.getByRole('button', {
        name: 'प्रतिभूतियाँ चुनें...',
      });
      await expect(trigger).toBeVisible({ timeout: 15000 });
      for (const fund of [first, second]) {
        await trigger.click();
        await page.getByText(fund.label, { exact: true }).click();
        await trigger.click();
      }

      const panel = page.getByRole('region', { name: 'फंड तुलना' });
      await expect(panel).toBeVisible({ timeout: 15000 });
      await expect(
        panel.getByRole('heading', { name: 'अवर्गीकृत' }),
      ).toBeVisible();

      // The phone layout is the same table rendered as stacked cards, inside
      // the page rather than beside it.
      await expect(panel).toHaveAttribute('data-testid', 'fund-comparison');
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
});
