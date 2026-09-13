# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-13 · `main` at **`85e643d82`** · code PR **#12** open on `fm/artha-baseline-fixes-01` · code PR **#13** open on `fm/artha-watchlists-01` · code PR **#14** open on `fm/artha-import-identity-01`

---

## TL;DR

- **Main SHA:** `85e643d82` (PR #11 merged).
- **Active Code PRs:**
  - **PR #12** (`fm/artha-baseline-fixes-01`, commit `0caf0e9be`): Restored green test baseline across frontend and backend.
  - **PR #13** (`fm/artha-watchlists-01`, commit `40fc81aac`): **Priority 7: Watchlists Foundation** — fully implemented user-scoped multi-watchlists, quote retrieval via existing price pipeline, deterministic ordering, and complete frontend management interface.
  - **PR #14** (`fm/artha-import-identity-01`, commit `406632bd7`): **Priority 8: Import Identity & Idempotency** — deterministic cryptographic SHA-256 source record identity, intra-import occurrence ordinals, database-enforced partial unique indexes on `(account_id, import_hash) WHERE import_hash IS NOT NULL`, and atomic savepoint error handling across QIF, OFX, and MNY ingestion pipelines.
- **Test Suite Status:** 100% green across all 51 import suites (1,747 tests passed), unit tests in regular & investment processors, frontend watchlists guards, and migration idempotency.
- **Verification Gates:** TypeScript `typecheck` clean (0 errors), ESLint `lint` clean (0 errors), Docker `verify-schema.sh` passed with zero drift, and full production builds succeed for both backend and frontend.
- **Zero Architectural or Financial Regressions:** No second transaction engine, second ledger, or altered accounting semantics. Existing historical rows remain untouched with nullable `import_hash`.

---

## Current main / repository state

- **Current main SHA:** `85e643d82cc2b1b6201c90eaf7d7238342bbb7fe`
- **Active Code PRs:**
  - **PR #12:** `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`), commit `0caf0e9be`.
  - **PR #13:** `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`), commit `40fc81aac`.
  - **PR #14:** `feat(import): Import Identity & Idempotency (Priority 8)` (`fm/artha-import-identity-01` -> `main`), commit `406632bd7`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing exactly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly four: PR #5 (status), PR #12 (baseline fixes), PR #13 (watchlists foundation), PR #14 (import identity & idempotency).
- **Merged PRs:** PR #1 through #4, PR #6 through #11.

---

## Current mission status

This mission implemented **Priority 8: Import Identity & Idempotency** building directly on top of the watchlists foundation (PR #13) and green baseline (PR #12).

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| Deterministic Canonical Hash | Ad-hoc transfer count matching only | `computeTransactionImportIdentity` and `computeInvestmentImportIdentity` using SHA-256 over normalized canonical fields | **DONE** |
| Database Migration & Schema Parity | No `import_hash` or `source_transaction_id` columns | Additive migration `20260913160000_import_identity.sql` with partial unique indexes on `(account_id, import_hash) WHERE import_hash IS NOT NULL` and `schema.sql` parity | **DONE** |
| Legitimate Repeated Records | Collided or duplicated on identical date/amount/payee | Handled via source IDs (OFX `FITID`, bank ref/check numbers) or sequential intra-batch ordinals (`ord:1`, `ord:2`) | **DONE** |
| Concurrency & Atomic Savepoints | Unhandled constraint crashes aborted import | Catch block handles Postgres `23505` via `isDuplicateImportError`, rolls back savepoint, and marks `skipped++` | **DONE** |
| Multi-format Pipeline Parity | Inconsistent source ID capture | Parsers (OFX FITID extraction) and writers (regular, investment, MNY transactions & trades) compute and store `importHash` | **DONE** |
| Test Coverage & Linters | 0 import identity tests | 20 dedicated identity unit tests + 5 processor integration tests; all 51 import suites (1,747 tests) pass; 0 TS/ESLint errors | **VERIFIED CLEAN** |

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
| Import formats | **DONE** | CSV, QIF, multi-QIF, OFX/QFX, `.mny` | Deterministic parsers with FITID extraction |
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

1. **Idempotent and Deterministic Import Ingestion:** Repeated ingestion of identical bank statements, credit card exports, or broker files (QIF, OFX, CSV, MNY) computes deterministic SHA-256 content hashes, detects existing records, and safely skips duplicates (`skipped++`) without modifying account balances or creating duplicate transactions.
2. **Legitimate Repetition Handling:** Multiple identical transactions on the same date (e.g. two $5 coffees or multiple recurring fees) are distinguished via stable upstream IDs (`FITID`, reference/check numbers) or intra-batch occurrence ordinals (`ord:1`, `ord:2`), ensuring all legitimate items are imported on first ingestion and all skipped on re-import.
3. **Atomic Concurrency Protection:** Database-enforced partial unique index on `(account_id, import_hash) WHERE import_hash IS NOT NULL` prevents double-posting during concurrent or retried imports, with savepoint rollback catching PG `23505` duplicate key errors cleanly.
4. **User-Scoped Watchlists:** Create multiple named watchlists (e.g., Tech Stocks, Dividend Plays, Core Mutual Funds), organize securities with stable order indexing, and view real-time market prices, daily point changes, and percentage changes formatted using native currency rules.
5. **Deterministic Pricing Integrity:** Quotes in watchlists are queried directly from the authoritative pricing pipeline; unpriced securities explicitly report `unavailable` without synthetic zeroes.
6. **Complete Portfolio Valuation & Performance:** Evaluates multi-asset portfolios with mixed currencies, stocks (NSE/BSE/global), and Indian mutual funds using AMFI NAVs and market quotes. Calculates exact XIRR, CAGR, TWR, and realized capital gains.
7. **Read-Side Portfolio Concentration:** Computes Herfindahl-Hirschman Index (HHI), effective number of holdings, and top-1 / top-5 asset concentration across both holdings-only and total-portfolio denominators.
8. **India-First Display & Calendar Support:** Renders figures in Indian numbering (lakhs/crores) under `en-IN`, filters by Indian Fiscal Year (1 April – 31 March), and computes settlement cycles against the Indian trading calendar.
9. **Normalized Financial Import:** Ingests bank and broker transactions while matching merchant aliases across Indian corporate suffixes (`Pvt Ltd`, `LLP`, `Limited`).

---

## Implemented this mission

1. **Deterministic Canonical Identity Utility:** Created `backend/src/import/import-identity.util.ts` providing `computeTransactionImportIdentity`, `computeInvestmentImportIdentity`, `getContentSignatureKey`, and `isDuplicateImportError`.
2. **Database Migration & Partial Unique Indexes:** Created `database/migrations/20260913160000_import_identity.sql` adding nullable `import_hash VARCHAR(64)` and `source_transaction_id VARCHAR(255)` to `transactions` and `investment_transactions`, with partial unique indexes on `(account_id, import_hash) WHERE import_hash IS NOT NULL` and lookup indexes on `(account_id, source_transaction_id)`.
3. **Database Schema Parity & Idempotency:** Updated `database/schema.sql` matching migration changes and verified zero drift via ephemeral Docker Postgres validation (`scripts/verify-schema.sh`).
4. **Entity Model Updates:** Added `importHash?: string | null` and `sourceTransactionId?: string | null` to `Transaction` and `InvestmentTransaction` entities.
5. **OFX Parser Extension:** Extracted `<FITID>` tags in `ofx-parser.ts` into `qifTx.fitid`.
6. **Regular & Investment Processors:**
   - Updated `ImportRegularProcessorService` to sequence intra-import duplicates in `ctx.contentDupCounts`, compute deterministic identities, query DB by `importHash`, and set identity fields on save.
   - Updated `ImportInvestmentProcessorService` to compute investment trade and sleeve cash transfer hashes, deduplicating both investment records and cash movements.
   - Updated `ImportService` multi-account and single-account loops to handle PG `23505` unique violations at savepoint boundaries without aborting remaining transactions.
7. **MNY Importer Alignment:** Updated `write-transactions.ts` and `write-investments.ts` to compute and attach `importHash` and `sourceTransactionId` from Money transaction handles.

---

## Financial correctness

No financial semantics, accounting equations, or transaction lifecycles were modified:
- Existing transactions remain canonical; no secondary ledger or duplicate transaction engine was introduced.
- Existing historical rows remain untouched with nullable `import_hash`.
- Balance adjustments continue to occur only when transactions are successfully imported; skipped duplicates do not mutate account balances.
- Counterpart transfer duplicate counting logic remains fully operational and complementary to content hashing.

---

## Validation

Local validation completed on `fm/artha-import-identity-01` (`406632bd7`):

| Gate | Scope | Result |
|---|---|---|
| Import Test Suite | 51 test files (`npm run test:unit -- import`) | **1,747 passed, 0 failed** |
| Regular Processor Tests | `import-regular-processor.service.spec.ts` | **73 passed, 0 failed** |
| Investment Processor Tests | `import-investment-processor.service.spec.ts` | **87 passed, 0 failed** |
| Import Identity Unit Tests | `import-identity.util.spec.ts` | **20 passed, 0 failed** |
| Frontend Watchlists & Linkified Tests | `watchlists/page.test.tsx`, `linkified-description.guard.test.ts` | **18 passed, 0 failed** |
| Backend Typecheck | `tsc --noEmit -p tsconfig.test.json` | **Clean (0 errors)** |
| Backend Linter | `eslint "{src,apps,libs,test}/**/*.ts"` | **Clean (0 errors, 0 warnings)** |
| Migration Idempotency Lint | `node scripts/migration-lint.mjs` & test | **Clean (189 files, 32 tests passed)** |
| Schema vs Migrations Drift | `scripts/verify-schema.sh` (Docker PostgreSQL 16) | **Clean (zero drift verified)** |
| Backend Production Build | `npm run build` (`nest build`) | **Clean (0 errors)** |
| Frontend Production Build | `npm run build` (`next build`) | **Clean (0 errors)** |

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
3. **Scope of UPI / Payment Method:** Decision needed on whether to add a dedicated `payment_method` or `upi_vpa` field across transactions.
4. **Authoritative Indian Trading Holiday Source:** Establish an automated upstream API for NSE/BSE holidays.

---

## Recommended next mission

With Import Identity & Idempotency (Priority 8) completed, the next mission candidates are:

1. **Option 1: Indian Merchant Seed Reference Data (Priority 5).**
   - Populate common Indian merchants/billers (e.g. Swiggy, Zomato, BESCOM, ACT, Airtel) with alias matching rules once Decision 2 category policy is aligned.
2. **Option 2: Payment Method / UPI VPA Metadata.**
   - Additive transaction metadata for Indian payment methods (UPI, IMPS, NEFT, RTGS).
3. **Option 3: SMS Intake Pipeline (`sms_sender_registry` parser).**
   - Ingest transactional SMS messages from Indian banks with template matching and security sanitization.

---

## Commits / PRs

| Ref | Type | Description | State |
|---|---|---|---|
| `85e643d82` | Merge commit | Merge pull request #11 (`fm/artha-productize-01`) | Merged into `main` |
| `0caf0e9be` | Commit | `fix(tests): restore green test baseline across frontend and backend` | Committed on `fm/artha-baseline-fixes-01` |
| `40fc81aac` | Commit | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` | Committed on `fm/artha-watchlists-01` |
| `406632bd7` | Commit | `feat(import): add deterministic source record identity and idempotent deduplication` | Committed on `fm/artha-import-identity-01` |
| **PR #12** | Code PR | `Fix red baseline across frontend and backend test suites` (`fm/artha-baseline-fixes-01` -> `main`) | **OPEN** |
| **PR #13** | Code PR | `feat(watchlists): add user-scoped watchlists foundation and quote retrieval` (`fm/artha-watchlists-01` -> `main`) | **OPEN** |
| **PR #14** | Code PR | `feat(import): Import Identity & Idempotency (Priority 8)` (`fm/artha-import-identity-01` -> `main`) | **OPEN** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
