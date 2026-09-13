# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-13 · `main` at **`85e643d82`** · code PR **#12** open on `fm/artha-baseline-fixes-01` · code PR **#13** open on `fm/artha-watchlists-01` · code PR **#14** open on `fm/artha-import-identity-01` · code PR **#15** open on `fm/artha-payment-metadata-01`

---

## TL;DR

- **Main SHA:** `85e643d82` (PR #11 merged).
- **Active Code PRs:**
  - **PR #12** (`fm/artha-baseline-fixes-01`, commit `0caf0e9be`): Restored green test baseline across frontend and backend.
  - **PR #13** (`fm/artha-watchlists-01`, commit `40fc81aac`): **Priority 7: Watchlists Foundation** — fully implemented user-scoped multi-watchlists, quote retrieval via existing price pipeline, deterministic ordering, and complete frontend management interface.
  - **PR #14** (`fm/artha-import-identity-01`, commit `406632bd7`): **Priority 8: Import Identity & Idempotency** — deterministic cryptographic SHA-256 source record identity, intra-import occurrence ordinals, database-enforced partial unique indexes on `(account_id, import_hash) WHERE import_hash IS NOT NULL`, and atomic savepoint error handling across QIF, OFX, and MNY ingestion pipelines.
  - **PR #15** (`fm/artha-payment-metadata-01`, commit `6f3246b4a`): **Priority 9: Payment Method / UPI Metadata** — controlled descriptive metadata layer for payment rails (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`) and optional UPI metadata (`upi_vpa`, `upi_reference`) across manual entry, CSV/OFX/QIF bank imports, transfers, and bulk updates, with register search, multi-select filtering, and localized next-intl UI badges.
- **Test Suite Status:** 100% green across all 22 transaction suites (1,113 tests passed), 52 import suites (1,765 tests passed), 4 modified frontend suites (497 tests passed), and migration idempotency lint (190 files, 32 tests passed).
- **Verification Gates:** TypeScript `typecheck` clean (0 errors), ESLint `lint` clean (0 errors across backend and frontend), Docker `verify-schema.sh` passed with zero drift on PostgreSQL 16, and full production builds succeed.
- **Zero Architectural or Financial Regressions:** Payment method is strictly descriptive metadata; never a second ledger or transaction classifier. No alterations to income/expense sign conventions, balances, FX completeness, or investment calculations. 100% decoupling from Priority 8 import identity hashes preserves deduplication idempotency. Existing historical rows remain untouched with `NULL` payment metadata.

---

## Current main / repository state

- **Current main SHA:** `85e643d82cc2b1b6201c90eaf7d7238342bbb7fe`
- **Active Code PRs:**
  - **PR #12:** `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`), commit `0caf0e9be`.
  - **PR #13:** `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`), commit `40fc81aac`.
  - **PR #14:** `feat(import): Import Identity & Idempotency (Priority 8)` (`fm/artha-import-identity-01` -> `main`), commit `406632bd7`.
  - **PR #15:** `feat(transactions): add payment method and UPI metadata` (`fm/artha-payment-metadata-01` -> `main`), commit `6f3246b4a`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing strictly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly five: PR #5 (status), PR #12 (baseline fixes), PR #13 (watchlists foundation), PR #14 (import identity & idempotency), PR #15 (payment method & UPI metadata).
- **Merged PRs:** PR #1 through #4, PR #6 through #11.

---

## Current mission status

This mission implemented **Priority 9: Payment Method / UPI Metadata** building directly on top of the import identity foundation (PR #14), watchlists foundation (PR #13), and green baseline (PR #12).

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| Database Schema & Migration | No payment rail or UPI columns | Additive migration `20260913170000_payment_metadata.sql` adding nullable `payment_method`, `upi_vpa`, `upi_reference`, check constraint, partial indexes, and `schema.sql` parity | **DONE** |
| Payment Rails & UPI Validation | No payment method enum or constraints | `PaymentMethod` enum (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`), DTO validations, nullification of stale UPI fields on non-UPI rails | **DONE** |
| Bank Ingestion Rail Detection | Ingestion ignored payment rails and UPI VPAs | `payment-method-detector.util.ts` extracting rails, UPI VPAs, and RRNs from bank narrations; OFX/QIF/CSV parser integration | **DONE** |
| Import Idempotency Invariance | Unverified decoupling from import identity | Verified `CanonicalTransactionIdentityInput` remains untouched; import hashes before and after enrichment match 1:1 with zero deduplication regressions | **DONE** |
| Register Search & Multi-rail Filtering | Search ignored UPI fields; no rail filters | `buildTransactionSearchClause` searches `upiVpa`/`upiReference`; controller and services support single `paymentMethod` and multi-rail `paymentMethods` | **DONE** |
| Frontend UX & Localization | No payment inputs, badges, or filters | `TransactionForm` rail selector and conditional UPI inputs, `TransactionRow` badges with VPA tooltip, `TransactionFilterPanel` dropdown & chips, synced across 40+ next-intl catalogs | **DONE** |
| Test Coverage & Quality Gates | 0 payment metadata tests | 100% green: 22 transaction suites (1,113 tests), 52 import suites (1,765 tests), 4 frontend suites (497 tests), 0 TS/ESLint errors, migration lint clean | **VERIFIED CLEAN** |

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
| Payment method & UPI metadata | **DONE** | `20260913170000_payment_metadata.sql` + `payment-method-detector.util.ts` | Controlled rails (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`), VPA/RRN extraction, badges, filters |
| Four-bucket taxonomy | **READY** | Hierarchical categories exist | Additive taxonomy layer |
| INR lakh/crore formatting | **DONE** | `hooks/useNumberFormat.ts` + `PreferencesSection.tsx` | Uses `Intl` with `en-IN` compact formatting (L/Cr) |
| Indian fiscal year | **DONE** | `lib/indian-fiscal-year.ts` | 1 April – 31 March boundary helper wired into filters |
| Budget model & indicators | **DONE** | `backend/src/budgets/**` | Indicator badges in register |
| 5% tolerance bars | **READY** | Budget alert engine | Additive UI visual bands |
| Import formats | **DONE** | CSV, QIF, multi-QIF, OFX/QFX, `.mny` | Deterministic parsers with FITID extraction and rail detection |
| Import deduplication & idempotency | **DONE** | `import-identity.util.ts` + `20260913160000_import_identity.sql` | Cryptographic SHA-256 hash + partial unique DB indexes + ordinal sequencing |
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

1. **Controlled Payment Method & UPI Metadata Tracking:** Transactions record specific payment rails (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`) alongside optional UPI handles (`upiVpa`) and references (`upiReference`). Non-UPI payment selections automatically clear extraneous UPI fields.
2. **Automated Rail & VPA Ingestion Extraction:** Bank statements and CSV/OFX/QIF imports automatically inspect narrations, memos, and standard fields to detect payment rails and parse UPI IDs / RRN reference numbers without user intervention.
3. **Register Search & Multi-Rail Filtering:** Filter transactions by one or multiple payment rails simultaneously in the transaction register. Search queries seamlessly match UPI VPAs and UPI reference numbers in addition to payees, memos, notes, and tags.
4. **Idempotent and Deterministic Import Ingestion:** Repeated ingestion of identical bank statements or broker files (QIF, OFX, CSV, MNY) computes deterministic SHA-256 content hashes, detects existing records, and safely skips duplicates (`skipped++`) without modifying account balances or creating duplicate transactions.
5. **Legitimate Repetition Handling:** Multiple identical transactions on the same date are distinguished via stable upstream IDs (`FITID`, reference/check numbers) or intra-batch occurrence ordinals (`ord:1`, `ord:2`), ensuring legitimate records import correctly and all re-imports skip safely.
6. **Atomic Concurrency Protection:** Database-enforced partial unique index on `(account_id, import_hash) WHERE import_hash IS NOT NULL` prevents double-posting during concurrent or retried imports, with savepoint rollback catching PG `23505` duplicate key errors cleanly.
7. **User-Scoped Watchlists:** Create multiple named watchlists, organize securities with stable order indexing, and view real-time market prices, daily point changes, and percentage changes formatted using native currency rules.
8. **Deterministic Pricing Integrity:** Quotes in watchlists are queried directly from the authoritative pricing pipeline; unpriced securities explicitly report `unavailable` without synthetic zeroes.
9. **Complete Portfolio Valuation & Performance:** Evaluates multi-asset portfolios with mixed currencies, stocks (NSE/BSE/global), and Indian mutual funds using AMFI NAVs and market quotes. Calculates exact XIRR, CAGR, TWR, and realized capital gains.
10. **Read-Side Portfolio Concentration:** Computes Herfindahl-Hirschman Index (HHI), effective number of holdings, and top-1 / top-5 asset concentration across both holdings-only and total-portfolio denominators.
11. **India-First Display & Calendar Support:** Renders figures in Indian numbering (lakhs/crores) under `en-IN`, filters by Indian Fiscal Year (1 April – 31 March), and computes settlement cycles against the Indian trading calendar.

---

## Implemented this mission

1. **Additive Schema Migration & Schema Parity:**
   - Created `database/migrations/20260913170000_payment_metadata.sql` adding nullable columns `payment_method VARCHAR(16)`, `upi_vpa VARCHAR(255)`, `upi_reference VARCHAR(64)` to `transactions`.
   - Added CHECK constraint `chk_transactions_payment_method` validating allowed values (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`).
   - Added partial indexes `idx_transactions_payment_method`, `idx_transactions_upi_vpa`, and `idx_transactions_upi_reference`.
   - Synchronized `database/schema.sql` and verified zero schema drift via `./scripts/verify-schema.sh` on PostgreSQL 16 Docker container.
2. **Backend Entity & DTO Layer:**
   - Defined `PaymentMethod` enum in `backend/src/transactions/entities/payment-method.enum.ts`.
   - Updated `Transaction` entity with `@Column` definitions and types.
   - Updated `CreateTransactionDto`, `UpdateTransactionDto`, `CreateTransferDto`, `UpdateTransferDto`, and `BulkUpdateDto` with `@IsEnum(PaymentMethod)` and optional string validations.
3. **Service Layer & Search Integration:**
   - `TransactionsService`: Persists payment fields, ensures non-UPI methods nullify UPI VPA/reference, and filters queries by `paymentMethods`.
   - `TransactionTransferService`: Symmetrically propagates payment method and UPI metadata across both transfer legs.
   - `TransactionBulkUpdateService`: Allows bulk updating payment method across selected transactions.
   - `buildTransactionSearchClause`: Augmented search query to match `upiVpa` and `upiReference`.
   - `TransactionsController`: Added `paymentMethod` and `paymentMethods` query parameters with validation and exact positional compatibility with service mocks.
4. **Bank Import Extraction & Detector Utility:**
   - Created `backend/src/import/payment-method-detector.util.ts` detecting Indian bank rail patterns (`UPI/`, `IMPS-`, `NEFT-`, `RTGS-`, `POS `, `ATM-`, `CHQ`), extracting UPI VPAs, and isolating 12-digit UPI RRNs.
   - Integrated rail detection into `csv-parser.ts`, `ofx-parser.ts` (mapping `TRNTYPE`), `qif-parser.ts`, and `import-regular-processor.service.ts`.
   - **Idempotency Preservation:** Kept `CanonicalTransactionIdentityInput` completely decoupled from payment metadata, guaranteeing SHA-256 import identity hashes remain identical before and after Priority 9 enrichment.
5. **Frontend UI, Register & Filter Enhancements:**
   - Extended types in `frontend/src/types/transaction.ts` and parameters in `frontend/src/lib/transactions.ts`.
   - `TransactionForm`: Added payment method selector and conditional fields for UPI ID / VPA and UPI Reference when `UPI` is chosen; properly wires into transfers and regular entries.
   - `TransactionRow`: Rendered compact badges (`UPI`, `IMPS`, `CARD`, etc.) in normal and compact table densities, with tooltip displaying VPA when present.
   - `TransactionFilterPanel`: Added multi-select dropdown for payment methods with removable filter chips and active count indicator.
   - `useTransactionFilters`: Hook manages `filterPaymentMethods`, syncing with URL query params, localStorage persistence, and clear filters.
   - `i18n`: Added all translation keys in `frontend/src/i18n/messages/en/transactions.json` and synchronized all 40+ locales with `i18n-pseudo.mjs`.

---

## Financial correctness

No financial semantics, accounting equations, or transaction lifecycles were modified:
- Existing transactions remain canonical; no secondary ledger or duplicate transaction engine was introduced.
- Payment method is descriptive metadata only; never a transaction classifier, transfer engine, or ledger.
- Existing historical rows remain untouched with nullable `payment_method`, `upi_vpa`, and `upi_reference`.
- Zero alterations to income/expense sign conventions, balances, FX completeness, or investment calculations.
- Import idempotency hashes remain identical (100% decoupling from Priority 8 `CanonicalTransactionIdentityInput`), ensuring repeated imports do not produce duplicates.

---

## Validation

Local validation completed on `fm/artha-payment-metadata-01` (`6f3246b4a`):

| Gate | Scope | Result |
|---|---|---|
| Transaction Test Suite | 22 test files (`npm run test:unit -- transactions`) | **1,113 passed, 0 failed** |
| Import Test Suite | 52 test files (`npm run test:unit -- import`) | **1,765 passed, 0 failed** |
| Payment Metadata Tests | `payment-metadata.spec.ts` & `payment-method-detector.util.spec.ts` | **44 passed, 0 failed** |
| Controller Unit Tests | `transactions.controller.spec.ts` | **101 passed, 0 failed** |
| Frontend Component Tests | `TransactionRow`, `TransactionFilterPanel`, `useTransactionFilters`, `TransactionForm` | **497 passed, 0 failed** |
| Backend Typecheck | `tsc --noEmit -p tsconfig.test.json` | **Clean (0 errors)** |
| Backend Linter | `eslint "{src,apps,libs,test}/**/*.ts"` | **Clean (0 errors, 0 warnings)** |
| Frontend Typecheck | `tsc --noEmit` | **Clean (0 errors)** |
| Frontend Linter | `eslint .` | **Clean (0 errors, 1 warning in sw.js)** |
| Migration Idempotency Lint | `node scripts/migration-lint.mjs` & test | **Clean (190 files, 32 tests passed)** |
| Schema vs Migrations Drift | `scripts/verify-schema.sh` (Docker PostgreSQL 16) | **Clean (zero drift verified)** |
| i18n Pseudo-Localization Sync | `node frontend/scripts/i18n-pseudo.mjs --check` | **Clean (exit code 0)** |

---

## Baseline failures

None. The test baseline remains 100% green across both backend and frontend.

---

## Known limitations

1. **Code scanning is not enabled on GitHub repository settings:** Zizmor runs and outputs findings to logs, but SARIF upload is disabled by GitHub until code scanning is turned on in repo settings.
2. **Indian Merchant Seeds Deferred:** Blocked on Product Decision 2 regarding default category assignment during import.
3. **Variable-date Indian Holiday Calendar:** Incomplete by design (`indianCalendarComplete(year) = false`) until an authoritative API source is integrated.
4. **Risk Metrics & Drawdowns:** Blocked on a native daily portfolio return series.

---

## Open decisions

1. **Enable Code Scanning:** (Repository Settings → Code security and analysis). Owner-level action to unlock SARIF publishing for Zizmor.
2. **Payee Default Category Mapping in Import Seeds:** When an import encounters an Indian merchant seed, should it create default categories if absent, suggest categories via metadata, or only populate payee names?
3. **Authoritative Indian Trading Holiday Source:** Establish an automated upstream API for NSE/BSE holidays.

---

## Recommended next mission

With Import Identity & Idempotency (Priority 8) and Payment Method / UPI Metadata (Priority 9) completed, the next mission candidates are:

1. **Option 1: Indian Merchant Seed Reference Data (Priority 5).**
   - Populate common Indian merchants/billers (e.g. Swiggy, Zomato, BESCOM, ACT, Airtel) with alias matching rules once Decision 2 category policy is aligned.
2. **Option 2: SMS Intake Pipeline (`sms_sender_registry` parser).**
   - Ingest transactional SMS messages from Indian banks with template matching and security sanitization into the canonical transaction intake pipeline.
3. **Option 3: Four-Bucket Budget & Tolerance Visual Indicators.**
   - Layer the additive 4-bucket budget taxonomy and 5% tolerance bars onto the budget analytics views.

---

## Commits / PRs

| Ref | Type | Description | State |
|---|---|---|---|
| `85e643d82` | Merge commit | Merge pull request #11 (`fm/artha-productize-01`) | Merged into `main` |
| `0caf0e9be` | Commit | `fix(tests): restore green test baseline across frontend and backend` | Committed on `fm/artha-baseline-fixes-01` |
| `40fc81aac` | Commit | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` | Committed on `fm/artha-watchlists-01` |
| `406632bd7` | Commit | `feat(import): add deterministic source record identity and idempotent deduplication` | Committed on `fm/artha-import-identity-01` |
| `6f3246b4a` | Commit | `feat(transactions): add payment method and UPI metadata` | Committed on `fm/artha-payment-metadata-01` |
| **PR #12** | Code PR | `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`) | **OPEN** |
| **PR #13** | Code PR | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`) | **OPEN** |
| **PR #14** | Code PR | `feat(import): Import Identity & Idempotency (Priority 8)` (`fm/artha-import-identity-01` -> `main`) | **OPEN** |
| **PR #15** | Code PR | `feat(transactions): add payment method and UPI metadata` (`fm/artha-payment-metadata-01` -> `main`) | **OPEN** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
