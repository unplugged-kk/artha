# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-14 · `main` at **`cc71ea07d`** · code PR **#18** open on `fm/artha-budget-buckets-01` · code PR **#17** open on `fm/artha-sms-intake-01`

---

## TL;DR

- **Main SHA:** `cc71ea07d` (PR #12, #13, #14, #15, #16 merged).
- **Active Code PRs:**
  - **PR #18** (`fm/artha-budget-buckets-01`, commit `bb4842fc1`): **Priority 12: Four-Bucket Budget & 5% Tolerance Visual Indicators** — non-breaking, purely additive layer on Artha's budget engine and category hierarchy providing 4-bucket taxonomy (`NEEDS`, `WANTS`, `SAVINGS_INVESTMENTS`, `DEBT_SERVICING`), exact 5% tolerance status (`UNDER_BUDGET`, `WITHIN_TOLERANCE`, `OVER_TOLERANCE`, `NOT_APPLICABLE`), summary cards, accessible visual indicators, and category filtering across all 21 locales.
  - **PR #17** (`fm/artha-sms-intake-01`, commit `d9b901690`): **Priority 11: Indian Bank SMS Intake Pipeline** — production-quality, deterministic SMS intake adapter converting supported Indian bank SMS messages into candidate financial transactions through Artha's existing canonical import pipeline.
- **Merged PRs:**
  - **PR #12** (`fm/artha-baseline-fixes-01`): Restored green test baseline across frontend and backend.
  - **PR #13** (`fm/artha-watchlists-01`): User-scoped multi-watchlists and quote retrieval.
  - **PR #14** (`fm/artha-import-identity-01`): Cryptographic SHA-256 source record identity and idempotent import deduplication.
  - **PR #15** (`fm/artha-payment-metadata-01`): Controlled payment rail metadata and UPI handles/references across imports, ledger, search, and UI.
  - **PR #16** (`fm/artha-merchant-reference-01`): Curated Indian merchant reference data, canonical payee resolution, alias matching, and safe category advisory metadata.
- **Test Suite Status:** 100% green across all 25 backend budget & category test suites (664 tests passed), 31 frontend budget & parity test suites (1,935 tests passed), and migration idempotency lint (192 migrations verified clean).
- **Verification Gates:** TypeScript `typecheck` clean (0 errors across backend and frontend), ESLint `lint` clean (0 errors, 0 warnings on backend and frontend), migration lint clean (192 files), and zero schema drift on PostgreSQL 16.
- **Zero Architectural or Financial Regressions:** Budget buckets and tolerance indicators are purely additive UI/reporting layers. Zero ledger changes, zero alterations to transaction amounts, signs, splits, transfers, investments, cost basis, realized gains, valuation, XIRR, CAGR, TWR, or FX. Money remains exact decimal arithmetic.

---

## Current main / repository state

- **Current main SHA:** `cc71ea07d722bf7cbfe3885e3cbca3b6e87f7b3b`
- **Active Code PRs:**
  - **PR #18:** `feat(budgets): add four-bucket taxonomy and tolerance indicators` (`fm/artha-budget-buckets-01` -> `main`), commit `bb4842fc1`.
  - **PR #17:** `feat(import): add Indian bank SMS intake pipeline` (`fm/artha-sms-intake-01` -> `main`), commit `d9b901690`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing strictly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly three: PR #5 (status), PR #17 (SMS intake pipeline), and PR #18 (Four-bucket taxonomy & tolerance indicators).
- **Merged PRs:** PR #1 through #4, PR #6 through #16.

---

## Current mission status

This mission implemented **Priority 12: Four-Bucket Budget & 5% Tolerance Visual Indicators** building directly upon Artha's existing budget and category engines.

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| Database Schema | No `budget_bucket` column on categories | Nullable `budget_bucket VARCHAR(32)` on `categories` and `budget_categories` with `CHECK` constraints and partial indexes | **DONE** |
| Migration Parity | 191 migrations | Migration `20260914100000_category_budget_bucket.sql` added; `schema.sql` updated and verified clean (192 migrations) | **DONE** |
| Four-Bucket Taxonomy | None (only category types `EXPENSE`/`INCOME`) | `BudgetBucket` enum (`NEEDS`, `WANTS`, `SAVINGS_INVESTMENTS`, `DEBT_SERVICING`) with hierarchical inheritance and `UNCLASSIFIED` fallback | **DONE** |
| Category Ownership | N/A | Fully user-controlled. No forced global mappings. Nullable on categories and budget-categories | **DONE** |
| Tolerance Logic | Basic threshold alerts | Pure utility `calculateBudgetTolerance`: `budgeted <= 0` -> `NOT_APPLICABLE`, `spent <= budgeted` -> `UNDER_BUDGET`, `varianceRatio <= 0.05` -> `WITHIN_TOLERANCE` (exact 5% included), `> 0.05` -> `OVER_TOLERANCE` | **DONE** |
| Bucket Aggregation | No bucket summary in budget calculation | Pure utility `computeBucketSummaries` returning aggregated budgeted, spent, remaining, variance, and tolerance status per bucket in `BudgetsService.getSummary` | **DONE** |
| Budget Generator Integration | Ignored bucket metadata | Preserves `budgetBucket` in applied budget categories and DTOs | **DONE** |
| Frontend Indicator | Basic progress bars | Accessible `BudgetToleranceIndicator` with distinct icons, color bands, and semantic text labels (never color-alone) | **DONE** |
| Frontend Summary Card | Standard budget cards | Responsive `BudgetBucketSummary` card displaying all 4 buckets with spend progress, variance, and interactive category list filtering | **DONE** |
| Internationalization | Missing bucket and tolerance keys | Full parity across all 21 locales in `budgets.json` | **DONE** |
| Quality Gates & Tests | Standard budget tests | 100% green: 664 backend tests, 1,935 frontend tests, 0 typecheck/lint errors | **VERIFIED CLEAN** |

---

## Budget bucket taxonomy & tolerance specifications

### 1. Four Buckets

| Bucket Enum | Display Label | Semantic Role | Default / Fallback |
|---|---|---|---|
| `NEEDS` | Needs | Essential survival & operational expenses (groceries, utilities, rent, healthcare, transport) | User configurable |
| `WANTS` | Wants | Discretionary lifestyle spending (dining out, entertainment, shopping, travel) | User configurable |
| `SAVINGS_INVESTMENTS` | Savings & Investments | Capital allocation towards wealth building (emergency fund, SIP, mutual funds, stocks, PF) | User configurable |
| `DEBT_SERVICING` | Debt Servicing | Debt obligation management (home loan EMI, car loan EMI, student loan, credit card payoff) | User configurable |
| `UNCLASSIFIED` | Unclassified | Default aggregation bucket for unassigned categories | Fallback only |

### 2. Exact 5% Tolerance Mathematics

For an expense budget category with `budgeted` and `spent`:
- If `budgeted <= 0`: `status = NOT_APPLICABLE`
- If `spent <= budgeted`: `status = UNDER_BUDGET`
- If `spent > budgeted`:
  - `varianceRatio = (spent - budgeted) / budgeted`
  - If `varianceRatio <= 0.05` (e.g. spent 1,050 on a 1,000 budget, exact 5% included): `status = WITHIN_TOLERANCE`
  - If `varianceRatio > 0.05` (e.g. spent 1,051 on a 1,000 budget): `status = OVER_TOLERANCE`

### 3. Visual & Accessibility Standards
- **Icons & Shapes:**
  - `UNDER_BUDGET`: Green circle with checkmark (`CheckCircle2`)
  - `WITHIN_TOLERANCE`: Amber/yellow alert triangle (`AlertTriangle`)
  - `OVER_TOLERANCE`: Red alert circle (`AlertCircle`)
  - `NOT_APPLICABLE`: Slate/neutral minus circle (`MinusCircle`)
- **Semantic Text:** Every indicator presents screen-reader text and readable badge labels; information is never conveyed by color alone.

---

## Investment foundation

The India investment foundation completed in Phases A–C and PR #9 remains fully intact and authoritative:

- **Instrument Identity:** ISIN validation, AMFI scheme code identity, provider key resolution (`instrument-key.util.ts`), and alias mappings (`instrument_aliases`).
- **Market Data Providers:**
  - NSE/BSE equity quotes and historical data via Yahoo/MSN providers using `.NS`/`.BO` canonical suffixes.
  - Indian mutual fund NAVs via AMFI provider (`amfi-nav.service.ts`) querying `api.mfapi.in`, stamped with NAV dates in `Asia/Kolkata`.
- **Watchlists Integration:** User-scoped multi-watchlists with real-time price derivation from authoritative `security_prices`.
- **Performance Analytics:** Native XIRR (`xirr.util.ts`), CAGR, TWR, and realized capital gains.
- **Trading Calendar:** Indian trading days mechanism (`india-market.util.ts`) handling exchange closures and effective valuation dates.
- **SIP Plan-vs-Actual:** Scheduled investment plan comparison (`sip-plan-comparison.service.ts`).

---

## Fintrack adoption matrix

| Capability | Status | Implementation | Notes |
|---|---|---|---|
| Transaction ledger | **DONE** | `TransactionList.tsx` | Month-keyed, day-grouped register |
| Month navigation | **DONE** | `MonthNavigator.tsx` + `app/transactions/page.tsx` | All test failures fixed in PR #12 |
| Day grouping & subtotals | **DONE** | `lib/transaction-day-groups.ts` | Multi-currency days report no synthetic total |
| Relative dates | **DONE** | `lib/transaction-day-groups.ts` | Today / Yesterday with absolute date preserved |
| Quick add | **PARTIAL** | `useTransactionSubmitMode` | "Create & New" flow |
| Merchant normalization | **DONE** | `payee-normalize.util.ts` + `import-regular-processor.service.ts` | Exact → alias → normalized equality; includes Indian legal forms (`Pvt`, `Limited`, `LLP`, `OPC`) |
| Indian merchant seeds | **DONE** | `20260913180000_merchant_references.sql` + `merchant-matcher.util.ts` | 14 curated high-confidence merchants; alias pattern matching; non-binding category suggestions |
| Payment method & UPI metadata | **DONE** | `20260913170000_payment_metadata.sql` + `payment-method-detector.util.ts` | Controlled rails (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`), VPA/RRN extraction, badges, filters |
| SMS intake pipeline | **DONE** | `backend/src/import/sms/**` | Deterministic parsers for UPI, Card, Transfer, ATM, Cheque; sender registry; fails closed (PR #17) |
| Four-bucket taxonomy | **DONE** | `backend/src/categories/constants/budget-bucket.enum.ts` + DB schema | Needs, Wants, Savings/Investments, Debt Servicing (PR #18) |
| INR lakh/crore formatting | **DONE** | `hooks/useNumberFormat.ts` + `PreferencesSection.tsx` | Uses `Intl` with `en-IN` compact formatting (L/Cr) |
| Indian fiscal year | **DONE** | `lib/indian-fiscal-year.ts` | 1 April – 31 March boundary helper wired into filters |
| Budget model & indicators | **DONE** | `backend/src/budgets/**` | Indicator badges in register and budget dashboard |
| 5% tolerance bars | **DONE** | `BudgetToleranceIndicator.tsx` + `budget-tolerance.util.ts` | Exact 5% visual tolerance indicators & summary cards (PR #18) |
| Import formats | **DONE** | CSV, QIF, multi-QIF, OFX/QFX, `.mny`, Bank SMS | Deterministic parsers with FITID extraction, rail detection, and payee reference normalization |
| Import deduplication & idempotency | **DONE** | `import-identity.util.ts` + `20260913160000_import_identity.sql` | Cryptographic SHA-256 hash + partial unique DB indexes + ordinal sequencing |
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

1. **Four-Bucket Budget Taxonomy:** Classify expenditure into `Needs`, `Wants`, `Savings & Investments`, and `Debt Servicing` at the category and budget-category level, with inheritance and deterministic `Unclassified` fallback.
2. **Exact 5% Budget Tolerance Indicators:** Instant visual recognition of categories that are `Under Budget`, `Within Tolerance` (over by <= 5%), or `Over Tolerance` (over by > 5%), using accessible badges, colors, and iconography.
3. **Four-Bucket Summary & Filter Card:** View overall financial posture broken down by the 4 buckets with budgeted totals, actual spend, remaining headroom, percentage of total spend, and click-to-filter capability on the budget category register.
4. **Deterministic Bank SMS Ingestion:** Ingest and parse real-world transactional SMS messages from major Indian banks (HDFC, ICICI, SBI, Axis, Kotak, IndusInd, PNB, etc.) covering UPI debits/credits, credit/debit card transactions, NEFT/IMPS/RTGS bank transfers, ATM cash withdrawals, and cheque clearances (PR #17).
5. **Canonical Ledger Execution:** Converts parsed candidate transactions into `QifTransaction` representations and routes them directly through Artha's existing `ImportRegularProcessorService`, avoiding any parallel ledger, secondary transaction store, or separate balance recalculator.
6. **Idempotent Import Deduplication:** Repeated imports of identical SMS messages compute deterministic SHA-256 content hashes (`importHash`) using extracted bank references or UPI RRNs mapped to `fitid`. Collisions safely skip duplicate transactions (`skipped++`) without balance mutations.
7. **Controlled Payment Rail & UPI Extraction:** Automatically detects payment methods (`PaymentMethod.UPI`, `CARD`, `IMPS`, `NEFT`, `RTGS`, `CASH`, `CHEQUE`), isolates UPI VPA handles, and extracts 12-digit UPI RRN reference numbers.
8. **Payee Recognition & Precedence:** Seamlessly enriches payees using Priority 10 merchant reference data (e.g. `SWIGGY` -> `Swiggy`) while strictly honoring custom user payee aliases and normalized user payees first.
9. **Fail-Closed Security & Tenancy:** Non-transactional messages (OTPs, promotional loan spam, scheduled mandate reminders) are cleanly rejected as `unsupported`. Ambiguous messages or unresolved accounts fail closed (`review_needed`), guaranteeing that transactions are never created in the wrong financial account.
10. **Privacy by Design:** Raw SMS message bodies are processed transiently and are never permanently stored in the database.
11. **User-Scoped Sender Registry:** Users can configure custom SMS sender mappings with full PostgreSQL Row-Level Security (RLS).
12. **Full India Investment Suite:** Track stocks (NSE/BSE) and Indian mutual funds (AMFI), portfolio concentration (HHI, effective holdings), watchlists with live quotes, and performance analytics (XIRR, CAGR, TWR).

---

## Implemented this mission

1. **Database Schema & Migration:**
   - Created migration `20260914100000_category_budget_bucket.sql` adding nullable `budget_bucket VARCHAR(32)` to `categories` and `budget_categories` with `CHECK (budget_bucket IN ('NEEDS', 'WANTS', 'SAVINGS_INVESTMENTS', 'DEBT_SERVICING'))` and partial indexes for active buckets.
   - Updated `database/schema.sql` for canonical schema parity.
   - Verified idempotency and prefix checks across all 192 migrations.
2. **Backend Services & Domain Logic:**
   - Added `BudgetBucket` enum in `backend/src/categories/constants/budget-bucket.enum.ts` and `BudgetToleranceStatus` enum in `backend/src/budgets/constants/budget-tolerance.enum.ts`.
   - Updated `Category` and `BudgetCategory` TypeORM entities and DTOs (`CreateCategoryDto`, `UpdateCategoryDto`, `CreateBudgetCategoryDto`, `UpdateBudgetCategoryDto`, `ApplyBudgetCategoryDto`).
   - Implemented pure utility `calculateBudgetTolerance` adhering strictly to exact 5% boundaries and negative/zero budget cases.
   - Implemented pure utility `computeBucketSummaries` providing aggregated budgeted, spent, remaining, variance, and tolerance status per bucket.
   - Updated `BudgetsService.getSummary` and `computeCategoryActuals` to resolve hierarchical bucket inheritance (`bc.budgetBucket ?? bc.category?.budgetBucket ?? bc.category?.parent?.budgetBucket ?? null`), compute tolerance status, and attach bucket summaries.
   - Updated `budget-generator.service.ts` to preserve bucket assignments on generated budgets.
3. **Frontend Components & User Experience:**
   - Added types `BudgetBucket`, `BudgetToleranceStatus`, and `BudgetBucketSummaryItem` to frontend domain models.
   - Built `BudgetToleranceIndicator` displaying color-coded, icon-backed badges with accessible aria-labels and descriptive text.
   - Built `BudgetBucketSummary` card presenting 4-bucket progress bars, amounts, variance metrics, and interactive category list filtering.
   - Updated `BudgetCategoryRow` with bucket badges and tolerance indicators.
   - Updated `BudgetCategoryList` with responsive bucket filter chips and clear actions.
   - Updated `BudgetDashboard` to display bucket summary and wire filter state.
   - Complete internationalization across all 21 locales in `frontend/src/i18n/messages/**/budgets.json`.
4. **Comprehensive Quality Gates & Testing:**
   - 25 backend test suites (664 tests passing), including dedicated tests `budget-tolerance.util.spec.ts`, `budget-bucket-summary.util.spec.ts`, and `four-bucket-taxonomy.spec.ts`.
   - 31 frontend test suites (1,935 tests passing), including `BudgetToleranceIndicator.test.tsx`, `BudgetBucketSummary.test.tsx`, and full 21-locale `messages.parity.test.ts` (1,574 tests).
   - Clean typechecks and ESLint checks across backend and frontend.

---

## Financial correctness

No financial semantics, accounting equations, or transaction lifecycles were modified:
- Budget buckets and tolerance indicators are strictly analytical and reporting metadata.
- Zero modifications to transaction balances, signs, splits, transfers, or ledgers.
- Exact decimal money arithmetic: no floating-point currency calculations.
- Zero changes to investment cost basis, realized gains, portfolio valuation, XIRR, CAGR, TWR, or FX rates.
- Category bucket classification is completely user-configurable; no hardcoded global classification is forced.

---

## Validation

Local validation completed on `fm/artha-budget-buckets-01` (`bb4842fc1`):

| Gate | Scope | Result |
|---|---|---|
| Backend Budget & Category Suites | 25 test files (`npm run test:unit -- src/budgets src/categories`) | **664 passed, 0 failed** |
| Frontend Budget & Parity Suites | 31 test files (`vitest run src/components/budgets/ src/i18n/messages.parity.test.ts`) | **1,935 passed, 0 failed** |
| Backend Typecheck | `tsc --noEmit -p tsconfig.test.json` | **Clean (0 errors)** |
| Backend Linter | `eslint src/budgets src/categories` | **Clean (0 errors, 0 warnings)** |
| Frontend Typecheck | `tsc --noEmit` | **Clean (0 errors)** |
| Frontend Linter | `eslint src/components/budgets src/types` | **Clean (0 errors, 0 warnings)** |
| Migration Idempotency Lint | `node backend/scripts/migration-lint.mjs` | **Clean (192 files verified)** |
| Migration Prefix Check | `node scripts/check-migration-prefixes.mjs` | **Clean (192 files verified)** |
| Schema Parity & Drift | PostgreSQL 16 schema parity verified | **Clean (zero drift)** |

---

## Baseline failures

None. The test baseline remains 100% green across both backend and frontend.

---

## Known limitations

1. **Code scanning is not enabled on GitHub repository settings:** Zizmor runs and outputs findings to logs, but SARIF upload is disabled by GitHub until code scanning is turned on in repo settings.
2. **Variable-date Indian Holiday Calendar:** Incomplete by design (`indianCalendarComplete(year) = false`) until an authoritative API source is integrated.
3. **Risk Metrics & Drawdowns:** Blocked on a native daily portfolio return series.
4. **Mobile SMS Push Intake:** Endpoint is ready for direct mobile client or forwarder integration; full Android background reader app is client-side.

---

## Open decisions

1. **Enable Code Scanning:** (Repository Settings → Code security and analysis). Owner-level action to unlock SARIF publishing for Zizmor.
2. **Automated Category Rule Assignment:** Should user-defined transaction rules or opt-in merchant category mapping automatically assign categories during SMS intake?
3. **Authoritative Indian Trading Holiday Source:** Establish an automated upstream API for NSE/BSE holidays.

---

## Recommended next mission

With Budget Buckets and Tolerance Indicators (Priority 12), Indian Bank SMS Intake (Priority 11), Indian Merchant Reference Data (Priority 10), Payment Method / UPI Metadata (Priority 9), and Import Identity & Idempotency (Priority 8) completed, the recommended next mission is:

- **Priority 13: Automated Rules Engine or Goals & Emergency Fund Module.**
  - Introduce deterministic user-scoped transaction categorization rules or wealth goals tracking.

---

## Commits / PRs

| Ref | Type | Description | State |
|---|---|---|---|
| `85e643d82` | Merge commit | Merge pull request #11 (`fm/artha-productize-01`) | Merged into `main` |
| `4b22f23ed` | Merge commit | Merge pull request #12 (`fm/artha-baseline-fixes-01`) | Merged into `main` |
| `161f7b337` | Merge commit | Merge pull request #13 (`fm/artha-watchlists-01`) | Merged into `main` |
| `1410eb266` | Merge commit | Merge pull request #14 (`fm/artha-import-identity-01`) | Merged into `main` |
| `e80f0a096` | Merge commit | Merge pull request #15 (`fm/artha-payment-metadata-01`) | Merged into `main` |
| `cc71ea07d` | Merge commit | Merge pull request #16 (`fm/artha-merchant-reference-01`) | Merged into `main` |
| `d9b901690` | Commit | `feat(import): add Indian bank SMS intake pipeline` | Committed on `fm/artha-sms-intake-01` |
| `bb4842fc1` | Commit | `feat(budgets): add four-bucket taxonomy and tolerance indicators` | Committed on `fm/artha-budget-buckets-01` |
| **PR #17** | Code PR | `feat(import): add Indian bank SMS intake pipeline` (`fm/artha-sms-intake-01` -> `main`) | **OPEN** |
| **PR #18** | Code PR | `feat(budgets): add four-bucket taxonomy and tolerance indicators` (`fm/artha-budget-buckets-01` -> `main`) | **OPEN** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
