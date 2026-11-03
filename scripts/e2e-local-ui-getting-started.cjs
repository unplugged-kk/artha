// Browser check for the dashboard Getting Started card, using Playwright's bundled Chromium.
// Needs: backend on :3101 (see scripts/e2e-local-boot.sh, which leaves user e2e@example.com in
// database artha_run) and the frontend on :3000 started with PORT=3000 INTERNAL_API_URL=http://localhost:3101
// (an exported PORT=3101 from the backend shell makes 'next dev' collide with the backend).
// Usage: node scripts/e2e-local-ui-getting-started.cjs <screenshot-output-dir>
const { chromium } = require('playwright');
(async () => {
  const SP = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const serverErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.status() >= 500) serverErrors.push(r.status() + ' ' + r.url()); });
  const out = [];
  const check = (name, ok, extra = '') => { out.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email/i).first().fill('e2e@example.com');
  await page.locator('input[type=password]').first().fill('Str0ng!Passw0rd#1');
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();
  await page.waitForURL(/dashboard|\/$/, { timeout: 60000 }).catch(() => {});
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  const heading = page.getByRole('heading', { name: 'Getting Started' });
  await heading.waitFor({ timeout: 60000 }).catch(() => {});
  check('Getting Started card is shown', await heading.isVisible());

  const links = await page.locator('a[href^="/settings"], a[href="/categories"], a[href="/accounts"], a[href="/import"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('href')));
  check('six step links', links.filter((h) => h).length >= 6, JSON.stringify(links));
  check('AI step visible', await page.getByText('Connect an AI provider').isVisible());
  check('Notifications step visible', await page.getByText('Choose notifications').isVisible());
  await page.screenshot({ path: SP + '/dashboard-card.png', clip: { x: 0, y: 60, width: 1280, height: 420 } });

  // keyboard: focus the AI step link and activate it with Enter
  await page.getByText('Connect an AI provider').locator('xpath=ancestor::a').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/settings\/ai/, { timeout: 30000 }).catch(() => {});
  check('AI step navigates to /settings/ai', /\/settings\/ai$/.test(page.url()), page.url());
  const aiHeading = page.getByRole('heading', { name: /AI/ }).first();
  await aiHeading.waitFor({ timeout: 30000 }).catch(() => {});
  check('AI settings page renders', await aiHeading.isVisible());
  await page.screenshot({ path: SP + '/settings-ai.png' });

  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  await heading.waitFor({ timeout: 60000 }).catch(() => {});
  await page.getByText('Choose notifications').click();
  await page.waitForURL(/settings#notifications/, { timeout: 30000 }).catch(() => {});
  check('Notifications step navigates to settings#notifications', /\/settings#notifications$/.test(page.url()), page.url());
  await page.locator('#notifications').waitFor({ timeout: 30000 }).catch(() => {});
  check('Notifications section exists', (await page.locator('#notifications').count()) === 1);
  // let the smooth scroll settle before measuring
  let last = -1, stable = 0;
  for (let i = 0; i < 40 && stable < 4; i++) {
    const y = await page.evaluate(() => window.scrollY);
    stable = y === last ? stable + 1 : 0; last = y;
    await page.waitForTimeout(150);
  }
  const nIn = await page.locator('#notifications').evaluate((el) => { const r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }).catch(() => false);
  check('Notifications section scrolled into view on arrival', nIn, 'scrollY=' + last);
  await page.screenshot({ path: SP + '/settings-notifications.png' });

  // narrow phone width: no horizontal overflow of the card
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  await heading.waitFor({ timeout: 60000 }).catch(() => {});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal scroll at 360px', overflow <= 0, 'overflow=' + overflow);
  await page.screenshot({ path: SP + '/dashboard-card-360.png', clip: { x: 0, y: 60, width: 360, height: 900 } });

  check('no 5xx responses', serverErrors.length === 0, serverErrors.join(' | '));
  const relevant = consoleErrors.filter((e) => !/favicon|manifest|Failed to load resource.*(401|403)/i.test(e));
  check('no console errors', relevant.length === 0, relevant.slice(0, 3).join(' | '));
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.log('SCRIPT ERROR', e.message); process.exit(1); });
