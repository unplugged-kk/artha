// Accessibility audit of the running app: axe-core (WCAG 2.0/2.1/2.2 A and AA) over six
// pages, in light, dark and phone width, as the demo user.
//
//   node scripts/a11y-audit.cjs <output-dir> [label]
//
// Needs a running app with demo data, and Playwright resolvable from here (the
// sandbox ships it; elsewhere `npm i -D playwright` in a scratch directory).
//   BASE_URL     default http://localhost:3000
//   AUDIT_USER   default demo@artha.local   AUDIT_PASS   default Demo123!
// Start the backend with RATE_LIMIT_MAX=100000: login is rate limited, and a
// throttled login lands on the login page, which this script refuses to audit
// (it exits 2 instead). An audit of the wrong page reads as an improvement.
// Exit code: 0 clean, 1 violations, 2 could not log in.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const USER_ = process.env.AUDIT_USER || 'demo@artha.local';
const PASS_ = process.env.AUDIT_PASS || 'Demo123!';
const fs = require('fs');
(async () => {
  const [out, label] = [process.argv[2], process.argv[3] || 'baseline'];
  const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [__dirname + '/../frontend', __dirname + '/../frontend/node_modules'] }), 'utf8');
  const browser = await chromium.launch();
  const pages = [['dashboard', '/dashboard'], ['transactions', '/transactions'], ['accounts', '/accounts'], ['reports', '/reports'], ['budgets', '/budgets'], ['settings', '/settings']];
  const modes = [['desktop-light', { width: 1440, height: 900 }, 'light'], ['desktop-dark', { width: 1440, height: 900 }, 'dark'], ['mobile-light', { width: 390, height: 844 }, 'light']];
  const summary = {};
  for (const [mname, vp, scheme] of modes) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, isMobile: mname.startsWith('mobile') });
    const page = await ctx.newPage();
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/email/i).first().fill(USER_);
    await page.locator('input[type=password]').first().fill(PASS_);
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();
    await page.waitForURL(/dashboard|\/$/, { timeout: 60000 }).catch(() => {});
    if (/\/login/.test(page.url())) { console.log('FATAL: login failed (rate limited?); refusing to audit the login page as if it were the app'); process.exit(2); }
    for (const [pname, path] of pages) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      if (/\/login/.test(page.url())) { console.log('FATAL: redirected to /login on ' + path + ' (session lost or rate limited)'); process.exit(2); }
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/${pname}-${mname}.png`, fullPage: false });
      await page.evaluate(axeSrc);
      const res = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      summary[`${pname}/${mname}`] = { violations: res, overflowPx: overflow };
    }
    await ctx.close();
  }
  // bearer:disable javascript_lang_non_literal_fs_filename -- developer-run script; the output directory is the operator's own argv, not request input
  fs.writeFileSync(`${out}/axe-summary.json`, JSON.stringify(summary, null, 2));
  const agg = {};
  for (const [k, v] of Object.entries(summary)) for (const x of v.violations) { agg[x.id] = agg[x.id] || { impact: x.impact, pages: 0, nodes: 0 }; agg[x.id].pages++; agg[x.id].nodes += x.nodes; }
  console.log(label, 'axe rules violated (page-views, total nodes):');
  for (const [id, a] of Object.entries(agg).sort((a, b) => b[1].nodes - a[1].nodes)) console.log(`  ${a.impact.padEnd(8)} ${id}  pages=${a.pages} nodes=${a.nodes}`);
  const ov = Object.entries(summary).filter(([, v]) => v.overflowPx > 0).map(([k, v]) => `${k}:+${v.overflowPx}px`);
  console.log('horizontal overflow:', ov.length ? ov.join(', ') : 'none');
  await browser.close();
  process.exit(Object.keys(agg).length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
