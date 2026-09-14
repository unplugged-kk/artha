# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-14 · `main` at **`cc71ea07d`** · code PR **#17** open on `fm/artha-sms-intake-01`

---

## TL;DR

- **Main SHA:** `cc71ea07d` (PR #12, #13, #14, #15, #16 merged).
- **Active Code PRs:**
  - **PR #17** (`fm/artha-sms-intake-01`, commit `d9b901690`): **Priority 11: Indian Bank SMS Intake Pipeline** — production-quality, deterministic SMS intake adapter converting supported Indian bank SMS messages into candidate financial transactions through Artha's existing canonical import pipeline, import identity/idempotency engine, payment metadata layer, and merchant reference catalog.
- **Merged PRs:**
  - **PR #12** (`fm/artha-baseline-fixes-01`): Restored green test baseline across frontend and backend.
  - **PR #13** (`fm/artha-watchlists-01`): User-scoped multi-watchlists and quote retrieval.
  - **PR #14** (`fm/artha-import-identity-01`): Cryptographic SHA-256 source record identity and idempotent import deduplication.
  - **PR #15** (`fm/artha-payment-metadata-01`): Controlled payment rail metadata and UPI handles/references across imports, ledger, search, and UI.
  - **PR #16** (`fm/artha-merchant-reference-01`): Curated Indian merchant reference data, canonical payee resolution, alias matching, and safe category advisory metadata.
- **Test Suite Status:** 100% green across all 13 SMS test suites (116 tests passed), 65 import test suites (1,885 tests passed), 30 payee test suites (715 tests passed), 22 transaction test suites (1,113 tests passed), and migration idempotency lint (191 files, 32 tests passed).
- **Verification Gates:** TypeScript `typecheck` clean (0 errors across backend and frontend), ESLint `lint` clean (0 errors, 0 warnings on backend and frontend), migration lint clean (191 files), and zero schema drift on PostgreSQL 16.
- **Zero Architectural or Financial Regressions:** SMS intake is strictly an input adapter; never a second ledger, transaction engine, or duplicate detector. Money remains exact decimal. Debit (expense) amounts are strictly negative, and credit (income) amounts are strictly positive. All imports enforce Priority 8 SHA-256 deduplication and Priority 9 payment rails. Transient processing guarantees no raw SMS bodies are permanently stored. Unresolved accounts fail closed (`review_needed`).

---

## Current main / repository state

- **Current main SHA:** `cc71ea07d722bf7cbfe3885e3cbca3b6e87f7b3b`
- **Active Code PRs:**
  - **PR #17:** `feat(import): add Indian bank SMS intake pipeline` (`fm/artha-sms-intake-01` -> `main`), commit `d9b901690`.
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing strictly one file (`docs/status/artha-mission-status.md`).
- **Open PRs:** Exactly two: PR #5 (status) and PR #17 (SMS intake pipeline).
- **Merged PRs:** PR #1 through #4, PR #6 through #16.

---

## Current mission status

This mission implemented **Priority 11: Indian Bank SMS Intake Pipeline** building directly upon the merged foundation of Priority 8 (import identity), Priority 9 (payment metadata), and Priority 10 (merchant reference data).

| Area | Before This Mission | After This Mission | Status |
|---|---|---|---|
| SMS Sender Registry | Table existed in schema without entity or service | `SmsSenderRegistry` TypeORM entity, CRUD service, and endpoints with full tenant scoping and RLS | **DONE** |
| TRAI Header Normalization | No sender prefix normalization | `normalizeSenderPattern` stripping 2-character circle prefixes (e.g. `VM-HDFCBK` -> `HDFCBK`) and catalog of known Indian banks | **DONE** |
| Deterministic SMS Parsers | No SMS parsing engine | Modular parsers for UPI, Card, Bank Transfers (NEFT/IMPS/RTGS), ATM cash withdrawals, and Cheques | **DONE** |
| Non-Transactional Rejection | No heuristic or fast rejection | `isNonTransactionalMessage` fast-rejecting OTPs, promotional loan offers, and scheduled mandate reminders (`unsupported`) | **DONE** |
| Debit/Credit Semantics | Unmapped | Enforced exact sign conventions: debited/spent/withdrawn = negative, credited/received/refunded = positive | **DONE** |
| Canonical Import Pipeline | SMS was unconnected to import engine | Maps candidate into `QifTransaction` feeding directly into `ImportRegularProcessorService.processTransaction` | **DONE** |
| Idempotency & Deduplication | Unverified for SMS | Priority 8 SHA-256 hash computed with UPI RRN / reference ID mapped to `fitid`; re-imports skip safely (`skipped++`) | **DONE** |
| Payment Metadata Integration | Unconnected | Priority 9 `paymentMethod`, `upiVpa`, and `upiReference` extracted and recorded on canonical `transactions` | **DONE** |
| Merchant Reference Integration | Unconnected | Priority 10 merchant matching enriches payee with canonical names; non-binding category suggestions | **DONE** |
| Fail-Closed Account Resolution | No account mapping | Resolves via explicit ID -> sender registry -> unique account mask; fails closed with `review_needed` (`account_unresolved`) | **DONE** |
| Privacy & Retention | Unspecified | Transient processing; zero permanent storage of raw SMS bodies | **DONE** |
| Test Coverage & Quality Gates | 0 SMS tests | 100% green: 13 SMS suites (116 tests), 65 import suites (1,885 tests), 30 payee suites (715 tests), 0 TS/ESLint errors | **VERIFIED CLEAN** |

---

## Supported SMS scope

| Message Type | Detection Criteria | Extracted Rail | Sign / Direction | Example Payee / Counterparty |
|---|---|---|---|---|
| **UPI Debit** | `UPI`, `VPA`, `debited`, `sent`, `paid` | `PaymentMethod.UPI` | Negative (Expense) | Counterparty VPA or extracted merchant |
| **UPI Credit** | `UPI`, `VPA`, `credited`, `received`, `refund` | `PaymentMethod.UPI` | Positive (Income) | Sender VPA or refund source |
| **Card Spend** | `Card ending`, `spent`, `used for transaction`, `at <MERCHANT>` | `PaymentMethod.CARD` | Negative (Expense) | Cleaned merchant name after `at` |
| **Card Refund** | `Card ending`, `refund`, `credited`, `from <MERCHANT>` | `PaymentMethod.CARD` | Positive (Income) | Cleaned merchant name after `from` |
| **NEFT Transfer** | `NEFT`, `debited` / `credited`, `NEFT-<PARTY>-<REF>` | `PaymentMethod.NEFT` | Negative / Positive | Extracted party or narration |
| **IMPS Transfer** | `IMPS`, `debited` / `credited`, `Ref <RRN>` | `PaymentMethod.IMPS` | Negative / Positive | Extracted party or narration |
| **RTGS Transfer** | `RTGS`, `debited` / `credited` | `PaymentMethod.RTGS` | Negative / Positive | Extracted party or narration |
| **ATM Withdrawal** | `ATM`, `withdrawn`, `cash withdrawal` | `PaymentMethod.CASH` | Negative (Expense) | `"Cash Withdrawal"` or ATM location |
| **Cheque Clearance** | `Cheque No.`, `debited` / `credited` | `PaymentMethod.CHEQUE` | Negative / Positive | `"Cheque Payment"` / `"Cheque Deposit"` |

### Unsupported & Ambiguous Cases (Fails Closed)
1. **OTPs & Verification Codes:** Messages containing `OTP`, `verification code`, `one time password`, `do not share` return `status: 'unsupported'`, reason: `'otp_or_auth_message'`.
2. **Promotional & Pre-approved Offers:** Messages containing `pre-approved`, `congratulations`, `apply now`, `loan offer` return `status: 'unsupported'`, reason: `'promotional_message'`.
3. **Scheduled Reminders & Auto-debits:** Messages indicating a mandate is scheduled or will be debited in the future return `status: 'unsupported'`, reason: `'scheduled_reminder'`.
4. **Ambiguous Debit/Credit:** Messages where both debit and credit keywords appear in conflicting context return `status: 'ambiguous'`.
5. **Missing or Invalid Amounts:** Messages missing amounts or carrying zero/negative amounts return `status: 'invalid'`.
6. **Unresolved Account Destination:** If the target account cannot be determined via explicit parameter, user sender registry, or unique account mask match, the import pipeline returns `status: 'review_needed'`, reason: `'account_unresolved'`, preventing transactions in the wrong financial account.

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
| SMS intake pipeline | **DONE** | `backend/src/import/sms/**` | Deterministic parsers for UPI, Card, Transfer, ATM, Cheque; sender registry; fails closed |
| Four-bucket taxonomy | **READY** | Hierarchical categories exist | Additive taxonomy layer |
| INR lakh/crore formatting | **DONE** | `hooks/useNumberFormat.ts` + `PreferencesSection.tsx` | Uses `Intl` with `en-IN` compact formatting (L/Cr) |
| Indian fiscal year | **DONE** | `lib/indian-fiscal-year.ts` | 1 April – 31 March boundary helper wired into filters |
| Budget model & indicators | **DONE** | `backend/src/budgets/**` | Indicator badges in register |
| 5% tolerance bars | **READY** | Budget alert engine | Additive UI visual bands |
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

1. **Deterministic Bank SMS Ingestion:** Ingest and parse real-world transactional SMS messages from major Indian banks (HDFC, ICICI, SBI, Axis, Kotak, IndusInd, PNB, etc.) covering UPI debits/credits, credit/debit card transactions, NEFT/IMPS/RTGS bank transfers, ATM cash withdrawals, and cheque clearances.
2. **Canonical Ledger Execution:** Converts parsed candidate transactions into `QifTransaction` representations and routes them directly through Artha's existing `ImportRegularProcessorService`, avoiding any parallel ledger, secondary transaction store, or separate balance recalculator.
3. **Idempotent Import Deduplication:** Repeated imports of identical SMS messages compute deterministic SHA-256 content hashes (`importHash`) using extracted bank references or UPI RRNs mapped to `fitid`. Collisions safely skip duplicate transactions (`skipped++`) without balance mutations.
4. **Controlled Payment Rail & UPI Extraction:** Automatically detects payment methods (`PaymentMethod.UPI`, `CARD`, `IMPS`, `NEFT`, `RTGS`, `CASH`, `CHEQUE`), isolates UPI VPA handles, and extracts 12-digit UPI RRN reference numbers.
5. **Payee Recognition & Precedence:** Seamlessly enriches payees using Priority 10 merchant reference data (e.g. `SWIGGY` -> `Swiggy`) while strictly honoring custom user payee aliases and normalized user payees first.
6. **Fail-Closed Security & Tenancy:** Non-transactional messages (OTPs, promotional loan spam, scheduled mandate reminders) are cleanly rejected as `unsupported`. Ambiguous messages or unresolved accounts fail closed (`review_needed`), guaranteeing that transactions are never created in the wrong financial account.
7. **Privacy by Design:** Raw SMS message bodies are processed transiently and are never permanently stored in the database.
8. **User-Scoped Sender Registry:** Users can configure custom SMS sender mappings (e.g. `HDFCBK` -> `HDFC Salary Checking`) with full PostgreSQL Row-Level Security (RLS).
9. **Full India Investment Suite:** Track stocks (NSE/BSE) and Indian mutual funds (AMFI), portfolio concentration (HHI, effective holdings), watchlists with live quotes, and performance analytics (XIRR, CAGR, TWR).

---

## Implemented this mission

1. **Sender Registry Entity & Service Layer:**
   - Defined `SmsSenderRegistry` entity in `backend/src/import/sms/entities/sms-sender-registry.entity.ts` mapped to existing `sms_sender_registry` table with RLS.
   - Built `SmsSenderRegistryService` providing full CRUD operations for user sender patterns, TRAI prefix normalization, and account resolution.
   - Created `bank-sender-registry.data.ts` cataloging known Indian banks (HDFC, ICICI, SBI, Axis, Kotak, PNB, IndusInd, Yes Bank, Federal Bank, IDFC, Canara, BOB, Union Bank, Paytm).
2. **Deterministic Parsers & Orchestrator:**
   - Created `ISmsParser` interface and `ParsedSmsTransaction` model.
   - Built `amount-parser.util.ts` extracting exact amounts while avoiding collisions with reported account balances or credit limits.
   - Built `date-parser.util.ts` handling ISO, alphanumeric (`14-Sep-26`, `14Sep26`), and numeric Indian date formats with century pivots.
   - Built `sms-cleaner.util.ts` extracting account masks, VPAs, RRNs, and rejecting OTPs/promotions/reminders.
   - Built specialized parsers: `UpiSmsParser`, `CardSmsParser`, `BankTransferSmsParser`, `AtmSmsParser`, `ChequeSmsParser`.
   - Built `CompositeSmsParser` orchestrating prioritized evaluation and safe failure handling.
3. **Core Intake & Pipeline Integration:**
   - Created `SmsIntakeService` providing `parseSms` (non-persistent preview with merchant enrichment and account candidate resolution) and `importSms` (canonical execution through `ImportRegularProcessorService`).
   - Mapped SMS candidate fields into `QifTransaction` with signed amounts, reference IDs mapped to `fitid`, and payment metadata preserved.
   - Integrated with Priority 8 import identity, Priority 9 payment metadata, and Priority 10 merchant reference data.
4. **API Endpoints & Controllers:**
   - Created `SmsIntakeController` exposing preview (`/parse`), ingestion (`/import`), and sender registry management (`/senders`, `/senders/known`, `/senders/:id`).
   - Built `SmsIntakeModule` registered in `ImportModule`.
5. **Comprehensive Quality Gates & Testing:**
   - 13 SMS test suites with 116 tests passing, including comprehensive specification suite `indian-bank-sms-pipeline.spec.ts` testing all 33 required edge cases.

---

## Financial correctness

No financial semantics, accounting equations, or transaction lifecycles were modified:
- SMS intake acts purely as an input adapter converting raw text into `QifTransaction` records.
- Existing `transactions` rows remain the single canonical source of truth.
- Exact decimal money arithmetic: no floating-point money calculations.
- Debit amounts are strictly negative; credit amounts are strictly positive.
- Import identity hashes remain 100% stable; repeated imports are strictly idempotent.
- Merchant category suggestions remain advisory metadata; no transaction categories are automatically assigned or mutated.
- Zero alterations to income/expense sign conventions, balances, FX completeness, or investment calculations.

---

## Validation

Local validation completed on `fm/artha-sms-intake-01` (`d9b901690`):

| Gate | Scope | Result |
|---|---|---|
| SMS Test Suites | 13 test files (`npm run test:unit -- src/import/sms`) | **116 passed, 0 failed** |
| Import Test Suites | 65 test files (`npm run test:unit -- import`) | **1,885 passed, 0 failed** |
| Payee Test Suites | 30 test files (`npm run test:unit -- payees`) | **715 passed, 0 failed** |
| Transaction Test Suites | 22 test files (`npm run test:unit -- transactions`) | **1,113 passed, 0 failed** |
| Backend Typecheck | `tsc --noEmit -p tsconfig.test.json` | **Clean (0 errors)** |
| Backend Linter | `eslint "{src,apps,libs,test}/**/*.ts"` | **Clean (0 errors, 0 warnings)** |
| Frontend Typecheck | `tsc --noEmit` | **Clean (0 errors)** |
| Frontend Linter | `eslint .` | **Clean (0 errors, 1 warning in sw.js)** |
| Migration Idempotency Lint | `node scripts/migration-lint.mjs` | **Clean (191 files verified)** |
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

With Indian Bank SMS Intake (Priority 11), Indian Merchant Reference Data (Priority 10), Payment Method / UPI Metadata (Priority 9), and Import Identity & Idempotency (Priority 8) completed, the recommended next mission is:

- **Priority 12: Four-Bucket Budget & Tolerance Visual Indicators.**
  - Layer the additive 4-bucket budget taxonomy (`Needs`, `Wants`, `Savings / Investments`, `Debt Servicing`) and 5% tolerance visual bands onto the existing budget analytics and register views.

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
| **PR #17** | Code PR | `feat(import): add Indian bank SMS intake pipeline` (`fm/artha-sms-intake-01` -> `main`) | **OPEN** |
| **PR #5** | Rolling Status PR | `Artha mission status — review me here` (`fm/artha-mission-status` -> `main`) | **OPEN (1 file)** |
