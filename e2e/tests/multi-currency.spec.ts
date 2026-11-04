import { test, expect } from '../fixtures';
import { createApiClient } from '../helpers/api';
import { createAccount, createTransaction } from '../helpers/factories';
import { uniqueId } from '../helpers/api';

// Accounts in INR, USD, AED and a three-decimal currency (KWD) side by side.
// Currencies are a global catalogue, so the admin installs them once.
const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', decimalPlaces: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimalPlaces: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KWD', decimalPlaces: 3 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
];

test.describe('Multi-currency', () => {
  test.beforeEach(async ({ adminPage }) => {
    const admin = createApiClient(adminPage.request);
    for (const currency of CURRENCIES) {
      // 409 means an earlier test or the seed already installed it.
      await admin.post('/currencies', currency).catch(() => undefined);
    }
  });

  test('holds a balance in each currency without mixing them', async ({ authedPage: page, api }) => {
    const tag = uniqueId();
    const made = [] as Array<{ code: string; id: string; name: string }>;
    for (const { code } of CURRENCIES.slice(0, 5)) {
      const account = await createAccount(api, {
        name: `${code} account ${tag}`,
        currencyCode: code,
        openingBalance: 1000,
      });
      made.push({ code, id: account.id, name: account.name });
    }

    // A spend in each account's own currency.
    for (const { code, id } of made) {
      await createTransaction(api, { accountId: id, amount: -12.5, currencyCode: code });
    }

    for (const { code, id } of made) {
      const account = await api.get<{ currentBalance: number | string; currencyCode: string }>(`/accounts/${id}`);
      expect(account.currencyCode).toBe(code);
      expect(Number(account.currentBalance)).toBeCloseTo(987.5, 4);
    }

    await page.goto('/accounts');
    for (const { name } of made) {
      await expect(page.locator('tr', { hasText: name })).toBeVisible();
    }
  });

  test('keeps three decimals for a dinar', async ({ authedPage: page, api }) => {
    const account = await createAccount(api, {
      name: `KWD precision ${uniqueId()}`,
      currencyCode: 'KWD',
      openingBalance: 0,
    });
    await createTransaction(api, { accountId: account.id, amount: 12.345, currencyCode: 'KWD' });

    const fetched = await api.get<{ currentBalance: number | string }>(`/accounts/${account.id}`);
    expect(Number(fetched.currentBalance)).toBe(12.345);

    await page.goto(`/accounts/${account.id}`);
    await expect(page.getByText(/12[.,]345/).first()).toBeVisible();
  });

  test('refuses a transaction whose currency is not the account currency', async ({ authedPage: page, api }) => {
    void page;
    const account = await createAccount(api, {
      name: `INR only ${uniqueId()}`,
      currencyCode: 'INR',
      openingBalance: 0,
    });
    await expect(
      createTransaction(api, { accountId: account.id, amount: -100, currencyCode: 'USD' }),
    ).rejects.toThrow();

    const fetched = await api.get<{ currentBalance: number | string }>(`/accounts/${account.id}`);
    expect(Number(fetched.currentBalance)).toBe(0);
  });
});
