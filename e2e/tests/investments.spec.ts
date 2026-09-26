import { test, expect } from '../fixtures';
import {
  createInvestmentAccountPair,
  createSecurity,
  createInvestmentTransaction,
} from '../helpers/factories';
import { uniqueId } from '../helpers/api';

// Investments portfolio view. Preconditions (account pair, security, trades)
// are seeded through the API; one test also drives the transaction form in the
// UI. The holdings roll-up renders one collapsed row per brokerage account --
// the backend strips the " - Brokerage" suffix from the displayed name (see
// PortfolioCalculationService), and the row's "N position(s)" count is the
// honest signal that a trade actually rolled into a holding (the account row
// itself shows even with zero holdings).
test.describe('Investments', () => {
  test('shows the investments page chrome', async ({ authedPage: page }) => {
    await page.goto('/investments');

    await expect(
      page.getByRole('heading', { name: 'Investments' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /\+ New Transaction/i }),
    ).toBeVisible();
  });

  test('rolls a seeded BUY up into the holdings view', async ({
    authedPage: page,
    api,
  }) => {
    const name = `Invest ${uniqueId()}`;
    const pair = await createInvestmentAccountPair(api, { name });
    const security = await createSecurity(api, { name: `Held ${uniqueId()}` });
    await createInvestmentTransaction(api, {
      accountId: pair.brokerageAccount.id,
      fundingAccountId: pair.cashAccount.id,
      securityId: security.id,
      action: 'BUY',
      quantity: 10,
      price: 100,
    });

    await page.goto('/investments');

    await expect(
      page.getByRole('heading', { name: 'Holdings by Account' }),
    ).toBeVisible({ timeout: 15000 });
    // The display name has the " - Brokerage" suffix stripped; the position
    // count proves the BUY produced a holding rather than just an empty account.
    const accountHeader = page.locator('button', { hasText: name }).first();
    await expect(accountHeader).toBeVisible();
    await expect(accountHeader).toContainText('1 position');
  });

  test('keeps holdings after a reload (persistence)', async ({
    authedPage: page,
    api,
  }) => {
    const name = `Invest ${uniqueId()}`;
    const pair = await createInvestmentAccountPair(api, { name });
    const security = await createSecurity(api, { name: `Held ${uniqueId()}` });
    await createInvestmentTransaction(api, {
      accountId: pair.brokerageAccount.id,
      fundingAccountId: pair.cashAccount.id,
      securityId: security.id,
      action: 'BUY',
      quantity: 5,
      price: 50,
    });

    await page.goto('/investments');
    await expect(
      page.locator('button', { hasText: name }).first(),
    ).toContainText('1 position', { timeout: 15000 });

    await page.reload();
    await expect(
      page.locator('button', { hasText: name }).first(),
    ).toContainText('1 position', { timeout: 15000 });
  });

  test('records a BUY through the transaction form', async ({
    authedPage: page,
    api,
  }) => {
    // The account pair and security are seeded; the trade itself is entered in
    // the UI. The transaction form uses native selects (not comboboxes), so the
    // dropdowns are driven with selectOption by id.
    const name = `Invest ${uniqueId()}`;
    const pair = await createInvestmentAccountPair(api, { name });
    const security = await createSecurity(api, {
      symbol: `Z${uniqueId().slice(-5).toUpperCase()}`,
      name: `Traded ${uniqueId()}`,
    });

    await page.goto('/investments');
    await page.getByRole('button', { name: /\+ New Transaction/i }).click();
    await page.getByRole('button', { name: 'Investment Transaction' }).click();

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'New Investment Transaction' }),
    ).toBeVisible();
    await dialog.getByLabel('Brokerage Account').selectOption(pair.brokerageAccount.id);
    await dialog.getByLabel('Transaction Type').selectOption('BUY');
    await dialog.getByLabel('Security').selectOption(security.id);
    await dialog.getByLabel('Quantity (Shares)').fill('10');
    await dialog.getByLabel(/Price per Share/).fill('100');
    await dialog.getByRole('button', { name: 'Create Transaction' }).click();

    // The new position rolls into the holdings view.
    const accountHeader = page.locator('button', { hasText: name }).first();
    await expect(accountHeader).toContainText('1 position', { timeout: 15000 });
  });
});

