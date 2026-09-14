# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-14 · `main` at **`cc71ea07d`** · code PR **#19** open on `fm/artha-transaction-rules-01` · code PR **#18** open on `fm/artha-budget-buckets-01` · code PR **#17** open on `fm/artha-sms-intake-01`

---

## TL;DR

- **Main SHA:** `cc71ea07d` (PR #12, #13, #14, #15, #16 merged).
- **Active Code PRs:**
  - **PR #19** (`fm/artha-transaction-rules-01`, commit `38f5ab1df`): **Priority 13: Automated Transaction Categorization Rules Engine** — user-scoped, deterministic rules engine for automated payee normalisation and category assignment across manual transactions and bank intake pipelines. Includes condition builders, stop-processing controls, interactive testing against candidate/recent transactions, batch dry-run application for uncategorized transactions, full management UI at `/rules`, and 100% i18n parity across all 21 locales.
  - **PR #18** (`fm/artha-budget-buckets-01`, commit `bb4842fc1`): **Priority 12: Four-Bucket Budget & 5% Tolerance Visual Indicators** — non-breaking, purely additive layer on Artha's budget engine and category hierarchy providing 4-bucket taxonomy (`NEEDS`, `WANTS`, `SAVINGS_INVESTMENTS`, `DEBT_SERVICING`), exact 5% tolerance status (`UNDER_BUDGET`, `WITHIN_TOLERANCE`, `OVER_TOLERANCE`, `NOT_APPLICABLE`), summary cards, accessible visual indicators, and category filtering across all 21 locales.
  - **PR #17** (`fm/artha-sms-intake-01`, commit `d9b901690`): **Priority 11: Indian Bank SMS Intake Pipeline** — production-quality, deterministic SMS intake adapter converting supported Indian bank SMS messages into candidate financial transactions through Artha's existing canonical import pipeline.
- **Merged PRs:**
  - **PR #12** (`fm/artha-baseline-fixes-01`): Restored green test baseline across frontend and backend.
  - **PR #13** (`fm/artha-watchlists-01`): User-scoped multi-watchlists and quote retrieval.
  - **PR #14** (`fm/artha-import-identity-01`): Cryptographic SHA-256 source record identity and idempotent import deduplication.
  - **PR #15** (`fm/artha-payment-metadata-01`): Controlled payment rail metadata and UPI handles/references across imports, ledger, search, and UI.
  - **PR #16** (`fm/artha-merchant-reference-01`): Curated Indian merchant reference data, canonical payee resolution, alias matching, and safe category advisory metadata.
- **Test Suite Status:** 100% green across all 77 backend test suites for rules, transactions, and import (2,916 tests passed), all frontend rule and parity suites (1,619 tests passed), and migration idempotency lint (192 migrations verified clean).
- **Verification Gates:** TypeScript `typecheck` clean (0 errors across backend and frontend), ESLint `lint` clean (0 errors, 0 warnings on backend and frontend), migration lint clean (192 files), and zero schema drift on PostgreSQL 16.
- **Zero Architectural or Financial Regressions:** The categorization rules engine is purely additive to the transaction workflow. Zero secondary ledgers, zero modifications to transaction amounts, signs, splits, transfers, investments, cost basis, realized gains, valuation, XIRR, CAGR, TWR, or FX. Money arithmetic remains exact decimal arithmetic.

---

## Current main / repository state

- **Current main SHA:** `cc71ea07d722bf7cbfe3885e3cbca3b6e87f7b3b`
- **Active Code PRs:**
  - **PR #19:** `feat(rules): add transaction categorization rules engine` (`fm/artha-transaction-rules-01` -> `main`), commit `38f5ab1df`.
  - **PR #18:** `feat(budgets): add four-bucket taxonomy and tolerance indicators` (`fm/artha-budget-buckets-01` -> `main`), commit `bb4842fc1`.
  - **PR #17:** `feat(import): add Indian bank SMS intake pipeline` (`fm/artha-sms-intake-01` -> `main`), commit `d9b901690`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing strictly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly four: PR #5 (status), PR #17 (SMS intake pipeline), PR #18 (Four-bucket taxonomy & tolerance indicators), and PR #19 (Transaction categorization rules engine).
- **Merged PRs:** PR #1 through #4, PR #6 through #16.

---

## Current mission status

This mission implemented **Priority 13: Automated Transaction Categorization Rules Engine** seamlessly layered onto Artha's existing transaction entry and bank import machinery.

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| Database Schema | No `transaction_rules` table | Dedicated `transaction_rules` table with direct `user_id` FK, check constraint on `match_mode IN ('ALL', 'ANY')`, indexes on `(user_id, priority, created_at)` and partial index on `is_active = true` | **DONE** |
| PostgreSQL RLS | N/A | Row-Level Security policy `transaction_rules_isolation` enforcing direct user ownership | **DONE** |
| Backup & Recovery | Unregistered in backup | Classified in `support-backup-rules.ts` as user-scoped table with `conditions` and `actions` jsonb handlers in `support-backup-jsonb.ts` | **DONE** |
| Migration Parity | 191 migrations | Migration `20260914120000_transaction_rules.sql` added; `database/schema.sql` updated and verified clean (192 migrations) | **DONE** |
| Pure Matcher Utility | None | Pure deterministic matcher `evaluateRule` and `findMatchingRule` supporting 10 operators (`CONTAINS`, `NOT_CONTAINS`, `EQUALS`, `NOT_EQUALS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX`, `GREATER_THAN`, `LESS_THAN`, `BETWEEN`) with case-insensitive string matching and exact decimal amount comparisons | **DONE** |
| Manual Entry Integration | Category and payee purely manual | Integrated into `TransactionsService.create`: evaluates active rules on transaction entry and assigns category/payee automatically if unassigned | **DONE** |
| Import Pipeline Integration | Only merchant reference fallback | Integrated into `ImportRegularProcessorService.processTransaction` using pre-warmed cached active rules from `ImportContext` to avoid per-row database roundtrips | **DONE** |
| Batch Application Engine | None | `RulesService.applyRules` allowing users to evaluate active rules across existing transactions with dry-run preview mode and `onlyUncategorized` safeguard | **DONE** |
| Frontend Management UI | None | Dedicated `/rules` page with metric summary cards, reorderable card list, active toggle switches, condition builder form, interactive test modal, and dry-run apply modal | **DONE** |
| Navigation Integration | No rules route | Added `/rules` to `TOOLS_LINKS` and `NAV_ICONS` in `frontend/src/lib/nav-links.ts` | **DONE** |
| Internationalization | Missing rule messages | Full parity across all 21 locales in `rules.json` and `navigation.json` | **DONE** |
| Quality Gates & Tests | Standard transactions tests | 100% green: 2,916 backend tests passed (77 suites), 1,619 frontend tests passed (6 suites), 0 typecheck/lint errors | **VERIFIED CLEAN** |

---

## Transaction rules engine specifications

### 1. Match Fields & Operators

| Field | Description | Supported Operators | Value Type |
|---|---|---|---|
| `payee` | Transaction payee name | `CONTAINS`, `NOT_CONTAINS`, `EQUALS`, `NOT_EQUALS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX` | String (case-insensitive) |
| `memo` | Transaction memo / description | `CONTAINS`, `NOT_CONTAINS`, `EQUALS`, `NOT_EQUALS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX` | String (case-insensitive) |
| `amount` | Transaction absolute amount | `EQUALS`, `GREATER_THAN`, `LESS_THAN`, `BETWEEN` | Numeric (exact decimal comparison) |
| `paymentMethod` | Transaction payment rail (e.g. `UPI`, `CARD`, `NEFT`) | `EQUALS`, `NOT_EQUALS` | String |
| `type` | Transaction direction (`DEBIT` vs `CREDIT`) | `EQUALS` | String |

### 2. Match Modes & Execution Semantics
- **`ALL` (AND):** Every condition in the rule must match the candidate transaction.
- **`ANY` (OR):** At least one condition in the rule must match the candidate transaction.
- **Priority Execution:** Rules are evaluated in strict priority order (`priority ASC`, `created_at ASC`).
- **`stopProcessing` Flag:** When a matching rule specifies `stopProcessing: true`, no lower-priority rules are evaluated against that transaction.

### 3. Action Application & Precedence
- **Assign Category:** Sets `categoryId` on the transaction (with foreign key verification).
- **Set Payee Name:** Optionally normalizes or sets the payee name.
- **Protection of Manual Categorization:** Batch rule application defaults to `onlyUncategorized: true`, preventing overwrite of intentional user categorizations unless explicitly requested.

---

## Investment foundation

The India investment foundation completed in Phases A–C and PR #9 remains fully intact and authoritative:

- **Instrument Identity:** ISIN validation, AMFI scheme code identity, provider key resolution (`instrument-key.util.ts`), and alias mappings (`instrument_aliases`).
- **Market Data Providers:**
  - NSE/BSE equity quotes and historical data via Yahoo/MSN providers using `.NS`/`.BO` canonical suffixes.
  - Indian mutual fund NAVs via AMFI provider (`amfi-nav.service.ts`) querying `api.mfapi.in`, stamped with NAV dates in `Asia/Kolkata`.
- **Watchlists Integration:** User-scoped multi-watchlists with real-time price derivation from authoritative `security_prices`.
- **Performance Analytics:** Native XIRR (`xirr.util.ts`), CAGR, TWR, and realized capital gains.

---

## Financial correctness

No financial semantics, accounting equations, or transaction lifecycles were modified:
- Categorization rules only assign categories and normalize payee descriptions; they never alter monetary amounts or balance signs.
- Zero modifications to transaction balances, signs, splits, transfers, or double-entry ledgers.
- Exact decimal money arithmetic: no floating-point currency calculations.
- Zero changes to investment cost basis, realized gains, portfolio valuation, XIRR, CAGR, TWR, or FX rates.
- Row-Level Security ensures complete isolation between tenant users.

---

## Validation

Local validation completed on `fm/artha-transaction-rules-01` (`38f5ab1df`):

| Gate | Scope | Result |
|---|---|---|
| Backend Rules, Transactions & Import Suites | 77 test files (`npm run test:unit -- src/rules src/transactions src/import`) | **2,916 passed, 0 failed** |
| Frontend Rules & Parity Suites | 6 test files (`vitest run src/components/rules src/app/rules src/i18n/messages.parity.test.ts`) | **1,619 passed, 0 failed** |
| Backend Typecheck | `tsc --noEmit -p tsconfig.test.json` | **Clean (0 errors)** |
| Backend Linter | `eslint src/rules src/transactions/transactions.service.ts src/import/import-regular-processor.service.ts` | **Clean (0 errors, 0 warnings)** |
| Frontend Typecheck | `tsc --noEmit` | **Clean (0 errors)** |
| Frontend Linter | `eslint src/components/rules src/app/rules src/lib/rules.ts src/types/rule.ts` | **Clean (0 errors, 0 warnings)** |
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
2. **Authoritative Indian Trading Holiday Source:** Establish an automated upstream API for NSE/BSE holidays.

---

## Recommended next mission

With Transaction Categorization Rules (Priority 13), Budget Buckets and Tolerance Indicators (Priority 12), Indian Bank SMS Intake (Priority 11), Indian Merchant Reference Data (Priority 10), Payment Method / UPI Metadata (Priority 9), and Import Identity & Idempotency (Priority 8) completed, the recommended next mission is:

- **Priority 14: Goals & Emergency Fund Tracking Module.**
  - Introduce milestone-based wealth goals, emergency fund adequacy calculation (e.g. 6 months of `NEEDS` bucket expenses), and target progress visualization.

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
| `38f5ab1df` | Commit | `feat(rules): add transaction categorization rules engine` | Committed on `fm/artha-transaction-rules-01` |
| **PR #17** | Code PR | `feat(import): add Indian bank SMS intake pipeline` (`fm/artha-sms-intake-01` -> `main`) | **OPEN** |
| **PR #18** | Code PR | `feat(budgets): add four-bucket taxonomy and tolerance indicators` (`fm/artha-budget-buckets-01` -> `main`) | **OPEN** |
| **PR #19** | Code PR | `feat(rules): add transaction categorization rules engine` (`fm/artha-transaction-rules-01` -> `main`) | **OPEN** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
