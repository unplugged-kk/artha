import { test, expect, type Page } from '../fixtures';
import { createApiClient, uniqueId, randomCurrencyCode } from '../helpers/api';
import { createTransaction, createCurrency } from '../helpers/factories';
import { E2E_DEFAULT_PASSWORD } from '../helpers/credentials';
import { gotoStable } from '../helpers/nav';

// Foundational Artha journeys that no other spec owns: the first-run onboarding
// and its INR-first default (A), multi-currency display + a persisted currency
// switch (C), navigation integrity across the primary routes (F), the responsive
// drawer (G), and the PWA/runtime surface (H). Transaction-lifecycle (D) and
// transfer (E) semantics are covered by transactions.spec.ts; settings
// persistence by settings.spec.ts.

/** The app's primary navigation destinations (includes the Tools group). */
const PRIMARY_ROUTES: string[] = [
  '/transactions',
  '/bills',
  '/investments',
  '/accounts',
  '/budgets',
  '/reports',
  '/categories',
  '/payees',
  '/institutions',
  '/tags',
  '/securities',
  '/watchlists',
  '/currencies',
  '/rules',
  '/goals',
  '/import',
  '/insights',
  '/ai',
  '/settings',
];

async function expectHealthyPage(page: Page, href: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${href}(\\?|$|#)`));
  // A dead link or an orphan route surfaces as the framework's not-found page.
  await expect(page.getByText(/could not be found|page not found/i)).toHaveCount(
    0,
  );
}

/**
 * Navigate to a route, tolerating a cold Next-dev compile. The service worker
 * answers a navigation that exceeds its 10s budget with its offline page, and
 * the first hit on a route compiles it -- so warm the route through the request
 * context (no worker involved) and retry the guarded navigation if the fallback
 * still appears.
 */
async function gotoRoute(page: Page, href: string): Promise<void> {
  await page.request.get(href).catch(() => undefined);
  for (let attempt = 0; attempt < 3; attempt++) {
    await gotoStable(page, href);
    if ((await page.getByText(/could not reach the server/i).count()) === 0) {
      return;
    }
  }
}

test.describe('Journey A -- new user, INR-first default', () => {
  test('a new user keeps the INR default and reaches a usable dashboard', async ({
    page,
  }) => {
    const email = `e2e-onboard-${uniqueId()}@test.example.com`;

    await page.goto('/register');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/first name/i).fill('E2E');
    await page.getByLabel(/last name/i).fill('Onboard');
    await page.getByLabel(/^password$/i).fill(E2E_DEFAULT_PASSWORD);
    await page.getByLabel(/confirm password/i).fill(E2E_DEFAULT_PASSWORD);
    await page
      .getByRole('button', { name: /create account|register|sign up/i })
      .click();

    // Registration shows an optional 2FA step, then the preferences step.
    const skip = page.getByRole('button', { name: /skip for now/i });
    await expect(skip).toBeVisible({ timeout: 15000 });
    await skip.click();

    // The onboarding step offers both pickers and lists INR.
    const currency = page.getByLabel(/default currency/i);
    await expect(currency).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/^language$/i)).toBeVisible();
    await expect(currency.locator('option[value="INR"]')).toHaveCount(1);

    // Skipping keeps the registration default. That default is INR: the
    // onboarding pre-select is a browser-region guess (USD on this runner), so
    // the assertion is against what the account actually holds.
    await page.getByRole('button', { name: /skip for now/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText('Net Worth').first()).toBeVisible({
      timeout: 15000,
    });

    const api = createApiClient(page.request);
    const prefs = await api.get<{ defaultCurrency: string }>(
      '/users/preferences',
    );
    expect(prefs.defaultCurrency).toBe('INR');

    // Create an account through the UI; the form defaults to the user currency.
    const accountName = `Onboard Acct ${uniqueId()}`;
    await gotoRoute(page, '/accounts');
    await page.getByRole('button', { name: /new account/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/account name/i).fill(accountName);
    await dialog
      .getByLabel(/account type/i)
      .selectOption({ label: 'Chequing' });
    await dialog.getByRole('button', { name: /create account/i }).click();
    await expect(page.locator('tr', { hasText: accountName })).toBeVisible();

    const accounts = await api.get<
      Array<{ id: string; name: string; currencyCode: string }>
    >('/accounts');
    const account = accounts.find((a) => a.name === accountName);
    expect(account?.currencyCode).toBe('INR');

    // A transaction against it, then the register row and the balance agree.
    const payeeName = `Onboard Txn ${uniqueId()}`;
    await createTransaction(api, {
      accountId: account!.id,
      amount: -250,
      payeeName,
      currencyCode: 'INR',
    });

    await gotoRoute(page, '/transactions');
    await expect(page.locator('tr', { hasText: payeeName })).toBeVisible({
      timeout: 15000,
    });

    const balance = await api.get<{ balance: number | string }>(
      `/accounts/${account!.id}/balance`,
    );
    expect(Number(balance.balance)).toBe(-250);

    // ...and the dashboard still renders after the write.
    await gotoRoute(page, '/dashboard');
    await expect(page.getByText('Net Worth').first()).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Journey C -- multi-currency display and a persisted switch', () => {
  test('lists accounts in their own currency and keeps an explicit preference', async ({
    authedPage: page,
    api,
  }) => {
    // The suite installs USD globally; activate it (and a second foreign
    // currency) for THIS user so the Settings picker can offer them --
    // GET /currencies returns the user's activated currencies.
    await createCurrency(api, { code: 'USD', name: 'US Dollar', symbol: '$' });
    const foreign = randomCurrencyCode();
    await createCurrency(api, { code: foreign, name: `Journey C ${foreign}` });

    const inrName = `C INR ${uniqueId()}`;
    const usdName = `C USD ${uniqueId()}`;
    const foreignName = `C ${foreign} ${uniqueId()}`;
    await api.post('/accounts', {
      name: inrName,
      accountType: 'CHEQUING',
      currencyCode: 'INR',
      openingBalance: 1000,
    });
    await api.post('/accounts', {
      name: usdName,
      accountType: 'CHEQUING',
      currencyCode: 'USD',
      openingBalance: 100,
    });
    await api.post('/accounts', {
      name: foreignName,
      accountType: 'CHEQUING',
      currencyCode: foreign,
      openingBalance: 50,
    });

    // Each account is listed under its own currency -- no cross-currency total
    // is fabricated for accounts whose rate is unknown.
    await gotoRoute(page, '/accounts');
    await expect(page.locator('tr', { hasText: inrName })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('tr', { hasText: usdName })).toBeVisible();
    await expect(page.locator('tr', { hasText: foreignName })).toBeVisible();

    // An explicit preference is honoured and survives a reload: it is not
    // silently rewritten to the INR default.
    await gotoRoute(page, '/settings');
    const currency = page.getByLabel('Default Currency');
    await expect(currency).toBeVisible({ timeout: 15000 });
    await currency.selectOption('USD');
    await expect(page.getByText(/preferences saved/i)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Default Currency')).toHaveValue('USD');

    const prefs = await api.get<{ defaultCurrency: string }>(
      '/users/preferences',
    );
    expect(prefs.defaultCurrency).toBe('USD');

    // The dashboard renders with the multi-currency data present.
    await gotoRoute(page, '/dashboard');
    await expect(page.getByText('Net Worth').first()).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Journey F -- navigation integrity', () => {
  test('every primary route resolves for an authenticated user', async ({
    authedPage: page,
  }) => {
    test.setTimeout(240000);
    // The server answers the route itself: a missing page is a 404 and a
    // protected route with no session is a redirect, so a status of 200 is
    // exactly "this destination exists and is reachable".
    for (const href of PRIMARY_ROUTES) {
      const res = await page.request.get(href, { maxRedirects: 0 });
      expect(res.status(), `${href} should answer 200`).toBe(200);
    }
  });

  test('representative routes load, refresh, and survive the browser back button', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180000);
    for (const href of [
      '/transactions',
      '/accounts',
      '/budgets',
      '/reports',
      '/dashboard',
    ]) {
      await gotoRoute(page, href);
      await expectHealthyPage(page, href);
      await page.reload();
      await expectHealthyPage(page, href);
    }

    await page.goBack();
    await expectHealthyPage(page, '/reports');
    await page.goForward();
    await expectHealthyPage(page, '/dashboard');
  });

  test('the active nav item reflects the section a page belongs to', async ({
    authedPage: page,
  }) => {
    await gotoRoute(page, '/accounts');
    const active = page
      .locator('header')
      .getByRole('button', { name: 'Accounts', exact: true })
      .first();
    await expect(active).toHaveClass(/bg-blue-100/);
  });
});

test.describe('Journey G -- responsive shell', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the drawer navigates on a phone viewport', async ({ authedPage: page }) => {
    await gotoRoute(page, '/dashboard');
    await expect(page.getByText('Net Worth').first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole('button', { name: 'Toggle menu' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('navigation', { name: 'Main menu' })).toBeVisible();

    await drawer.getByRole('button', { name: 'Accounts', exact: true }).click();
    await expectHealthyPage(page, '/accounts');
  });
});

test.describe('Journey H -- PWA and runtime surface', () => {
  // No fixtures that authenticate: this is the unauthenticated runtime surface.
  test('serves an Artha manifest, a branded service worker, and guards routes', async ({
    page,
  }) => {
    const manifestRes = await page.request.get('/manifest.webmanifest');
    expect(manifestRes.ok()).toBeTruthy();
    const manifest = (await manifestRes.json()) as {
      name: string;
      short_name: string;
      start_url: string;
      icons: Array<{ src: string; sizes: string }>;
    };
    expect(manifest.name).toContain('Artha');
    expect(manifest.short_name).toBe('Artha');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.map((i) => i.src)).toContain('/icons/icon-192x192.png');

    const swRes = await page.request.get('/sw.js');
    expect(swRes.ok()).toBeTruthy();
    const sw = await swRes.text();
    // The worker's user-visible fallbacks are Artha-branded.
    expect(sw).toContain('Artha');

    // A protected deep link is guarded for an unauthenticated visitor.
    await page.goto('/accounts');
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveTitle(/Artha/);
    await expect(page.getByRole('heading', { name: /sign in to artha/i })).toBeVisible();
  });
});