// Concentration is measured by the server from the same allocation the chart
// draws; the page only renders it. Each test runs as a fresh user whose default
// currency is INR, and everything below is INR, so no exchange rate is involved
// and every figure is exact.
test.describe('Portfolio concentration', () => {
  test('shows the concentration the server measured, and keeps it after a reload', async ({
    authedPage: page,
    api,
  }) => {
    const pair = await createInvestmentAccountPair(api, {
      name: `Conc ${uniqueId()}`,
      currencyCode: 'INR',
      openingBalance: 10000,
    });
    const alpha = await createSecurity(api, {
      name: `Alpha ${uniqueId()}`,
      currencyCode: 'INR',
    });
    const beta = await createSecurity(api, {
      name: `Beta ${uniqueId()}`,
      currencyCode: 'INR',
    });
    // 60 x 100 and 20 x 100, both paid from the linked cash account:
    // holdings 6000 + 2000, cash 10000 - 8000 = 2000.
    for (const [security, quantity] of [
      [alpha, 60],
      [beta, 20],
    ] as const) {
      await createInvestmentTransaction(api, {
        accountId: pair.brokerageAccount.id,
        fundingAccountId: pair.cashAccount.id,
        securityId: security.id,
        action: 'BUY',
        quantity,
        price: 100,
      });
    }

    // The server's answer is the authority the page must match.
    const summary = await api.get<{
      concentration: {
        status: string;
        currencyCode: string;
        holdings: { positions: number; top1Percent: number; herfindahl: number } | null;
        portfolio: { positions: number; top1Percent: number; herfindahl: number } | null;
      };
    }>('/portfolio/summary');
    expect(summary.concentration.status).toBe('complete');
    expect(summary.concentration.currencyCode).toBe('INR');
    expect(summary.concentration.holdings).toMatchObject({ positions: 2, top1Percent: 75 });
    expect(summary.concentration.holdings!.herfindahl).toBeCloseTo(0.625, 10);
    expect(summary.concentration.portfolio).toMatchObject({ positions: 3, top1Percent: 60 });
    expect(summary.concentration.portfolio!.herfindahl).toBeCloseTo(0.44, 10);

    const assertCard = async () => {
      const card = page.getByRole('region', { name: 'Concentration' });
      await expect(card).toBeVisible({ timeout: 15000 });
      const cells = (key: string) =>
        card.getByTestId(`concentration-${key}`).getByRole('cell');
      await expect(cells('effective')).toHaveText(['1.6 of 2', '2.3 of 3']);
      await expect(cells('top1')).toHaveText(['75.0%', '60.0%']);
      await expect(cells('top5')).toHaveText(['100.0%', '100.0%']);
      await expect(cells('hhi')).toHaveText(['0.625', '0.440']);
      // Largest positions, largest first; cash is not a position.
      const positions = card.getByTestId('concentration-position');
      await expect(positions).toHaveCount(2);
      await expect(positions.nth(0)).toContainText(alpha.name);
      await expect(positions.nth(0)).toContainText('75.0%');
      await expect(positions.nth(1)).toContainText(beta.name);
      await expect(positions.nth(1)).toContainText('25.0%');
      await expect(card.getByRole('status')).toHaveCount(0);
    };

    await page.goto('/investments');
    await assertCard();
    await page.reload();
    await assertCard();
  });

  test('reports the holdings basis as not available when only cash is held', async ({
    authedPage: page,
    api,
  }) => {
    await createInvestmentAccountPair(api, {
      name: `Cash only ${uniqueId()}`,
      currencyCode: 'INR',
      openingBalance: 5000,
    });

    await page.goto('/investments');
    const card = page.getByRole('region', { name: 'Concentration' });
    await expect(card).toBeVisible({ timeout: 15000 });
    // No priced position: the securities-only basis has no measure -- it is
    // "not available", never a zero -- while the cash-inclusive basis is one slice.
    await expect(
      card.getByTestId('concentration-top1').getByRole('cell'),
    ).toHaveText(['Not available', '100.0%']);
    await expect(card.getByTestId('concentration-position')).toHaveCount(0);
  });
});
