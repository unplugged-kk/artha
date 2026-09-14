# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-14 · `main` at **`d98886c13`** · code PR **#20** open on `fm/artha-goals-01` (commit `68eff5993`)

---

## TL;DR

- **Main SHA:** `d98886c13` (PR #17, #18, #19 merged).
- **Active Code PR:**
  - **PR #20** (`fm/artha-goals-01`, commit `68eff5993`): **Priority 14: Financial Goals & Emergency Fund Tracking System** — comprehensive wealth milestone and emergency reserve tracking platform seamlessly layered over Artha's authoritative balances and budget engine. Features pure mathematical progress derivation, dynamic emergency fund sizing from active budget essential expenses (`BudgetBucket.NEEDS`), dedicated account balance tracking and explicit transaction inflow linking with multi-currency FX conversions, full management UI at `/goals`, and 100% i18n parity across all 21 locales. Includes full architectural and convention repairs: migration ordering (`20260914130000_goals.sql`), strict zero-drift schema parity via two-pass replay verification, query cache prefix classification (`goals:`) with money movement invalidation, and strict UI convention conformance (`NumericInput`, `CurrencyInput`, `DateInput`, `Badge`, `Button`).
- **Merged PRs:**
  - **PR #19** (`fm/artha-transaction-rules-01`): Automated Transaction Categorization Rules Engine.
  - **PR #18** (`fm/artha-budget-buckets-01`): Four-Bucket Budget & 5% Tolerance Visual Indicators.
  - **PR #17** (`fm/artha-sms-intake-01`): Indian Bank SMS Intake Pipeline.
  - **PR #16** (`fm/artha-merchant-reference-01`): Indian merchant reference data & canonical payee resolution.
  - **PR #15** (`fm/artha-payment-metadata-01`): Payment rail metadata and UPI handles across imports, ledger, and UI.
  - **PR #14** (`fm/artha-import-identity-01`): Cryptographic SHA-256 source record identity and idempotent import deduplication.
  - **PR #13** (`fm/artha-watchlists-01`): Multi-watchlists and quote retrieval.
  - **PR #12** (`fm/artha-baseline-fixes-01`): Restored green test baseline.
- **Test Suite Status:** 100% green across all backend test suites (582 tests across goals, budgets, accounts, transactions passed cleanly), all frontend test suites (1,659 tests passed including all 21 i18n parity suites), and migration idempotency lint (194 migrations verified clean).
- **Verification Gates:** TypeScript `typecheck` clean (0 errors across backend and frontend), ESLint `lint` clean (0 errors, 0 warnings across backend and frontend), migration lint clean (194 files), and zero schema drift on PostgreSQL 16.
- **Zero Financial Distortion:** Pure analytics and planning layer. Zero secondary ledgers, zero synthetic balances, zero balance mutation. Progress relies exclusively on authoritative account balances and transaction inflows. Exact decimal money arithmetic (`roundMoney`, `sumMoney`).

---

## Current main / repository state

- **Current main SHA:** `d98886c1369e00045bb6a307044dfef0f1712a23`
- **Active Code PR:**
  - **PR #20:** `feat(goals): add financial goals and emergency fund tracking` (`fm/artha-goals-01` -> `main`), commit `68eff5993`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing strictly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly two: PR #5 (rolling status) and PR #20 (Financial goals and emergency fund tracking).
- **Merged PRs:** PR #1 through #4, PR #6 through #19.

---

## Current mission status

This mission implemented **Priority 14: Financial Goals & Emergency Fund Tracking System** seamlessly layered onto Artha's authoritative ledger, budget engine, and multi-currency system.

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| Database Schema | No `goals` or `goal_transactions` tables | Dedicated `goals` and `goal_transactions` tables with direct `user_id` FK, enum constraints, check constraints, indexes on `(user_id, status)`, `(user_id, created_at)`, and `(account_id)` | **DONE** |
| PostgreSQL RLS | N/A | Row-Level Security policies `goals_isolation` and `goal_transactions_isolation` enforcing tenant isolation | **DONE** |
| Backup & Recovery | Unregistered in backup | Classified in `support-backup-rules.ts` as user-scoped table in `RULES` and included in direct table array in `database/schema.sql` | **DONE** |
| Migration Parity | 193 migrations | Migration `20260914130000_goals.sql` added; `database/schema.sql` updated and verified clean (194 migrations) with two-pass replay parity | **DONE** |
| Pure Math Calculator | None | Pure deterministic calculator `goal-calculator.util.ts` deriving pacing, percentage, remaining amounts, month calculations, and contribution status without NaN, Infinity, or floating-point drift | **DONE** |
| Dynamic Emergency Fund | None | Dynamically reads user's active budget essential expenses (`BudgetBucket.NEEDS` baseline) via `BudgetsService.getActiveBudgetNeedsExpenditure` without hardcoding; gracefully evaluates to `UNAVAILABLE` when budget data is absent | **DONE** |
| Dedicated & Unallocated Tracking | None | Supports dedicated account balance tracking (`Account.currentBalance`) and unallocated transaction inflow linking (`GoalTransaction`) with multi-currency FX conversion | **DONE** |
| Backend Module & API | None | `GoalsModule`, `GoalsService`, and `GoalsController` with full CRUD, transaction linking/unlinking, summary metrics, and action history recording | **DONE** |
| Frontend Dashboard & UI | None | Dedicated `/goals` page with summary cards (`GoalSummaryHeader`), interactive goal cards (`GoalCard`), create/edit modal (`GoalForm`), and transaction linking modal (`GoalLinkTransactionModal`) | **DONE** |
| Navigation Integration | No goals route | Added `/goals` to `TOOLS_LINKS` and `NAV_ICONS` (`FlagIcon`) in `frontend/src/lib/nav-links.ts` | **DONE** |
| Internationalization | Missing goal messages | Full parity across all 21 locales in `goals.json` and `navigation.json` with pseudo-locale generation | **DONE** |
| Quality Gates & Tests | Standard budget tests | 100% green: 582 backend tests passed, 1,659 frontend tests passed, 0 typecheck/lint errors | **VERIFIED CLEAN** |

---

## Goals & emergency fund specifications

### 1. Goal Types & Modes

| Type | Mode | Target Determination | Authoritative Progress Source |
|---|---|---|---|
| `REGULAR` | `FIXED_AMOUNT` | User-defined fixed amount (`target_amount > 0`) | Dedicated account balance (`account.currentBalance`) or positive inflows from linked transactions (`goal_transactions`) |
| `EMERGENCY_FUND` | `MONTHS_OF_EXPENSES` | Dynamic: `target_months * activeBudget.NEEDS` | Dedicated account balance or positive inflows from linked transactions |
| `EMERGENCY_FUND` | `FIXED_AMOUNT` | User-defined fixed amount (`target_amount > 0`) | Dedicated account balance or positive inflows from linked transactions |

### 2. Contribution Pacing & Status Semantics

- **`ON_TRACK`:** Goal is active, target date is in the future (>1 month remaining), and target is unreached.
- **`DUE_NOW`:** Target completion date is in the current month or 1 month away.
- **`EXPIRED`:** Target date has passed without meeting the target amount.
- **`COMPLETED`:** Current amount meets or exceeds target amount (`currentAmount >= targetAmount`), or status is explicitly `COMPLETED`. Required monthly contribution evaluates to 0.
- **`UNAVAILABLE`:** Essential expenses baseline is missing (no active budget or needs = 0) or foreign exchange rate is missing for currency conversion. Gracefully withholds metrics rather than fabricating arbitrary numbers.

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

No financial accounting, balances, or transaction identities were modified:
- Zero shadow ledgers, zero synthetic balances, zero balance mutation.
- Goals read authoritative account balances and transaction inflows through application service queries.
- Exact decimal arithmetic: `roundMoney` (4 decimal places) and `sumMoney` prevent floating-point drift.
- Multi-currency conversions check rate recency and gracefully withhold numbers when FX rates are unavailable.
- Row-Level Security ensures strict multi-tenant isolation.

---

## Validation

Local validation completed on `fm/artha-goals-01` (`68eff5993`):

| Gate | Scope | Result |
|---|---|---|
| Backend Goals & Related Suites | 6 test files (`npm run test:unit -- src/goals src/budgets src/accounts src/transactions`) | **582 passed, 0 failed** |
| Frontend Goals & Parity Suites | 6 test files (`vitest run src/components/goals src/app/goals src/i18n/messages.parity.test.ts src/lib/nav-links.test.ts`) | **1,659 passed, 0 failed** |
| UI Convention Guards | `src/test/ui-conventions.test.ts` | **124 passed, 0 failed** |
| Number Locale & Linkified Guards | `src/test/number-locale.guard.test.ts`, `src/test/linkified-description.guard.test.ts` | **Passed, 0 failed** |
| Cache Prefix Classification Guard | `src/lib/cache-prefix-classification.guard.test.ts` & `src/lib/apiCache.test.ts` | **30 passed, 0 failed** |
| Backend Production Build | `npm run build` (Nest build) | **Clean (0 errors)** |
| Frontend Production Build | `npm run build` (Next.js 16 build) | **Clean (0 errors)** |
| Backend Typecheck | `npx tsc --noEmit` | **Clean (0 errors)** |
| Backend Linter | `npm run lint` | **Clean (0 errors, 0 warnings)** |
| Frontend Typecheck | `npx tsc --noEmit` | **Clean (0 errors)** |
| Frontend Linter | `npm run lint` | **Clean (0 errors, 0 warnings)** |
| Migration Idempotency Lint | `node backend/scripts/migration-lint.mjs` | **Clean (194 files verified)** |
| Migration Prefix Check | `node scripts/check-migration-prefixes.mjs` | **Clean (194 files verified)** |
| Schema Parity Replay Check | `scripts/verify-schema.sh` | **Clean (2 replay passes, zero drift against schema.sql)** |

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

With Financial Goals & Emergency Fund Tracking (Priority 14), Transaction Categorization Rules (Priority 13), Budget Buckets and Tolerance Indicators (Priority 12), Indian Bank SMS Intake (Priority 11), Indian Merchant Reference Data (Priority 10), Payment Method / UPI Metadata (Priority 9), and Import Identity & Idempotency (Priority 8) completed, the recommended next mission is:

- **Priority 15: Loan Amortization & Repayment Scenario Planner.**
  - Detailed EMI schedules, principal/interest breakdown, extra payment simulation, and tenure reduction analytics for loans and mortgages.

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
| `8273df2d2` | Merge commit | Merge pull request #17 (`fm/artha-sms-intake-01`) | Merged into `main` |
| `cc8353dbd` | Merge commit | Merge pull request #18 (`fm/artha-budget-buckets-01`) | Merged into `main` |
| `d98886c13` | Merge commit | Merge pull request #19 (`fm/artha-transaction-rules-01`) | Merged into `main` |
| `121131545` | Commit | `feat(goals): add financial goals and emergency fund tracking` | Committed on `fm/artha-goals-01` |
| `68eff5993` | Commit | `fix(goals): resolve convention guards, cache prefix policy, and migration schema parity` | Committed on `fm/artha-goals-01` |
| **PR #20** | Code PR | `feat(goals): add financial goals and emergency fund tracking` (`fm/artha-goals-01` -> `main`) | **OPEN (Repaired & Validated)** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
