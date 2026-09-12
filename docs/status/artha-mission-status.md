# Artha mission status

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence and the next-mission brief are below.

**Status of this document:** written to be read by someone with no access to the repository — including another model asked to plan the next mission. §1 is the context needed to do that.

Last updated: 2026-09-12 · `main` at **`85e643d82`** · everything described here is **merged**

---

## 0. TL;DR

- **All code is merged.** PR #10 (ledger month/day UX + the Jest worker recycling that ends the backend OOM) and PR #11 (concentration analytics, India number formatting, Indian fiscal year, merchant normalization in import, the `zizmor` fix) are both on `main`.
- **The merges are what revealed `main`'s real failure set.** The backend unit job used to *crash* before printing a summary, so nobody could see which tests failed. It now completes — 15,935 tests ran — and **three suites genuinely fail**. Separately, the ledger work brought a **frontend regression: 88 failures are one component** (`MonthNavigator`) in `app/transactions/page.test.tsx`.
- **`main` is therefore red on both unit jobs for known, named, fixable reasons** — §3 lists every one. That list is the highest-value next work: it is the only thing between the current state and a trustworthy green baseline.
- **`zizmor` is fixed and passes.** It was never a security finding: the job failed because `upload-sarif` could not publish (a missing `actions: read` permission, then **code scanning not being enabled** on the repository). The scan still runs and its findings now print into the job log. Enabling code scanning is a repository setting — an owner action.
- **Five capabilities were delivered this mission**: concentration/diversification, India-first number formatting, the Indian financial year, merchant normalization in import, and the `zizmor` fix.
- **One objective deferred on a product decision**, not budget: Indian merchant seeds — §8.
- **No financial semantics changed in any of it.** §9 is the audit.

---

## 1. Context for an external reader

Without this, the rest is hard to act on. Everything a planner needs to know about the project:

**What it is.** Artha is a self-hosted personal-finance application ("Monize" in most internal identifiers — the rename is partial). Multi-account, with a real investment engine. The product direction is **India-first**.

**Stack.**
- **Backend:** NestJS 11 + TypeORM + PostgreSQL 16 — `backend/`.
- **Frontend:** Next.js + React + TypeScript + Tailwind, `next-intl` for i18n — `frontend/`.
- **Database:** `database/schema.sql` is authoritative; changes ship as numbered files in `database/migrations/`. RLS is enabled per table with an explicit exemption list.
- **Tests:** Jest (backend), Vitest (frontend), Playwright (`e2e/`).

**How to validate** (all local; Postgres is available):
- `cd backend && npm run typecheck && npm run lint`
- `cd backend && npx jest <path>` — one spec, fast; the full unit run is heavy
- `cd backend && npm test` — integration, needs the test DB
- `cd frontend && npx tsc --noEmit && npx eslint <files>`
- `cd frontend && NODE_ENV=test npx vitest run <path>`
- `node scripts/check-docs-manifests.mjs`; `bash scripts/verify-schema.sh` (migrations ↔ schema.sql parity)

**Conventions the next mission must respect** — enforced by guards, not by opinion:
- **Money is `decimal(20,4)`.** Never accumulate in floats; sum scaled integers and divide once. `roundMoney` is 4dp, `roundFxRate` is 10dp, and **an exchange rate is never rounded like money**.
- **A missing value propagates; it never becomes zero.** A field named `total*` may only hold a value when every component is known; otherwise it is `null` with a *separately named* subtotal and a reason (a count, a list of ids). This is the most-enforced rule in the codebase — read `docs/financial-calculation-contract.md` before touching any calculation.
- **Exchange rate 1 is reachable only for equal currency codes.** No other branch may produce it.
- **One price door.** Turning a stored observation into "the value on date X" goes through `common/time-series/price-boundary.util.ts` (bounded staleness, 14 days). A new unbounded "latest price" lookup is a defect, and a scanning spec fails on one.
- **The replay is the source of truth for cost basis**; `holdings.average_cost` is a rebuildable cache.
- **Adjusted prices for returns, raw prices for valuation** — never mixed within one calculation.
- **A rejected command must not already have written** — validation happens under the same lock and inside the same transaction as the write.
- **Guards are scanning specs** that fail on a new violation (`investment-replay.guard.spec.ts`, `price-boundary.one-door.spec.ts`, …). When you fix something a guard protects, the guard is how the next person learns.
- **i18n:** every key must exist in `en`, in all 18 full locales with identical structure, and in the generated `xx` pseudo-locale.
- **Never import Fintrack's or Finsight's financial logic.** Their sign conventions, float math, hard-coded analytics and stored-never-rebuilt cost basis are explicitly rejected (§11).
- **Design document first.** `docs/financial-calculation-contract.md` §9 requires a short written design before implementing anything that computes or reports money — "a twenty-line change that puts a new percentage on a page is in scope".

