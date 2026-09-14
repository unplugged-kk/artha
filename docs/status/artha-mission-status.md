# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-14 · `main` at **`85e643d82`** · code PR **#12** open on `fm/artha-baseline-fixes-01` · code PR **#13** open on `fm/artha-watchlists-01` · code PR **#14** open on `fm/artha-import-identity-01` · code PR **#15** open on `fm/artha-payment-metadata-01` · code PR **#16** open on `fm/artha-merchant-reference-01`

---

## TL;DR

- **Main SHA:** `85e643d82` (PR #11 merged).
- **Active Code PRs:**
  - **PR #12** (`fm/artha-baseline-fixes-01`, commit `0caf0e9be`): Restored green test baseline across frontend and backend.
  - **PR #13** (`fm/artha-watchlists-01`, commit `40fc81aac`): **Priority 7: Watchlists Foundation** — fully implemented user-scoped multi-watchlists, quote retrieval via existing price pipeline, deterministic ordering, and complete frontend management interface.
  - **PR #14** (`fm/artha-import-identity-01`, commit `406632bd7`): **Priority 8: Import Identity & Idempotency** — deterministic cryptographic SHA-256 source record identity, intra-import occurrence ordinals, database-enforced partial unique indexes on `(account_id, import_hash) WHERE import_hash IS NOT NULL`, and atomic savepoint error handling across QIF, OFX, and MNY ingestion pipelines.
  - **PR #15** (`fm/artha-payment-metadata-01`, commit `6f3246b4a`): **Priority 9: Payment Method / UPI Metadata** — controlled descriptive metadata layer for payment rails (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`) and optional UPI metadata (`upi_vpa`, `upi_reference`) across manual entry, CSV/OFX/QIF bank imports, transfers, and bulk updates, with register search, multi-select filtering, and localized next-intl UI badges.
  - **PR #16** (`fm/artha-merchant-reference-01`, commit `a442058ba`): **Priority 10: Indian Merchant Reference Data** — additive curated reference data layer for common Indian merchants and billers, canonical payee name resolution, alias pattern matching with rail stripping and word-boundary safety, RLS-exempt global reference model, backup exclusion, preserving 100% of Priority 8 import identity hashes and Priority 9 payment metadata.
- **Test Suite Status:** 100% green across all 29 payee suites (684 tests passed), 52 import suites (1,769 tests passed), 22 transaction suites (1,113 tests passed), 4 frontend suites (497 tests passed), and migration idempotency lint (191 files, 32 tests passed).
- **Verification Gates:** TypeScript `typecheck` clean (0 errors across backend and frontend), ESLint `lint` clean (0 errors across backend and frontend), Docker `verify-schema.sh` passed with zero drift on PostgreSQL 16, and full production builds succeed.
- **Zero Architectural or Financial Regressions:** Merchant reference data is strictly read-only global metadata. No alterations to income/expense sign conventions, balances, FX completeness, or investment calculations. 100% decoupling from Priority 8 import identity hashes preserves deduplication idempotency. User payees and custom aliases retain absolute precedence over global seeds. Transaction categories are not auto-assigned or mutated (`defaultCategoryId` remains `null`).

---

## Current main / repository state

- **Current main SHA:** `85e643d82cc2b1b6201c90eaf7d7238342bbb7fe`
- **Active Code PRs:**
  - **PR #12:** `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`), commit `0caf0e9be`.
  - **PR #13:** `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`), commit `40fc81aac`.
  - **PR #14:** `feat(import): Import Identity & Idempotency (Priority 8)` (`fm/artha-import-identity-01` -> `main`), commit `406632bd7`.
  - **PR #15:** `feat(transactions): add payment method and UPI metadata` (`fm/artha-payment-metadata-01` -> `main`), commit `6f3246b4a`.
  - **PR #16:** `feat(import): add Indian merchant reference data` (`fm/artha-merchant-reference-01` -> `main`), commit `a442058ba`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing strictly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly six: PR #5 (status), PR #12 (baseline fixes), PR #13 (watchlists foundation), PR #14 (import identity & idempotency), PR #15 (payment method & UPI metadata), PR #16 (Indian merchant reference data).
- **Merged PRs:** PR #1 through #4, PR #6 through #11.

---

## Current mission status

This mission implemented **Priority 10: Indian Merchant Reference Data** building directly on top of the payment metadata foundation (PR #15), import identity foundation (PR #14), watchlists foundation (PR #13), and green baseline (PR #12).

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| Database Schema & Migration | No global merchant reference table | Additive migration `20260913180000_merchant_references.sql` creating `merchant_references` with UUID PK, canonical name, normalized name, aliases array, category suggestion, country code, unique indexes, and 14 curated Indian merchant seeds | **DONE** |
| Schema Parity & RLS Exemption | Table unmanaged in schema & RLS rules | Parity in `database/schema.sql` with `-- rls-exempt: merchant_references`, registered in `rls-exempt-tables.ts`, and excluded from user backup exports in `export-table-queries.ts` | **DONE** |
| Normalization Pipeline Enhancements | Missing OPC corporate suffix; noise tokens lacked rails | Added `OPC` to `BUSINESS_SUFFIXES` and `UPI`, `IMPS`, `NEFT`, `RTGS` to `NOISE_TOKENS` in `payee-normalize.util.ts` | **DONE** |
| Merchant Matcher Utility | No alias pattern matching or reference matcher | Created pure `merchant-matcher.util.ts` supporting case-insensitive wildcard alias matching, payment rail prefix stripping, word-boundary protection against prefix collisions, and exact normalized equality | **DONE** |
| Import Ingestion Precedence | No global reference lookup during payee resolution | Integrated into `ImportRegularProcessorService.resolvePayee` with strict user customization precedence: User exact -> User alias -> User normalized -> Global merchant reference -> Raw payee fallback | **DONE** |
| Import Idempotency Invariance | Unverified impact on import identity hashes | Verified SHA-256 `computeTransactionImportIdentity` uses raw imported payee before normalization; identical hash outputs guarantee 100% deduplication idempotency | **DONE** |
| Category Assignment Safety (Decision 2) | Ambiguity around category creation/mutation | Safe Option C implemented: category suggestions stored purely as descriptive metadata; no transaction categories are assigned or mutated during import (`defaultCategoryId: null`) | **DONE** |
| Test Coverage & Quality Gates | 0 merchant reference tests | 100% green: 29 payee suites (684 tests), 52 import suites (1,769 tests), 27 matcher tests, 10 spec tests, 5 RLS exemption tests, 0 TS/ESLint errors, migration lint clean | **VERIFIED CLEAN** |

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
| Merchant normalization | **DONE** | `payee-normalize.util.ts` + `import-regular-processor.service.ts` | Exact → alias → normalized equality; includes Indian legal forms (`Pvt`, `Limited`, `LLP`, `OPC`) |
| Indian merchant seeds | **DONE** | `20260913180000_merchant_references.sql` + `merchant-matcher.util.ts` | 14 curated high-confidence merchants; alias pattern matching; non-binding category suggestions |
| Payment method & UPI metadata | **DONE** | `20260913170000_payment_metadata.sql` + `payment-method-detector.util.ts` | Controlled rails (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`), VPA/RRN extraction, badges, filters |
| Four-bucket taxonomy | **READY** | Hierarchical categories exist | Additive taxonomy layer |
| INR lakh/crore formatting | **DONE** | `hooks/useNumberFormat.ts` + `PreferencesSection.tsx` | Uses `Intl` with `en-IN` compact formatting (L/Cr) |
| Indian fiscal year | **DONE** | `lib/indian-fiscal-year.ts` | 1 April – 31 March boundary helper wired into filters |
| Budget model & indicators | **DONE** | `backend/src/budgets/**` | Indicator badges in register |
| 5% tolerance bars | **READY** | Budget alert engine | Additive UI visual bands |
| Import formats | **DONE** | CSV, QIF, multi-QIF, OFX/QFX, `.mny` | Deterministic parsers with FITID extraction, rail detection, and payee reference normalization |
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

1. **Curated Indian Merchant Payee Recognition:** Bank statement narrations containing messy Indian corporate or aggregator strings (e.g. `UPI/SWIGGY/PAYU...`, `ZOMATO LIMITED`, `ACT FIBERNET HYD`, `AMAZON PAY INDIA PRIVATE LIMITED`, `BESCOM BANGALORE`) automatically map to clean canonical payee entities (`Swiggy`, `Zomato`, `ACT Fibernet`, `Amazon Pay India`, `BESCOM`) during import.
2. **Strict User Override Precedence:** User-defined payees, user-created aliases, and exact matches take precedence over the global reference dataset. A user's customized naming conventions are never overwritten.
3. **Controlled Payment Method & UPI Metadata Tracking:** Transactions record specific payment rails (`UPI`, `IMPS`, `NEFT`, `RTGS`, `CARD`, `CASH`, `CHEQUE`, `OTHER`) alongside optional UPI handles (`upiVpa`) and references (`upiReference`). Non-UPI payment selections automatically clear extraneous UPI fields.
4. **Automated Rail & VPA Ingestion Extraction:** Bank statements and CSV/OFX/QIF imports automatically inspect narrations, memos, and standard fields to detect payment rails and parse UPI IDs / RRN reference numbers without user intervention.
5. **Register Search & Multi-Rail Filtering:** Filter transactions by one or multiple payment rails simultaneously in the transaction register. Search queries seamlessly match UPI VPAs and UPI reference numbers in addition to payees, memos, notes, and tags.
6. **Idempotent and Deterministic Import Ingestion:** Repeated ingestion of identical bank statements or broker files (QIF, OFX, CSV, MNY) computes deterministic SHA-256 content hashes, detects existing records, and safely skips duplicates (`skipped++`) without modifying account balances or creating duplicate transactions.
7. **Legitimate Repetition Handling:** Multiple identical transactions on the same date are distinguished via stable upstream IDs (`FITID`, reference/check numbers) or intra-batch occurrence ordinals (`ord:1`, `ord:2`), ensuring legitimate records import correctly and all re-imports skip safely.
8. **Atomic Concurrency Protection:** Database-enforced partial unique index on `(account_id, import_hash) WHERE import_hash IS NOT NULL` prevents double-posting during concurrent or retried imports, with savepoint rollback catching PG `23505` duplicate key errors cleanly.
9. **User-Scoped Watchlists:** Create multiple named watchlists, organize securities with stable order indexing, and view real-time market prices, daily point changes, and percentage changes formatted using native currency rules.
10. **Deterministic Pricing Integrity:** Quotes in watchlists are queried directly from the authoritative pricing pipeline; unpriced securities explicitly report `unavailable` without synthetic zeroes.
11. **Complete Portfolio Valuation & Performance:** Evaluates multi-asset portfolios with mixed currencies, stocks (NSE/BSE/global), and Indian mutual funds using AMFI NAVs and market quotes. Calculates exact XIRR, CAGR, TWR, and realized capital gains.
12. **Read-Side Portfolio Concentration:** Computes Herfindahl-Hirschman Index (HHI), effective number of holdings, and top-1 / top-5 asset concentration across both holdings-only and total-portfolio denominators.
13. **India-First Display & Calendar Support:** Renders figures in Indian numbering (lakhs/crores) under `en-IN`, filters by Indian Fiscal Year (1 April – 31 March), and computes settlement cycles against the Indian trading calendar.

---

## Implemented this mission

1. **Additive Schema Migration & Reference Data Population:**
   - Created `database/migrations/20260913180000_merchant_references.sql` defining table `merchant_references` (UUID primary key, `canonical_name`, `normalized_name`, `aliases` text array, `category_suggestion`, `website`, `country_code`, `created_at`, `updated_at`).
   - Added unique indexes `idx_merchant_references_canonical` and `idx_merchant_references_normalized`.
   - Seeded 14 high-confidence Indian merchants and billers: Swiggy, Zomato, Amazon Pay India, Flipkart, Bharti Airtel, Reliance Jio, ACT Fibernet, BESCOM, Tata Power, Uber India, Ola Cabs, IRCTC, Zerodha, Groww.
2. **Schema Parity, RLS Exemption, & Backup Exclusion:**
   - Synchronized `database/schema.sql` with comment `-- rls-exempt: merchant_references`.
   - Registered `merchant_references` in `backend/src/common/db/rls-exempt-tables.ts` with comprehensive architectural rationale (system-wide reference catalog, no user tenant ownership, strictly read-only).
   - Excluded `merchant_references` from user-specific backup exports in `backend/src/backup/export-table-queries.ts`.
3. **Payee Normalization Enhancements:**
   - Added `OPC` (One Person Company) to `BUSINESS_SUFFIXES` in `backend/src/payees/payee-normalize.util.ts`.
   - Added payment rail noise tokens (`UPI`, `IMPS`, `NEFT`, `RTGS`) to `NOISE_TOKENS` in `payee-normalize.util.ts`.
4. **Pure Merchant Matcher Utility:**
   - Created `backend/src/payees/merchant-matcher.util.ts` exposing `matchMerchantReference`, `matchesAliasPattern`, and `stripRailPrefix`.
   - Supports case-insensitive wildcard patterns (e.g. `SWIGGY*`), rail prefix stripping (e.g. `UPI/SWIGGY` -> `SWIGGY`), and word-boundary safety to prevent short prefixes matching unrelated corporate names (e.g. `OLA *` vs `Olam International`).
5. **Import Pipeline Integration & User Override Precedence:**
   - Integrated merchant matching into `ImportRegularProcessorService.resolvePayee`.
   - Strict precedence order preserved:
     1. User exact payee match
     2. User custom `PayeeAlias` match
     3. User normalized payee match
     4. Global merchant reference match (resolves to or creates canonical user payee)
     5. Raw payee fallback
   - Preserved 100% hash stability for Priority 8 import identity hashes (`computeTransactionImportIdentity` uses raw imported string before normalization).
   - Preserved non-assignment safety for Open Decision 2: `defaultCategoryId` remains `null`.

---

## Financial correctness

No financial semantics, accounting equations, or transaction lifecycles were modified:
- Existing user-scoped `payees` remain the single source of truth for transaction payees; no secondary merchant ledger or parallel payee table was introduced.
- Global merchant reference data is strictly read-only reference data.
- User payees and custom aliases retain absolute precedence over global seeds.
- SHA-256 import identity hashes remain identical before and after merchant normalization, guaranteeing 100% idempotency for re-imports.
- Transaction category hierarchies are not mutated or automatically assigned (`defaultCategoryId` remains `null`).
- Zero alterations to income/expense sign conventions, balances, FX completeness, or investment calculations.

---

## Validation

Local validation completed on `fm/artha-merchant-reference-01` (`a442058ba`):

| Gate | Scope | Result |
|---|---|---|
| Payee Test Suite | 29 test files (`npm run test:unit -- payees`) | **684 passed, 0 failed** |
| Import Test Suite | 52 test files (`npm run test:unit -- import`) | **1,769 passed, 0 failed** |
| Merchant Matcher Tests | `backend/src/payees/merchant-matcher.util.spec.ts` | **27 passed, 0 failed** |
| Indian Merchant Spec Tests | `backend/src/payees/indian-merchant-reference.spec.ts` | **10 passed, 0 failed** |
| RLS Exempt Tables Spec | `backend/src/common/db/rls-exempt-tables.spec.ts` | **5 passed, 0 failed** |
| Transaction Test Suite | 22 test files (`npm run test:unit -- transactions`) | **1,113 passed, 0 failed** |
| Frontend Component Tests | `TransactionRow`, `TransactionFilterPanel`, `useTransactionFilters`, `TransactionForm` | **497 passed, 0 failed** |
| Backend Typecheck | `tsc --noEmit -p tsconfig.test.json` | **Clean (0 errors)** |
| Backend Linter | `eslint "{src,apps,libs,test}/**/*.ts"` | **Clean (0 errors, 0 warnings)** |
| Frontend Typecheck | `tsc --noEmit` | **Clean (0 errors)** |
| Frontend Linter | `eslint .` | **Clean (0 errors, 1 warning in sw.js)** |
| Migration Idempotency Lint | `node scripts/migration-lint.mjs` & test | **Clean (191 files, 32 tests passed)** |
| Schema vs Migrations Drift | `scripts/verify-schema.sh` (Docker PostgreSQL 16) | **Clean (zero drift verified)** |

---

## Baseline failures

None. The test baseline remains 100% green across both backend and frontend.

---

## Known limitations

1. **Code scanning is not enabled on GitHub repository settings:** Zizmor runs and outputs findings to logs, but SARIF upload is disabled by GitHub until code scanning is turned on in repo settings.
2. **Payee Category Suggestions are Non-Binding:** Category suggestions in reference data do not auto-categorize imported transactions without user rules (resolved safely per Option C).
3. **Variable-date Indian Holiday Calendar:** Incomplete by design (`indianCalendarComplete(year) = false`) until an authoritative API source is integrated.
4. **Risk Metrics & Drawdowns:** Blocked on a native daily portfolio return series.

---

## Open decisions

1. **Enable Code Scanning:** (Repository Settings → Code security and analysis). Owner-level action to unlock SARIF publishing for Zizmor.
2. **Opt-in Merchant Category Rules:** Should users be able to enable automated category assignment based on `merchant_references.category_suggestion` via a user setting, or should it remain strictly manual/rule-based?
3. **Authoritative Indian Trading Holiday Source:** Establish an automated upstream API for NSE/BSE holidays.

---

## Recommended next mission

With Indian Merchant Reference Data (Priority 10), Payment Method / UPI Metadata (Priority 9), and Import Identity & Idempotency (Priority 8) completed, the next mission candidates are:

1. **Option 1: SMS Intake Pipeline (`sms_sender_registry` parser).**
   - Ingest transactional SMS messages from Indian banks with template matching and security sanitization into the canonical transaction intake pipeline.
2. **Option 2: Four-Bucket Budget & Tolerance Visual Indicators.**
   - Layer the additive 4-bucket budget taxonomy and 5% tolerance bars onto the budget analytics views.
3. **Option 3: Rules Engine for Automated Categorization.**
   - Implement user-defined transaction rules (e.g. if payee matches or payment method matches, auto-assign category/tags).

---

## Commits / PRs

| Ref | Type | Description | State |
|---|---|---|---|
| `85e643d82` | Merge commit | Merge pull request #11 (`fm/artha-productize-01`) | Merged into `main` |
| `0caf0e9be` | Commit | `fix(tests): restore green test baseline across frontend and backend` | Committed on `fm/artha-baseline-fixes-01` |
| `40fc81aac` | Commit | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` | Committed on `fm/artha-watchlists-01` |
| `406632bd7` | Commit | `feat(import): add deterministic source record identity and idempotent deduplication` | Committed on `fm/artha-import-identity-01` |
| `6f3246b4a` | Commit | `feat(transactions): add payment method and UPI metadata` | Committed on `fm/artha-payment-metadata-01` |
| `a442058ba` | Commit | `feat(import): add Indian merchant reference data` | Committed on `fm/artha-merchant-reference-01` |
| **PR #12** | Code PR | `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`) | **OPEN** |
| **PR #13** | Code PR | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`) | **OPEN** |
| **PR #14** | Code PR | `feat(import): Import Identity & Idempotency (Priority 8)` (`fm/artha-import-identity-01` -> `main`) | **OPEN** |
| **PR #15** | Code PR | `feat(transactions): add payment method and UPI metadata` (`fm/artha-payment-metadata-01` -> `main`) | **OPEN** |
| **PR #16** | Code PR | `feat(import): add Indian merchant reference data` (`fm/artha-merchant-reference-01` -> `main`) | **OPEN** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
