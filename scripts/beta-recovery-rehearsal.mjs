#!/usr/bin/env node
/**
 * Personal-beta recovery rehearsal (runbook B2/B4), SYNTHETIC DATA ONLY.
 *
 *   seed     <baseUrl>                  create the owner and a second tenant with a known dataset
 *   manifest <baseUrl> <out.json>       capture the owner's business-keyed manifest
 *   isolation <baseUrl>                 prove the second tenant sees none of the owner's records
 *   export   <baseUrl> <out.artha>      encrypted application backup of the owner
 *   restore  <baseUrl> <in.artha>       restore that backup as the owner of an empty installation
 *   compare  <a.json> <b.json>          exit 1 on any difference
 *
 * Credentials come from the environment and are never printed:
 * REHEARSAL_OWNER_EMAIL, REHEARSAL_OWNER_PASSWORD, REHEARSAL_TENANT_EMAIL,
 * REHEARSAL_TENANT_PASSWORD, REHEARSAL_BACKUP_PASSWORD.
 *
 * Database ids differ after a restore (every key is remapped), so the manifest
 * names records by business keys: account name, date, signed minor units,
 * payee and an ordinal for identical rows.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
const out = (line) => process.stdout.write(`${line}\n`);
const minor = (value) => Math.round(Number(value) * 100);

/** A cookie-carrying API session with the double-submit CSRF header. */
function session(baseUrl) {
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  async function call(method, path, { json, body, headers = {}, raw = false } = {}) {
    const csrf = jar.get('csrf_token');
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: {
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
        Cookie: cookieHeader(),
        ...headers,
      },
      body: json ? JSON.stringify(json) : body,
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
    if (raw) return Buffer.from(await res.arrayBuffer());
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  return {
    call,
    async signIn(email, password, register = false) {
      if (register) {
        await call('POST', '/auth/register', { json: { email, password, firstName: 'Rehearsal', lastName: 'User' } });
      } else {
        await call('POST', '/auth/login', { json: { email, password } });
      }
      await call('GET', '/auth/csrf-refresh');
    },
  };
}

// A 1x1 PNG standing in for a receipt photo.
const RECEIPT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
  'base64',
);

async function seed(baseUrl) {
  const owner = session(baseUrl);
  await owner.signIn(env('REHEARSAL_OWNER_EMAIL'), env('REHEARSAL_OWNER_PASSWORD'), true);
  const tenant = session(baseUrl);
  await tenant.signIn(env('REHEARSAL_TENANT_EMAIL'), env('REHEARSAL_TENANT_PASSWORD'), true);
  await tenant.call('POST', '/accounts', {
    json: { name: 'Tenant Only Savings', accountType: 'SAVINGS', currencyCode: 'INR', openingBalance: 5000 },
  });

  const s = owner.call;
  const bank = await s('POST', '/accounts', { json: { name: 'Rehearsal Bank', accountType: 'CHEQUING', currencyCode: 'INR', openingBalance: 1000 } });
  const card = await s('POST', '/accounts', { json: { name: 'Rehearsal Card', accountType: 'CREDIT_CARD', currencyCode: 'INR', openingBalance: 0 } });
  const groceries = await s('POST', '/categories', { json: { name: 'Rehearsal Groceries' } });
  const fuel = await s('POST', '/categories', { json: { name: 'Rehearsal Fuel' } });
  const tx = (accountId, transactionDate, amount, payeeName, categoryId) =>
    s('POST', '/transactions', { json: { accountId, transactionDate, amount, currencyCode: 'INR', payeeName, categoryId } });

  const oct = await tx(bank.id, '2026-10-31', -100, 'Synthetic Shop', groceries.id);
  await tx(card.id, '2026-11-01', -40, 'Synthetic Fuel', fuel.id);
  await s('POST', '/transactions/transfer', {
    json: { fromAccountId: bank.id, toAccountId: card.id, transactionDate: '2026-11-02', amount: 40 },
  });
  // Two genuinely identical purchases: both must survive.
  await tx(bank.id, '2026-11-03', -25.5, 'Tea Stall', groceries.id);
  await tx(bank.id, '2026-11-03', -25.5, 'Tea Stall', groceries.id);
  await s('POST', `/transactions/reconcile/${bank.id}`, { json: { transactionIds: [oct.id], reconciledDate: '2026-10-31' } });

  const budget = await s('POST', '/budgets', { json: { name: 'Rehearsal November', periodStart: '2026-11-01', currencyCode: 'INR' } });
  await s('POST', `/budgets/${budget.id}/categories`, { json: { categoryId: groceries.id, amount: 3000 } });

  const form = new FormData();
  form.append('file', new Blob([RECEIPT], { type: 'image/png' }), 'receipt.png');
  await s('POST', `/transactions/${oct.id}/attachments`, { body: form });
  out('seeded owner and second tenant (synthetic)');
}