---

## 2. What was delivered this mission (all merged)

| Capability | Where | Evidence |
|---|---|---|
| Concentration / diversification analytics | `backend/src/securities/concentration.util.ts` + `PortfolioService.getPortfolioSummary` + the LLM/MCP summary | 24 unit tests + a reconciliation test on the real summary path |
| India-first number formatting | `frontend/src/hooks/useNumberFormat.ts` + `en-IN` in `PreferencesSection.tsx` | 11 new tests; 52 existing unchanged |
| Indian financial year | `frontend/src/lib/indian-fiscal-year.ts` + *This/Last financial year* in the transaction filter | 19 tests |
| Merchant normalization in import | `import-regular-processor.service.ts` → `payee-normalize.util.ts` | 6 tests; 28 suites / 717 green |
| `zizmor` CI job | `.github/workflows/ci.yml`, `.github/zizmor.yml` | job passes: `No findings to report. Good job! (5 suppressed)` |

**Concentration in detail**, because it is the headline and the least obvious:

Read from the allocation the portfolio summary **already** draws — same prices, same FX, same consolidation by security, same denominator — rather than walking the holdings again. A second walk would be a second valuation, and the day it disagreed with the portfolio value beside it there would be no way to tell which was right. The module is pure and takes the slice list as input, so the two cannot drift.

Measured: **Herfindahl-Hirschman index** (Σ wᵢ², 0–1); **effective number of holdings** (its reciprocal — the standard convention, named as a convention rather than as something proprietary); **top-1** and **top-5 share**; the largest positions. **Two bases**, each with its own denominator: holdings alone, and holdings plus cash.

Every treatment is defined rather than left to a reader, because an undefined denominator is how a concentration figure misleads:

| Question | Answer |
|---|---|
| Valuation date/time | None of its own, and it does not invent one: a current-state measure over the summary's own prices (each with its own price date). A historical "as of" figure needs the historical valuation path and is not attempted. |
| Valuation source | The existing portfolio valuation. No second engine. |
| Cash | One slice of the *portfolio* basis, excluded from the *holdings* basis. |
| Unpriced instruments | Inherited from the allocation builder; reported as `unpricedPositions`; `status` drops to `partial`. |
| Unconvertible currency | Same — reported as `missingRatePairs`. |
| Zero/negative value | Carries no weight; counted as `nonPositiveValuePositions`. |
| Unavailable data | `status: "unavailable"` when nothing could be drawn. |
| Denominator | The drawn total (positive positions + positive cash). Negative cash does **not** shrink it and inflate every weight. |

---

## 3. What is red on `main` right now — the next mission's first job

Two unit jobs fail, and **every failure is named**. This is the highest-value work available: the only thing between the current state and a trustworthy baseline, and each item is small.

### 3a. Backend unit tests — 3 failing suites of 616 (15,935 tests ran)

