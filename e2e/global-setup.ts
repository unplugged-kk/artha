import { request, type FullConfig } from '@playwright/test';
import { ADMIN_CREDS } from './helpers/admin-creds';

// The app's default-preference currency is INR, so a fresh database is
// guaranteed only that row (CurrenciesService.onApplicationBootstrap). The
// suite's factories default accounts/transactions to USD and several specs name
// it explicitly, and accounts.currency_code has a foreign key to
// currencies(code) -- so USD is installed here, once, as test data rather than
// relying on a startup row the product no longer creates. Runs on the admin's
// authenticated context (currencies are a global catalogue, so one install
// serves every test user).
async function ensureUsdCurrency(
  ctx: Awaited<ReturnType<typeof request.newContext>>,
): Promise<void> {
  await ctx.get('/api/v1/auth/csrf-refresh');
  const { cookies } = await ctx.storageState();
  const raw = cookies.find((c) => c.name === 'csrf_token')?.value;
  const res = await ctx.post('/api/v1/currencies', {
    headers: raw ? { 'X-CSRF-Token': decodeURIComponent(raw) } : {},
    data: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  });
  // 201 on a fresh database; a re-used local database may already have it.
  if (!res.ok() && res.status() !== 409) {
    throw new Error(
      `USD currency setup failed (${res.status()}): ${await res.text()}`,
    );
  }
}

// The first user ever registered becomes an admin (AuthService: role is "admin"
// when userCount === 0). The e2e stack starts with a fresh DB, so registering
// the fixed admin here -- before any test runs -- yields a known admin account.
// No credentials are written to disk; the admin fixture imports ADMIN_CREDS.
async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ||
    process.env.BASE_URL ||
    'http://localhost:3001';

  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/v1/auth/register', { data: ADMIN_CREDS });
  // Read the body BEFORE dispose -- afterwards text() throws "Response has
  // been disposed", which used to mask the real failure on re-used databases.
  const ok = res.ok();
  const status = res.status();
  const body = ok ? '' : await res.text();

  // A fresh CI database makes this the first user (=> admin). On a re-used
  // local database the account may already exist, which is fine; any other
  // failure is fatal.
  if (!ok) {
    if (status !== 409 && !/already (exists|registered|in use)/i.test(body)) {
      await ctx.dispose();
      throw new Error(`Admin registration failed (${status}): ${body}`);
    }
  } else {
    await ensureUsdCurrency(ctx);
  }

  await ctx.dispose();
}

export default globalSetup;
