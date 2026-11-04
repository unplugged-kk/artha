# Competitor scan and feature gaps

Scope and honesty. This is a desk scan from search results, not hands-on testing of the other products. Most sources were affiliate roundups and forum threads, so treat prices and claims as indicative and check each vendor before quoting. Nothing here was verified by using the competitor.

## What the scan found

| Product | Position (per the sources) | Gap it leaves |
|---|---|---|
| YNAB | Zero-based budgeting, behaviour change. Roughly 99 to 109 USD a year | Steep learning curve, slow to add features |
| Monarch Money | Households and shared planning, about 100 USD a year, no free tier | Paid only |
| Copilot Money | Apple-first, learning categorisation, about 95 USD a year | Platform-limited |
| Quicken Simplifi / Classic | Spending plans / legacy desktop | Subscription, desktop-era model |
| Firefly III | Free, self-hosted, double entry | Documents that it will not track stocks or a portfolio, so net worth is wrong without a second tool |
| Actual Budget | Praised for ease and bank sync (SimpleFIN) | No dedicated mobile app, limited multi-currency (per one comparison) |
| Maybe / Sure | Polished, self-hosted | Cumbersome tagging and categorising (one user) |
| Wallet by BudgetBakers | Manual budgeting, bank sync behind premium, 3 accounts free | India-specific features not verified |
| Walnut (India) | SMS reading to auto-categorise | Promotional source, unverified |

Features users said every self-hosted tool lacks: shared expenses that are paid back later, asset tracking for things like a car or a house, mobile-friendly views, and multi-user with private accounts per person. This was one user's wishlist, not a consensus.

## Where Artha already stands (checked in the source)

Present: investments with cost basis and tax lots, multi-currency with FX rate handling, loans and mortgages, scheduled transactions, budgets, reports, rules, tags, attachments and scanning, SMS import, MNY import, delegation and joint accounts, MCP server and AI assistant, India tax and assets modules, backups, PWA with push. Anomaly detection and a coach exist.

Absent (grep found no trace): automatic bank connection of any kind (Plaid, SimpleFIN, India Account Aggregator), and shared-expense or IOU tracking.

## Suggested additions, in order of value for this product

1. **Bank connection through SimpleFIN Bridge.** Self-hosted friendly, read-only, a per-user token, no vendor contract. Actual Budget users cite it as the reason sync works. Fits Artha's self-hosted position better than Plaid.
2. **India Account Aggregator.** The India-first angle. It needs a licensed FIU partner, so it is a business decision before it is an engineering one. Not started.
3. **Shared expenses and IOUs.** A named gap across every self-hosted tool. Smallest useful version: a transaction split with a person, a running balance per person, a settle-up transfer.
4. **Fixed-asset valuation.** The ASSET account type exists. Add a valuation history and a depreciation or manual-revalue flow so a car or house moves net worth over time.
5. **Variable-bill awareness.** Done in this branch for the anomaly list (a variable bill is no longer a price rise). The next step is a forecast that treats a utility as a range.
6. **Per-user private accounts inside a household.** Delegation and joint accounts exist. Confirm a household can mix shared and private accounts and show only the right net worth to each.

## Currency coverage

The catalogue in `backend/src/currencies/currency-metadata.ts` includes INR, USD, AED, SAR, KWD (3 decimals), BHD, OMR, PKR, BDT, EUR, GBP, JPY and others, and a currency is created on demand from it. The demo seed installs 30; AED and the Gulf set are created when first used. See `e2e/tests/multi-currency.spec.ts`.