async function manifest(baseUrl, file) {
  const owner = session(baseUrl);
  await owner.signIn(env('REHEARSAL_OWNER_EMAIL'), env('REHEARSAL_OWNER_PASSWORD'));
  const s = owner.call;
  const accounts = (await s('GET', '/accounts')).filter((a) => !a.isClosed);
  const nameOf = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = [];
  for (const a of accounts) {
    for (let page = 1; ; page++) {
      const { data } = await s('GET', `/transactions?accountIds=${a.id}&limit=200&page=${page}`);
      rows.push(...data);
      if (data.length < 200) break;
    }
  }
  const seen = new Map();
  const transactions = [];
  const attachments = [];
  for (const t of rows.sort((x, y) => `${x.transactionDate}${x.id}`.localeCompare(`${y.transactionDate}${y.id}`))) {
    const base = [nameOf.get(t.accountId), t.transactionDate, minor(t.amount), t.payeeName ?? ''].join('|');
    const ordinal = (seen.get(base) ?? 0) + 1;
    seen.set(base, ordinal);
    const key = `${base}|#${ordinal}`;
    transactions.push({
      key,
      category: t.category?.name ?? null,
      status: t.status,
      transferWith: t.isTransfer ? nameOf.get(t.linkedTransaction?.accountId) ?? 'UNLINKED' : null,
    });
    for (const att of await s('GET', `/transactions/${t.id}/attachments`)) {
      const bytes = await s('GET', `/attachments/${att.id}/download`, { raw: true });
      attachments.push({ transaction: key, filename: att.filename ?? att.originalFilename, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  const monthly = {};
  for (const t of rows) {
    if (t.isTransfer || !t.category) continue;
    const k = `${t.transactionDate.slice(0, 7)}|${t.category.name}`;
    monthly[k] = (monthly[k] ?? 0) + minor(t.amount);
  }
  const budgets = [];
  for (const { id } of await s('GET', '/budgets')) {
    const b = await s('GET', `/budgets/${id}`);
    budgets.push({
      name: b.name,
      currencyCode: b.currencyCode,
      categories: (b.categories ?? [])
        .map((c) => ({ category: c.category?.name ?? null, amount: minor(c.amount) }))
        .sort((x, y) => String(x.category).localeCompare(String(y.category))),
    });
  }
  const result = {
    accounts: accounts
      .map((a) => ({ name: a.name, type: a.accountType, currency: a.currencyCode, balanceMinor: minor(a.currentBalance) }))
      .sort((x, y) => x.name.localeCompare(y.name)),
    transactions: transactions.sort((x, y) => x.key.localeCompare(y.key)),
    monthlyCategoryMinor: Object.fromEntries(Object.entries(monthly).sort()),
    budgets,
    attachments,
  };
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  out(`manifest: ${result.accounts.length} accounts, ${result.transactions.length} postings, ${attachments.length} attachments`);
}

async function isolation(baseUrl) {
  const tenant = session(baseUrl);
  await tenant.signIn(env('REHEARSAL_TENANT_EMAIL'), env('REHEARSAL_TENANT_PASSWORD'));
  const names = (await tenant.call('GET', '/accounts')).map((a) => a.name);
  const leaked = names.filter((n) => n.startsWith('Rehearsal'));
  out(`tenant sees ${names.length} account(s); owner records visible: ${leaked.length}`);
  if (leaked.length > 0) process.exitCode = 1;
}

const b64 = (value) => Buffer.from(value, 'utf8').toString('base64');

async function exportBackup(baseUrl, file) {
  const owner = session(baseUrl);
  await owner.signIn(env('REHEARSAL_OWNER_EMAIL'), env('REHEARSAL_OWNER_PASSWORD'));
  const bytes = await owner.call('POST', '/backup/export', {
    headers: { 'x-export-password': b64(env('REHEARSAL_BACKUP_PASSWORD')) },
    raw: true,
  });
  writeFileSync(file, bytes, { mode: 0o600 });
  out(`exported ${bytes.length} bytes, sha256 ${createHash('sha256').update(bytes).digest('hex')}`);
}

async function restoreBackup(baseUrl, file) {
  const owner = session(baseUrl);
  await owner.signIn(env('REHEARSAL_OWNER_EMAIL'), env('REHEARSAL_OWNER_PASSWORD'));
  const { ticket, header } = await owner.call('POST', '/backup/restore/ticket');
  const result = await owner.call('POST', '/backup/restore', {
    body: readFileSync(file),
    headers: {
      'Content-Type': 'application/octet-stream',
      [header]: ticket,
      'x-restore-password': b64(env('REHEARSAL_OWNER_PASSWORD')),
      'x-backup-password': b64(env('REHEARSAL_BACKUP_PASSWORD')),
    },
  });
  const total = Object.values(result.restored).reduce((a, b) => a + b, 0);
  out(`restore: ${result.message}; ${total} rows; skippedAttachments=${result.skippedAttachments ?? 0}`);
}

function compare(a, b) {
  const left = JSON.parse(readFileSync(a, 'utf8'));
  const right = JSON.parse(readFileSync(b, 'utf8'));
  const diffs = [];
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) diffs.push(key);
  }
  out(diffs.length === 0 ? 'manifests identical' : `manifests differ in: ${diffs.join(', ')}`);
  if (diffs.length > 0) process.exitCode = 1;
}

const [command, ...args] = process.argv.slice(2);
const commands = { seed, manifest, isolation, export: exportBackup, restore: restoreBackup, compare };
if (!commands[command]) {
  process.stderr.write('usage: beta-recovery-rehearsal.mjs seed|manifest|isolation|export|restore|compare ...\n');
  process.exit(2);
}
await commands[command](...args);
