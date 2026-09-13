# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-13 · `main` at **`85e643d82`** · code PR **#12** open on `fm/artha-baseline-fixes-01` · code PR **#13** open on `fm/artha-watchlists-01`

---

## TL;DR

- **Main SHA:** `85e643d82` (PR #11 merged).
- **Active Code PRs:**
  - **PR #12** (`fm/artha-baseline-fixes-01`, commit `0caf0e9be`): Restored green test baseline across frontend and backend.
  - **PR #13** (`fm/artha-watchlists-01`, commit `40fc81aac`): **Priority 7: Watchlists Foundation** — fully implemented user-scoped multi-watchlists, quote retrieval via existing price pipeline, deterministic ordering, and complete frontend management interface.
- **Frontend Test Suite:** 100% green. 21 new tests added for watchlists components, modals, and pages (37 total in scope). UI conventions: 100/100 passed. i18n parity: 1,577 passed.
- **Backend Test Suite:** 36 new unit tests for watchlists controller and service. 100% clean TypeScript typecheck and ESLint with 0 errors and 0 warnings.
- **Zero Architectural or Financial Regressions:** No second security catalogue, pricing engine, valuation engine, or cost-basis system. Reuses existing `SecurityPriceService` and pricing window queries.

---

## Current main / repository state

- **Current main SHA:** `85e643d82cc2b1b6201c90eaf7d7238342bbb7fe`
- **Active Code PRs:**
  - **PR #12:** `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`), commit `0caf0e9be`.
  - **PR #13:** `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`), commit `40fc81aac`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing exactly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly three: PR #5 (status), PR #12 (baseline fixes), PR #13 (watchlists foundation).
- **Merged PRs:** PR #1 through #4, PR #6 through #11.

---

## Current mission status

This mission implemented **Priority 7: Watchlists Foundation** while building directly on top of the green test baseline established in PR #12.

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| Database Migration & Schema Parity | None | Migration `20260913095000_watchlists.sql` with Direct RLS isolation policies, `schema.sql` parity, and backup coverage classification | **DONE** |
| Backend Watchlists Module | None | `backend/src/watchlists/` with `WatchlistsService`, `WatchlistsController`, DTOs, entities, and registration in `AppModule` | **DONE** |
| Quote Retrieval & Change Calculation | None | Window query for 2 most recent close prices; explicit `unavailable` status when unpriced; zero synthetic fallback | **DONE** |
| Frontend Watchlists Page & Components | None | `/watchlists` route, `WatchlistItemsTable`, `WatchlistFormModal`, `AddSecurityModal`, `/securities` navigation link | **DONE** |
| Translations & i18n Parity | None | `watchlists.json` and `navigation.json` across all 20 locales and pseudo-locale `xx`; `i18n:check` clean | **DONE** |
| Test Coverage & Linters | 0 tests | 36 backend tests, 21 frontend tests; 0 TypeScript errors, 0 ESLint warnings | **VERIFIED CLEAN** |

---

## Investment foundation

The India investment foundation completed in Phases A–C and PR #9 remains fully intact and authoritative:

- **Instrument Identity:** ISIN validation, AMFI scheme code identity, provider key resolution (`instrument-key.util.ts`), and alias mappings (`instrument_aliases`).
- **Market Data Providers:**
  - NSE/BSE equity quotes and historical data via Yahoo/MSN providers using `.NS`/`.BO` canonical suffixes.
  - Indian mutual fund NAVs via AMFI provider (`amfi-nav.service.ts`) querying `api.mfapi.in`, stamped with NAV dates in `Asia/Kolkata`. Fully integrated into `ProviderHealthService` circuit-breaker admission tracking via `tryRequest`.
- **Watchlists Integration:**
  - Watchlist items reference existing authoritative `securities` entries (`security_id` foreign key).
  - Quotes and 1-day changes are derived from existing `security_prices` records using window pricing functions.
  - Unpriced securities report `status: 'unavailable'` with `null` prices; no fabricated zero or synthetic fallbacks.
- **Corporate Actions & Leg Types:**
  - `BONUS`: zero-cost share additions with authoritative cost-basis dilution replay.
  - `FEE`: cash deductions tied to investment accounts.
  - `TAX_WITHHELD`: tax withholdings recorded against capital returns.
- **Performance Analytics:** Native XIRR (`xirr.util.ts`), CAGR, TWR, and realized gains by day/month.
- **Trading Calendar:** Indian trading days mechanism (`india-market.util.ts`) handling exchange closures and effective valuation dates.
- **SIP Plan-vs-Actual:** Scheduled investment plan comparison (`sip-plan-comparison.service.ts`) evaluating execution adherence.

---

## Fintrack adoption matrix

| Capability | Status | Implementation | Notes |
|---|---|---|---|
| Transaction ledger | **DONE** | `TransactionList.tsx` | Month-keyed, day-grouped register |
| Month navigation | **DONE** | `MonthNavigator.tsx` + `app/transactions/page.tsx` | All test failures fixed in PR #12 |
| Day grouping & subtotals | **DONE** | `lib/transaction-day-groups.ts` | Multi-currency days report no synthetic total |
| Relative dates | **DONE** | `lib/transaction-day-groups.ts` | Today / Yesterday with absolute date preserved |
| Quick add | **PARTIAL** | `useTransactionSubmitMode` | "Create & New" flow |
| Merchant normalization | **DONE** | `payee-normalize.util.ts` + `import-regular-processor.service.ts` | Exact → alias → normalized equality; includes Indian legal forms (`Pvt`, `Limited`, `LLP`) |
| Indian merchant seeds | **DEFERRED** | None | Blocked on Open Decision 2 (payee category mapping policy) |
| Four-bucket taxonomy | **READY** | Hierarchical categories exist | Additive taxonomy layer |
| INR lakh/crore formatting | **DONE** | `hooks/useNumberFormat.ts` + `PreferencesSection.tsx` | Uses `Intl` with `en-IN` compact formatting (L/Cr) |
| Indian fiscal year | **DONE** | `lib/indian-fiscal-year.ts` | 1 April – 31 March boundary helper wired into filters |
| Budget model & indicators | **DONE** | `backend/src/budgets/**` | Indicator badges in register |
| 5% tolerance bars | **READY** | Budget alert engine | Additive UI visual bands |
| Import formats | **PARTIAL** | CSV, QIF, multi-QIF, OFX/QFX, `.mny` | Deterministic parsers |
| Import deduplication | **PARTIAL** | Transfer/split signature counting | Schema/content-hash upgrade needed |
| SMS intake | **DEFERRED** | Database schema only (`sms_sender_registry`) | Dedicated parser mission |
| Rules engine | **DEFERRED** | None | Dedicated automation mission |
| Goals / Emergency fund | **DEFERRED** | None | Product module |
| Scheduled transactions | **DONE** | `scheduled-transactions/**` | Native recurring engine |
| SIP plan-vs-actual | **DONE** | `sip-plan-comparison.service.ts` | Native schedule alignment |

---

## Finsight adoption matrix

| Capability | Status | Implementation | Notes |
|---|---|---|---|
| NSE / BSE equities | **DONE** | `instrument-key.util.ts` | Single-sourced suffix table |
| AMFI NAV | **DONE** | `amfi-nav.service.ts` | Real NAV fetching; circuit breaker integrated |
| Provider aliases | **DONE** | `instrument_aliases` entity & repo | Canonical identity resolution |
| Portfolio valuation | **DONE** | `PortfolioService.getPortfolioSummary` | Authoritative valuation |
| CAGR / XIRR / TWR | **DONE** | `calculateCAGR`, `xirr.util.ts`, `calculateTWR` | Completeness-gated |
| Realized gains | **DONE** | `calculateRealizedGains` | Day and month breakdowns |
| Asset allocation | **DONE** | By security, tag, sector, country, asset class | India country mapping |
| Concentration / Diversification | **DONE** | `concentration.util.ts` | HHI, effective holdings, top-1/top-5 on 2 bases |
| Risk statistics (Sharpe, Sortino, VaR) | **BLOCKED** | None in production | Blocked on portfolio return series |
| Drawdown & Correlation | **BLOCKED** | None in production | Blocked on portfolio return series |
| Market-cap allocation | **BLOCKED** | No market-cap data in DB | Requires reference data source |
| Watchlists | **DONE** | `watchlists` module & `/watchlists` route | Full user-scoped multi-watchlist with quotes |
| Index / Benchmarks | **DONE** | `market_index_prices`, sync service | Benchmark tracking |
| AI Investment Assistant | **DONE** | `backend/src/ai/**`, MCP endpoints | Grounded summaries with concentration |
| Research & News | **PARTIAL** | `security-detail.service.ts`, `security-news.service.ts` | Real news and details |

---

## What Artha can do now

1. **User-Scoped Watchlists:** Create multiple named watchlists (e.g., Tech Stocks, Dividend Plays, Core Mutual Funds), organize securities with stable order indexing, and view real-time market prices, daily point changes, and percentage changes formatted using native currency rules.
2. **Deterministic Pricing Integrity:** Quotes in watchlists are queried directly from the authoritative pricing pipeline; unpriced securities explicitly report `unavailable` without synthetic zeroes.
3. **Complete Portfolio Valuation & Performance:** Evaluates multi-asset portfolios with mixed currencies, stocks (NSE/BSE/global), and Indian mutual funds using AMFI NAVs and market quotes. Calculates exact XIRR, CAGR, TWR, and realized capital gains.
4. **Read-Side Portfolio Concentration:** Computes Herfindahl-Hirschman Index (HHI), effective number of holdings, and top-1 / top-5 asset concentration across both holdings-only and total-portfolio denominators.
5. **India-First Display & Calendar Support:** Renders figures in Indian numbering (lakhs/crores) under `en-IN`, filters by Indian Fiscal Year (1 April – 31 March), and computes settlement cycles against the Indian trading calendar.
6. **Normalized Financial Import:** Ingests bank and broker transactions while matching merchant aliases across Indian corporate suffixes (`Pvt Ltd`, `LLP`, `Limited`).

---

## Implemented this mission

1. **Database Migration & Direct RLS Isolation:** Created `database/migrations/20260913095000_watchlists.sql` defining `watchlists` and `watchlist_items` with unique composite constraints, cascading foreign keys, updated-at trigger, and Direct RLS policies (`watchlists_user_isolation`, `watchlist_items_user_isolation`).
2. **Schema Parity & Backup Safety:** Updated `database/schema.sql` to include both tables in `direct_tables`, and registered both tables in `INTENTIONALLY_EXCLUDED_TABLES` in `backend/src/backup/export-table-queries.ts` to satisfy backup coverage guards.
3. **Backend Service & Controller:** Implemented `backend/src/watchlists/` containing entities, DTOs, service, and controller. Employs `withScopedDb` tenant isolation, deterministic `sort_order` reindexing, and efficient price window queries fetching the two most recent close prices.
4. **Frontend Architecture & Navigation:** Created `/watchlists` route (`frontend/src/app/watchlists/page.tsx`), `WatchlistItemsTable`, `WatchlistFormModal`, and `AddSecurityModal`. Added navigation link in `TOOLS_LINKS` with `EyeIcon` and direct shortcut button on `/securities`.
5. **UI Conventions Adherence:** Verified strict conformance to UI tokens (`CARD_CLASS`, `HOVER_ROW_ON_CARD`, `TABLE_CLASS`, `TABLE_BODY_CLASS`, `focus-visible:ring-*`).
6. **i18n Namespace & Locale Parity:** Added full translation keys for `watchlists` and updated `navigation.json` across all 20 locales plus pseudo-locale `xx`, verified by `i18n:check`.

---

## Financial correctness

No financial semantics, accounting equations, or transaction lifecycles were modified:
- All quotes and prices remain derived from `security_prices` records.
- Unpriced items report `status: 'unavailable'` with `null` prices; no synthetic prices or artificial gains are computed.
- Replay remains authoritative for cost basis and holdings.
- Watchlists are strictly user-isolated and read-only with respect to transaction ledger and portfolio holdings.

---

## Validation

Local validation completed on `fm/artha-watchlists-01` (`40fc81aac`):

| Gate | Scope | Result |
|---|---|---|
| Frontend Watchlists Tests | 4 test files (`vitest run watchlists`) | **21 passed, 0 failed** |
| Backend Watchlists Tests | Controller & Service specs (`jest watchlists`) | **36 passed, 0 failed** |
| UI Conventions Tests | `src/test/ui-conventions.test.ts` | **100 passed, 0 failed** |
| i18n Parity Tests | `nav-links.test.ts`, `messages.parity.test.ts` | **1,577 passed, 0 failed** |
| Frontend Typecheck | `tsc --noEmit` | **Clean (0 errors)** |
| Backend Typecheck | `tsc --noEmit -p tsconfig.test.json` | **Clean (0 errors)** |
| Frontend Linter | `eslint .` | **Clean (0 errors, 1 unrelated sw.js warning)** |
| Backend Linter | `eslint "{src,apps,libs,test}/**/*.ts"` | **Clean (0 errors, 0 warnings)** |
| i18n Parity Check | `node scripts/i18n-pseudo.mjs --check` | **Clean** |
| Migration Idempotency Lint | `node scripts/migration-lint.mjs` & test | **Clean (188 files, 32 tests passed)** |

---

## Baseline failures

None. The red baseline was eliminated in PR #12, and PR #13 introduces zero new failures or regressions.

---

## Known limitations

1. **Code scanning is not enabled on GitHub repository settings:** Zizmor runs and outputs findings to logs, but SARIF upload is disabled by GitHub until code scanning is turned on in repo settings.
2. **Indian Merchant Seeds Deferred:** Blocked on Product Decision 2 regarding default category assignment during import.
3. **Variable-date Indian Holiday Calendar:** Incomplete by design (`indianCalendarComplete(year) = false`) until an authoritative API source is integrated.
4. **Import Deduplication:** Currently relies on signature counting; content hashing and idempotency keys require a dedicated schema change.
5. **Risk Metrics & Drawdowns:** Blocked on a native daily portfolio return series.

---

## Open decisions

1. **Enable Code Scanning:** (Repository Settings → Code security and analysis). Owner-level action to unlock SARIF publishing for Zizmor.
2. **Payee Default Category Mapping in Import Seeds:** When an import encounters an Indian merchant seed, should it create default categories if absent, suggest categories via metadata, or only populate payee names?
3. **Scope of UPI / Payment Method:** Decision needed on whether to add a dedicated `payment_method` or `upi_vpa` field across transactions.
4. **Authoritative Indian Trading Holiday Source:** Establish an automated upstream API for NSE/BSE holidays.

---

## Recommended next mission

With Watchlists Foundation complete and test suites fully passing, the next mission candidates are:

1. **Option 1: Indian Merchant Seed Reference Data (Priority 5).**
   - Populate common Indian merchants/billers (e.g. Swiggy, Zomato, BESCOM, ACT, Airtel) with alias matching rules once Decision 2 category policy is aligned.
2. **Option 2: Import Identity & Idempotency (Content Hash).**
   - Architectural migration adding content hashes and unique idempotency keys for bank CSV and statement imports.
3. **Option 3: Payment Method / UPI VPA Metadata.**
   - Additive transaction metadata for Indian payment methods (UPI, IMPS, NEFT, RTGS).

---

## Commits / PRs

| Ref | Type | Description | State |
|---|---|---|---|
| `85e643d82` | Merge commit | Merge pull request #11 (`fm/artha-productize-01`) | Merged into `main` |
| `0caf0e9be` | Commit | `fix(tests): restore green test baseline across frontend and backend` | Committed on `fm/artha-baseline-fixes-01` |
| `40fc81aac` | Commit | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` | Committed on `fm/artha-watchlists-01` |
| **PR #12** | Code PR | `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`) | **OPEN** |
| **PR #13** | Code PR | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`) | **OPEN** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