| Suite | Failing test | Notes |
|---|---|---|
| `src/provider-health/provider-call.guard.spec.ts` | `outbound provider calls are answerable to the breaker › finds the clients it is guarding` | A guard spec: outbound provider calls must be enumerated and answered by the health breaker. |
| `src/provider-health/provider-call.guard.spec.ts` | `… › securities/amfi-nav.service.ts routes its availability through ProviderHealthService` | **Actionable**: the AMFI service appears not to route its availability through `ProviderHealthService`. Decide which is wrong — the service, or the guard whose list needs the new caller — rather than just adding it to a list. |
| `src/securities/security-price.service.spec.ts` | `SecurityPriceService › backfillSecurityHoldingPeriod with an explicit range › still clips when no range is given` | Behavioural, in the price backfill. |
| `src/module-graph.spec.ts` | *suite failed to run* | Inspects the Nest module graph. Check whether the Jest worker recycling (PR #10) disturbs it, or whether it is a genuine graph problem. |

**Context that matters:** these are **not** regressions from PR #11, and not from PR #10's diff either — #10 touched only `backend/package.json`, one guard spec, and frontend ledger files. They were **invisible until now**, because the OOM aborted the run before Jest could print a summary. Fixing the crash is what made them visible.

### 3b. Frontend unit tests — 89 failed / 16,338 passed

| Suite | Result | Notes |
|---|---|---|
| `src/app/transactions/page.test.tsx` | **88 of 88 failed** | `TypeError: formatMonth is not a function`, stack pointing into `MonthNavigator.tsx:87`. One cause, 88 symptoms — most likely `MonthNavigator` calling a formatter the shared test mock does not provide (the repo mocks `useNumberFormat` via `src/test/number-format-mock.ts`). The fix is either the missing mock method or using an existing formatter. |
| `src/test/ui-conventions.test.ts` | 1 failed (line 2068) | A UI-convention guard — likely the same root cause, or a new violation from the ledger work. |

**Why this is the first job:** until both jobs are green, `main` cannot distinguish a new defect from background noise, and every future mission's CI result is uninterpretable.

---

## 4. Capability status vs the two source applications

`DONE` · `PARTIAL` · `READY` · `BLOCKED` · `DEFERRED` · `REJECTED`.

### 4a. Fintrack (daily-money / ledger UX)

| Capability | Status | Actual implementation | Next action |
|---|---|---|---|
| Transaction ledger | **DONE** | `TransactionList.tsx` | — |
| Month navigation | **DONE** | `MonthNavigator.tsx` + `app/transactions/page.tsx` | ⚠️ 88 failing tests — §3b |
| Day grouping | **DONE** | `groupByDate` + `lib/transaction-day-groups.ts` | — |
| Day subtotals | **DONE** | `groupTransactionsByDay` — income/expense; transfers, VOID and split children excluded; a day spanning currencies reports **no** total rather than adding unlike amounts | — |
| Relative dates | **DONE** | *Today* / *Yesterday*, absolute date kept beside them | — |
| Quick add | **PARTIAL** | `useTransactionSubmitMode` ("Create & New"), `RecentTransactionsPopover` | no distinct minimal flow |
| Merchant normalization | **DONE** | exact → alias → **normalised equality**; Indian legal forms added (`Pvt`, `Private`, `Limited`, `LLP`) | — |
| Indian merchant seeds | **DEFERRED** | none | blocked on a product decision — §8 |
| Four-bucket taxonomy | **READY** | categories have hierarchy + `is_income`; no bucket concept | additive layer; do not replace the category model |
| INR formatting | **DONE** | compact units derived from `Intl`; `en-IN` selectable | translate the new label |
| Fiscal-year helper | **DONE** | `lib/indian-fiscal-year.ts` + filter periods | — |
| Budget model | **DONE** | `backend/src/budgets/**`; budget indicators in register rows | — |
| 5 % tolerance bars | **READY** | budget health/alerts exist | additive band |
| Dashboard concepts | **PARTIAL** | widget registry + range selectors; differs from Fintrack's | product decision |
| Import (formats) | **PARTIAL** | CSV (mapped), QIF, multi-QIF, OFX/QFX, `.mny` | — |
| Import (dedup) | **PARTIAL** | transfer/split **signature counting only**; no content hash, no unique index; `.mny` hashes the staged *file* | its own mission — a schema + identity change |
| SMS intake | **DEFERRED** | only the `sms_sender_registry` table | dedicated mission |
| Rules engine | **DEFERRED** | none | dedicated mission |
| Goals / emergency fund | **DEFERRED** | none | product module |
| Credit cards | **PARTIAL** | `accounts/statement-cycle.service.ts` | — |
| Recurring transactions | **DONE** | `backend/src/scheduled-transactions/**` | — |
| SIP plan-vs-actual | **DONE** | `sip-plan-comparison.service.ts` | — |

### 4b. Finsight (market data / portfolio analytics)

| Capability | Status | Actual implementation | Next action |
|---|---|---|---|
| NSE / BSE equities | **DONE** | `.NS` / `.BO` via `instrument-key.util.ts` (one exchange→suffix authority) | — |
| AMFI NAV | **DONE** | `amfi-nav.service.ts` — by scheme code, dated on the NAV's own day | ⚠️ guard says it may not route through `ProviderHealthService` — §3a |
| Provider aliases | **DONE** | `instrument_aliases` + `instrument-alias.entity.ts` | — |
| Valuation | **DONE** | `PortfolioService.getPortfolioSummary` + `PortfolioCalculationService` | — |
| CAGR | **DONE** | `calculateCAGR`, completeness-gated | — |
| XIRR | **DONE** | `xirr.util.ts` + `calculateXirr` | — |
| TWR | **DONE** | `calculateTWR` | — |
| Realized gains | **DONE** | `calculateRealizedGains`, by month and by day | — |
| Allocation | **DONE** | by security, tag, tag-key, sector, country (NSE/BSE → India), asset class | — |
| Concentration / diversification | **DONE** | `concentration.util.ts` — HHI, effective holdings, top-1/top-5, two bases | — |
| Risk statistics (σ, Sharpe, Sortino, VaR, β, α) | **BLOCKED** | none in production; volatility/drawdown exist only as Monte Carlo *outputs* and in the GEM backtest util | needs a portfolio return series built from price history |
| Drawdown / correlation | **BLOCKED** | same | same |
| Market-cap allocation | **BLOCKED** | **no market-cap data exists** — no column, no weighting code; a spec asserts `marketCap` is *not* a report column | needs a reference-data source |
| Stock screener | **DEFERRED** | none | reimplement natively — Finsight's ignored its own filters, so it is REJECTED as a source |
| Research / detail | **PARTIAL** | `security-detail.service.ts`, `security-news.service.ts` | — |
| Mutual-fund analytics | **DEFERRED** | AMFI search resolves schemes; no category model, no comparison, no overlap | needs a category source |
| Rolling returns | **READY** (funds) | the AMFI series is fetched in full; equity history is only as deep as the backfill | bounded by equity history depth |
| Watchlists | **BLOCKED** | `securities.is_favourite`, a boolean | small module, not started |
| Index / benchmarks | **DONE** | `market_index_prices`, `performance-comparison.service.ts` | — |
| Reports | **DONE** | `investment-reports/**` | — |
| Alerts | **DONE** | `notification-center/**`, `push/**` | — |
| AI investment assistant | **DONE** | `backend/src/ai/**`, `mcp/**` — real providers, no mock | concentration now in its summary |
| News | **PARTIAL** | `security-news.service.ts` | — |
| Sentiment / events | **DEFERRED** | absent from production code | defer |

---

## 5. Validation

Local, on the merged tree:

| Gate | Result |
|---|---|
| Backend — import + payees | 28 suites, **717 passed** |
| Backend — portfolio / concentration / calculation | **264 passed** |
| Backend — merged-tree spot check (concentration, portfolio, import, payee) | 4 suites, **251 passed** |
| Frontend — number formatting | 63 passed (11 new) |
| Frontend — fiscal year + periods | 40 passed |
| Frontend — settings + filter panel | 782 passed |
| Frontend — merged-tree spot check (8 files: ledger, filter, fiscal year, formatting) | **246 passed** |
| `tsc --noEmit`, both sides | clean |
| eslint on every changed file | clean |
| i18n structural parity | **all 40 namespaces × 18 locales identical to `en`**, re-verified *after* merging #10; pseudo-locale regenerated |
| Docs/manifest guard | OK (99 Helm values, 8 documents) |

**CI on PR #11's final pre-merge head** (16 of 17 jobs): Backend Lint & Type Check ✅, Backend Integration Tests ✅ (12m, real Postgres — exercises the import and portfolio paths this mission changed), Frontend Lint & Type Check ✅, Frontend Bundle Size ✅, Schema vs Migrations Drift ✅, **Workflow Security Scan (zizmor) ✅**, License ×2 ✅, NPM Audit ✅, Lighthouse ✅, hadolint ✅, Helm ✅, docs/manifests ✅, Bearer ✅, PR checklist ✅. Only `Backend Unit Tests` failed, with the pre-existing OOM that PR #10 fixes.

**Failure classification — all of it:**

| Failure | Classification |
|---|---|
| `InsightsAggregatorService › computes average monthly spending from completed months only` | **Pre-existing**, date-sensitive. Proved by re-running with this mission's changes stashed. |
| Backend OOM abort on the unit job | **Pre-existing**, fixed by PR #10 (merged). |
| The 3 backend suites in §3a | **Pre-existing but previously invisible** — the OOM hid them. Not caused by #10's or #11's diff. |
| `page.test.tsx` (88) + 1 UI-convention failure, §3b | **Landed with the ledger work (PR #10).** A real regression, now on `main`. |

---

## 6. Known limitations

1. **Two unit jobs are red on `main`** — §3. Everything else in CI passes.
2. **Code scanning is not enabled**, so zizmor's findings are visible only in the job log and the SARIF artifact.
3. **Import dedup is signature-based** — no content hash, no unique index, no idempotency for non-transfer rows.
4. **UPI / payment method does not exist** as a field anywhere; a scope decision precedes the code.
5. **Market-cap allocation and risk statistics are blocked** on data that is not collected.
6. **The variable-date Indian holiday calendar is deliberately incomplete**: `indianCalendarComplete(year)` stays `false`, because a date recalled rather than sourced would silently mis-date a settlement.
7. **A handful of new UI labels ship as English** in the 18 full mirrors; translations pending (standing policy).
8. **Watchlists are not started.**
9. **The Jest worker-recycling bound (`512MB`) is unproven as the right value.** The OOM is gone and the suite completes, but the run is materially slower; a higher bound restarts less often and retains more.

---

## 7. Open decisions (someone must choose)

1. **Enable code scanning** (repository Settings → Code security). Owner action; unlocks zizmor's richer channel.
2. **May an import attach a *default category* to a payee it creates**, and how does a seed's category map onto the user's own category vocabulary (match by name, by a slug, or ask)? The single decision blocking Indian merchant seeds.
3. **Is UPI / payment method in scope?** No field exists; the code follows the decision.
4. **The Indian holiday calendar's authoritative annual source**, and who maintains it.
5. **The Jest recycling bound** — accept the slower-but-complete run, raise the bound, or split the two ~8,000-line specs.

---

## 8. Indian merchant seeds — deferred, and exactly what unblocks it

A seed table is easy. Making it *do* something honest is the problem:

- Artha's category names are **user data**. The import's `categoryMap` is keyed by the spelling *in the file being imported*, so there is no vocabulary to map a seed's category onto.
- The only two ways to make seeds act today are (a) attach a default category to a new payee by **creating categories the user never asked for**, or (b) compute a suggestion **no surface renders**. Both are "not implemented" by this project's standard, and (a) also writes to a user's category list during an import.
- What seeds genuinely improve at the payee boundary — matching an Indian merchant written several ways — is **already delivered** by the normalization work, including the Indian legal forms and digit/store-number noise.

Answer decision 2 and the seed table plus its matcher is small and self-contained, with the tests the mission specifies (known match, case, punctuation, UPI reference noise, near-match that must not match, multiple candidates).

---

## 9. Did any financial semantics change? — No

Precisely:

- No sign convention, ledger action, cash leg, VOID rule, cost-basis replay, FX rule, TWR, CAGR or XIRR was touched. Cost basis remains transaction-derived; `holdings.average_cost` remains a rebuildable cache.
- **The concentration measure cannot disagree with the valuation it describes**: it consumes the allocation slices, so it inherits the same prices, FX conversion, consolidation and denominator. It performs no valuation of its own.
- It **never manufactures a total**: partial data yields `status: "partial"` with the excluded counts; nothing drawn yields `unavailable`. A zero/negative position carries no weight rather than a guessed one.
- **Number formatting is presentation only.** It changes how a value renders, never the value. Underlying amounts, precision rules and conversions are untouched, and en-US output is byte-identical to before.
- **The fiscal-year helper computes dates only.** It moves no money and reads no amount.
- **Merchant matching writes no financial data.** It selects which existing payee a row references; it creates no categories, alters no amounts, and rewrites no stored names.
- No new schema, no migration, no provider, no currency, no credential.

---

## 10. Next mission brief

Written so a planner with no repository access can choose. Ranked by value ÷ risk; dependencies stated.

**A. Fix the red baseline — recommended first.** §3. Four backend failures and one frontend regression, all named, all small. Until they are green, `main` cannot distinguish a new defect from background noise, and **every subsequent mission's CI result is uninterpretable**. Nothing should be scheduled ahead of it. Files: `provider-health/`, `securities/security-price.service.ts`, `module-graph.spec.ts`, `components/transactions/MonthNavigator.tsx` (+ `src/test/number-format-mock.ts`), `test/ui-conventions.test.ts`. No schema change, no API change.

**B. Indian merchant seeds** — small, self-contained, blocked only on decision 2. The payee foundation it needs now exists.

**C. Watchlists** — the last `BLOCKED` row needing no new data source. Small and visible: user-scoped list, add/remove, ordering, current price from the existing provider pipeline **with an explicit unavailable state** (never a zero), authorization enforced.

**D. Import identity** — content hash, idempotency, and the Fintrack CSV layout. A **schema + identity change**, so it deserves its own mission and its own design document. It is what makes re-imports safe.

**E. A portfolio return series** — the single dependency that unblocks risk statistics, drawdown, correlation and equity rolling returns at once. The price history exists; the series does not. Highest ceiling, largest scope.

**Not recommended yet:** market-cap allocation (no data exists), sentiment/events (nothing real backs them), and further Fintrack presentation work (the ledger shape now exists).

**Constraints any next mission inherits:** the conventions in §1, the design-document-first rule for anything that computes or reports money (`docs/financial-calculation-contract.md` §9), and the standing rejections in §11.

---

## 11. NEVER to be imported

**Fintrack:** inverted income sign, float money, `Math.abs` double-count traps, weak short dedup hashes, free-text transfers, `confirm()` flows, demo numbers as data, inert rule fields, destructive merchant normalization.
**Finsight:** hard-coded CAGR/XIRR, zero or placeholder analytics presented as real, AI echo shown as intelligence, orphaned provider code, float valuation, FX-blind aggregation, stored-never-rebuilt cost basis, string-patched bridges.

---

## 12. Commits / PRs

| Ref | What | State |
|---|---|---|
| `f9a0a4a35` | concentration and diversification over the existing valuation | merged |
| `bc73cecd2` | India-first number formatting + the `en-IN` preference | merged |
| `900604820` | Indian financial year + *This/Last financial year* filter periods | merged |
| `d183ddc8d` | merchant normalization in import + Indian legal forms | merged |
| `941d5204f` | zizmor: the missing `actions: read` permission | merged |
| `a31f1f2fb` | zizmor: the real cause (code scanning not enabled) + visible findings | merged |
| `e1d1eea9d` | merge `main` into the mission branch (clean; parity re-verified) | merged |
| **`e7d2125f2`** | **PR #10** — ledger month/day UX + Jest worker recycling | **merged** |
| **`85e643d82`** | **PR #11** — the five capabilities above | **merged** |
| **PR #5** | this status — **the only status PR, never merged, overwritten each mission** | open, 1 file |
