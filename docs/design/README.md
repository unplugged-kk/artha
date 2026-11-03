# Artha design: brief, evidence and direction

This is the working design document for the interface. It records what was measured, what was changed because of it, and what is proposed next. The mock in [`mockups/new-ui.html`](mockups/new-ui.html) shows the proposed layout; open it in a browser (add `?theme=dark` for the dark palette, `#register` for the second screen).

## Sources, and what could not be read

Read and used: the XIAS design-doctrine repository (`plugin87/ux-ui-agent-skills`: its taste guide, WCAG checklists and DTCG token conventions) and the `ui-ux-pro-max-skill` reasoning table. Both were read as reference material; none of their scripts or install hooks were run, and no other company's colours, assets or layouts were copied.

Not reachable from the sandbox, so **not used**: the four fintech design articles (design4users.com, theuxda.com, theskinsfactory.com, mcpmarket.com) and the video. Their hosts are outside the session's allowed network domains. If you want them folded in, add the hosts in the environment's network settings and say so.

## The brief

Following the reference doctrine, decide before drawing.

| | |
|---|---|
| Domain | Personal finance for people replacing Microsoft Money: long registers, many accounts, India-first |
| Audience | Experts who return daily. They trust numbers, not decoration |
| Mood | Precise, calm, ledger-like |
| Layout family | Summary first, then drill-down with context kept. The register is the working surface |
| Reference anchor | The reasoning table's banking and personal-finance rows: a trust blue, a restrained gold, accessible and security-first, no playful styling |

## Principles

1. **The number is the product.** Tabular figures, right-aligned, one currency per total. A sign or a word always travels with a colour: money is never red or green alone.
2. **Colour has a budget.** One accent (blue), one highlight (gold, used for the mark and for attention). Spending is not an error, so a routine breakdown is not red.
3. **Accessibility is a gate, not a review comment.** WCAG 2.2 AA is measured on the running app, in light, dark and phone width, and the result is a number that can go down.
4. **Summary, then detail, without losing your place.** Every figure on the dashboard is a doorway to the rows that produced it.
5. **The register comes first on the register page.** The chart is useful and optional; the rows are the job.
6. **Say what you know and what you do not.** An unknown figure is shown as unknown, never as zero (already a rule of the financial code; the interface follows it).
7. **No filler.** No emoji, no marketing verbs, no em dashes in interface copy, no coloured edge on one side of a card, no pure black on pure white.

## Evidence: the running app, measured

axe-core (WCAG 2.0, 2.1 and 2.2, levels A and AA) over six pages (dashboard, transactions, accounts, reports, budgets, settings), each in light, dark and phone width, signed in as the demo user. 18 page-views. Reproduce with `scripts/a11y-audit.cjs`.

| Rule | Elements before | After |
|---|---|---|
| color-contrast | 427 | 2 (fixed afterwards, see below) |
| nested-interactive | 150 | 0 |
| aria-conditional-attr | 21 | 0 |
| button-name (critical) | 3 | 0 |
| label (critical) | 3 | 0 |
| **Total** | **604** | **2** |

The two that remained were gray-400 text in a settings list; they are fixed in the same change, which was verified by test but not re-measured on a fresh build.

### Causes, and where each was fixed

- **Money text.** Gains and losses were Tailwind green-600 and red-600 (3.2:1 and below on a tinted card), at about 340 call sites. The two colours are now defined once in `frontend/src/app/globals.css`, and `money-contrast.test.ts` holds 4.5:1 on the page and card of all 15 palettes in both modes. `money-dark-variant.guard.test.ts` fails a light-only colour, which is how the register's amount cell (the most-read number in the app) had no dark variant.
- **Category chips.** The text colour was the user's colour mixed a fixed 85% toward black or white. For a pale yellow that is 1.2:1 and for a dark navy in dark mode 1.0:1. `frontend/src/lib/category-chip.ts` now moves the colour only as far as needed to reach the target, and `category-chip.test.ts` proves it for every hue on every palette.
- **Nested interactive controls.** The report cards were buttons containing a star that was a `div role="button"`. They are now a wrapper with two sibling buttons, as the frontend rules already prescribe.
- **Disclosure on a table row.** `aria-expanded` is not valid on a plain row. It is now on a real button, which also opens the account groups to the keyboard.
- **Shared components.** Dark-mode primary and danger buttons (white on a 500 shade, 3.8:1), translucent category badges, banner links, and gray-on-gray text.

## Lessons from measuring, worth keeping

- **Audit the right page.** Login is rate limited. After a few runs the login silently failed and every "page" audited was the login screen, which looked like a large improvement. `scripts/a11y-audit.cjs` now exits with an error when it is not signed in. Start the backend with `RATE_LIMIT_MAX=100000` for audits.
- **A clean build before measuring.** An incremental `next build` served an old stylesheet beside new scripts. Delete `.next` before measuring a CSS change.
- **A unit guard reads source; the audit reads pixels.** The token guard passed while the served CSS was stale. Both are needed.

## Built from the proposal

- Transactions opens on the register with the chart folded (remembered per device).
- The top navigation no longer wraps a label onto two lines: measured at 1280 and 1440px, every item is 36px tall and the page does not scroll sideways. A fresh-build axe run over the six pages in light, dark and phone width reported no violations.

- The dashboard opens with a "Where you stand" strip: net worth with its change since last month, assets with debts, and how many bills and deposits fall due in the next 7 days (a count, so no currency is mixed). No data shows as "Not available yet", never zero.

Not built yet: the "Needs your attention" list and the quieter notifications banner.

## Proposed layout (needs your decision)

The mock proposes three changes. None is built yet, because they change what users see and where, and that is yours to judge by eye.

1. **Dashboard: lead with where you stand.** Replace the greeting with three figures (net worth with its change, this month's money in and out, what is due in seven days) and a "Needs your attention" list that surfaces what the new deterministic features already compute: a category above its usual range, a subscription that went up, a bill that will not post by itself. These come from `GET /anomalies` and the existing bills data.
2. **Transactions: register first.** The page now opens on a tall balances chart and the register is below the fold. Fold the chart by default, remembered per view like row density.
3. **Quieter chrome.** The "notifications are blocked" banner sits above the page title; the navigation wraps "Bills and deposits" onto two lines at 1440px.

Say which of these you want, or what to change, and each is a contained piece of work with the audit as its check.

## Definition of done for an interface change

- `scripts/a11y-audit.cjs` reports no new violation, against a clean build.
- Any new colour that carries text is covered by a token or helper with a test, not a literal.
- A new interactive control is a real element with a name; nothing interactive inside a button or a link.
- Copy follows the principle above, and every string is in the catalogs.
