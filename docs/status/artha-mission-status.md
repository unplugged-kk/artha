# Artha mission status — Fintrack + Finsight adoption, and the CI OOM

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; the full matrices and evidence are below.

Last updated: 2026-09-12 · `main` at `f642088a0` · mission branch `fm/artha-fintrack-ux-01` (**PR #10, unmerged**)

---

## TL;DR

- **The backend unit-test OOM is diagnosed, reproduced and fixed**, with proof in both directions. `Backend Unit Tests` has been red on `main` for months **without a single failing test** — the worker hit V8's heap ceiling and aborted before Jest printed a summary, so the job reported a failure that named no test.
- **The Fintrack ledger work landed**: month navigation, day-grouped rows, per-day income/expense subtotals, and relative day names — the India-first daily-money UX that was this mission's primary priority.
- **The audits found less to absorb than expected.** Most ledger items and most Finsight analytics dimensions were **already present**; two rows in the previous matrix were **wrong** and are corrected below.
- **One Finsight item was dependency-ready but deliberately not started** — concentration/diversification. Starting a large feature on a thin budget was the worse trade; its path is written down instead.
- **No financial semantics changed.** Every change is either presentation or test-runner configuration.

---

## Mission objectives

| Objective | Result |
|---|---|
| **A** — audit Fintrack against Artha | **done** — matrix below, evidence per row |
| **B** — audit Finsight against Artha | **done** — matrix below, evidence per row |
| **C** — implement the highest-value ready capability | **partly** — Fintrack ledger implemented and validated; the Finsight increment documented and deferred |
| **D** — fix the backend unit-test OOM | **done** — cause measured, fix proved both ways, regression guard added |

---

## Objective D — the CI OOM (fixed)

**Symptom.** `Backend Unit Tests` red on `main`, with no failing test and no Jest summary in the log: `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` → `Aborted (core dumped)` (exit 134). It fails identically on `23281f1e7` (2026-09-10, the merge of PR #1, **before any India work existed**) and on the merged `main`.

**Cause — measured, not guessed.**

| Hypothesis | Measurement | Verdict |
|---|---|---|
| One enormous spec exhausts the heap | the 8,419-line `scheduled-transactions.service.spec.ts` (276 tests) passes **alone at a 1 GB cap** | false |
| Workers retain memory **across** files | three of the largest suites, each passing alone at 1 GB, **together in one worker** abort with `FATAL ERROR: Reached heap limit` | **true** |

**Fix.** `workerIdleMemoryLimit: "512MB"` in the Jest config (`backend/package.json`). A worker that goes idle above the bound is recycled, releasing the retained module graph between files. No test is disabled, no scope reduced, no assertion weakened. The heap ceiling is deliberately **not** raised — that would hide the retention rather than bound it.

**Proof — identical command both ways** (1 GB heap cap, 2 workers, the four largest suites):

```
with the setting       4 suites passed, 973 tests passed
without it (stashed)   2 workers FATAL ERROR, 2 suites failed, 442 tests ran
```

On PR #10 the same job that used to abort after ~2 minutes now runs past ten minutes without dying — a second, independent sign that the abort is gone.

**Guard.** `jest-config.guard.spec.ts` now fails if the setting is removed, so the job cannot quietly go back to reporting a crash as a test failure (26 guard tests pass).

**Separately still red on `main`:** `Workflow Security Scan (zizmor)`. Untouched by this mission and unrelated.

---

## Did any financial semantics change?

**No.** Precisely:

- No ledger, cash-leg, VOID, cost-basis, realized-gain, valuation, FX, TWR, CAGR or XIRR code was touched.
- The ledger subtotal is **presentation arithmetic over rows already on screen**; it feeds nothing and is persisted nowhere.
- It excludes **VOID** rows, **split children** and **transfers**, matching the reporting convention. A transfer between the user's own accounts is not income or expense; counting it would inflate both sides by the same amount while the position is unchanged.
- **A day whose rows span currencies reports no total** rather than adding unlike amounts without a rate, and a side is drawn only when it is non-zero.
- Sums accumulate as scaled integers and divide once — the same convention the existing running-balance column uses.
- **No new schema, no migration, no provider, no currency or sign-convention change.**

---

## Fintrack adoption matrix

`DONE` = present and working · `PARTIAL` = some pieces · `READY` = dependencies suffice, not built · `BLOCKED` = missing a dependency · `DEFERRED` = later · `REJECTED` = must not be imported.

| Capability | Status | Evidence | Next action |
|---|---|---|---|
| Month-keyed ledger view | **DONE** (this mission) | `components/transactions/MonthNavigator.tsx` + `app/transactions/page.tsx`, driving the existing date filters | — |
| Date-grouped rows | **DONE** (this mission) | `TransactionList.tsx` (`groupByDate`) + `lib/transaction-day-groups.ts` | — |
| Day subtotals | **DONE** (this mission) | `groupTransactionsByDay` — income and expense per day | — |
| Smart relative dates | **DONE** | day headings name *Today* / *Yesterday*, with the absolute date kept beside them | extend to "this week" if wanted |
| Data-quality indicators | **PARTIAL** | exists: stale-reconciliation chip (`stale-reconciliation.ts`), budget dot (`TransactionRow.tsx`). Missing: a "no category"/"no payee" mark | add a missing-category mark |
| Single add/edit modal | **DONE** | `TransactionForm.tsx` (+ split / transfer sub-forms) | — |
| Minimal required fields | **PARTIAL** | frontend zod **and** `CreateTransactionDto` require `accountId`, `transactionDate`, `amount`, `currencyCode`; all else optional | default account/currency from context more often |
| Quick add | **PARTIAL** | "Create & New" (`useTransactionSubmitMode`) and `RecentTransactionsPopover` quick-fill; no distinct minimal flow | optional |
| UPI as default payment method | **BLOCKED** | no `paymentMethod` / `payment_method` / `UPI` anywhere in frontend or backend; the only hit is a README roadmap line | needs a field + form + import support — a scope decision precedes the code |
| Indian merchant keyword starters | **READY** | payee aliases are wired into import (`alias-match.util.ts`); `payee-normalize.util.ts` and `COMMON_WORD_SEED` (payment-rail noise tokens) exist but import never calls them | wire the existing normalizer into import, then seed Indian merchants |
| Four-bucket taxonomy | **READY** | categories have hierarchy + `is_income`; no bucket concept | additive classification layer — do not replace the category model |
| INR compact / full formatting | **READY** | `useNumberFormat.ts` has compact notation but **hardcoded K/M/B/T**; `number-parse.ts` already *parses* lakh grouping; no `en-IN` preset | add lakh/crore display and an Indian number-locale option |
| Indian fiscal-year helper + April cutover | **PARTIAL** | `budgets/entities/budget.entity.ts` has `fiscalYearStart`; no general FY utility | extract one shared helper |
| Budget model + bars | **DONE** | `backend/src/budgets/**`; budget indicators in register rows | — |
| 5 % tolerance visualisation | **READY** | budget health/alerts exist | additive band |
| Six-month dashboard selector | **PARTIAL** | dashboard widget registry exists; its range selector differs | — |
| Nine-column CSV import (Fintrack layout) | **PARTIAL** | a real importer exists — CSV, QIF, multi-QIF, OFX/QFX, `.mny` — with column mapping, preview and commit (`import/import.service.ts`) | the Fintrack *layout*, UPI column and content dedup are a dedicated mission |
| Duplicate detection | **PARTIAL** | import dedup counts transfer/split signatures only; **no content hash and no unique index**. `.mny` hashes the staged *file*, not transactions | design deliberately — Fintrack's 20-character hash is REJECTED |
| Recurring transactions | **DONE** | `backend/src/scheduled-transactions/**` (richer than Fintrack's) | — |
| Accounts / cards | **DONE** | `backend/src/accounts/**` | — |
| Credit-card cycle | **PARTIAL** | `accounts/statement-cycle.service.ts` | — |
| Goals / emergency fund | **DEFERRED** | no goals module | a product module, not a foundation |
| SMS intake | **DEFERRED** | only the `sms_sender_registry` table exists; no parser | dedicated mission |
| Rules engine / auto-classification | **DEFERRED** | no rules module; no auto-categorisation | dedicated mission |

**Fintrack answer:** the *daily-money UX* was the real gap and is now largely closed — month view, day grouping, subtotals, relative dates. What remains is genuinely India-specific: UPI, lakh/crore display, merchant seeds and the fiscal-year helper.

---

## Finsight adoption matrix

| Capability | Status | Evidence | Next action |
|---|---|---|---|
| NSE / BSE equities | **DONE** | `.NS` / `.BO` via `instrument-key.util.ts` | — |
| AMFI NAVs | **DONE** | `amfi-nav.service.ts` — by scheme code, dated on the NAV's own day | — |
| Provider aliases | **DONE** | `instrument_aliases` + `instrument-alias.entity.ts` | — |
| Historical prices / NAVs | **DONE** | `security_prices` (no retention limit); AMFI returns the full scheme series; equity backfill ≈1 year, wider when transactions predate it | — |
| Portfolio valuation | **DONE** | `PortfolioService.getPortfolioSummary` + `PortfolioCalculationService` | — |
| Allocation — by security | **DONE** | `buildAllocation` | — |
| Allocation — by tag / tag-key | **DONE** | `buildAllocationByTag`, `buildAllocationByTagKey` | — |
| Allocation — sector | **DONE** | `sector-weighting.service.ts` `getSectorWeightings` — stocks direct, ETFs by weight slice | — |
| Allocation — country | **DONE** | `getCountryWeightings`; `EXCHANGE_TO_COUNTRY` maps NSE/BSE → India | — |
| Allocation — asset class | **DONE** | `getAssetClassWeightings` | — |
| Allocation — market capitalisation | **BLOCKED** | **no market-cap data exists anywhere** — no column, no weighting code, and a spec asserts `marketCap` is *not* a report column. *The previous matrix called this READY; that was wrong* | needs a provider / reference-data source before it can exist |
| Allocation — instrument type | **PARTIAL** | type is folded into asset class via `SECURITY_TYPE_TO_ASSET_CLASS` | expose type separately if wanted |
| CAGR | **DONE** | `calculateCAGR` (completeness-gated) | — |
| XIRR | **DONE** | `calculateXirr` + `xirr.util.ts` | — |
| TWR | **DONE** | `calculateTWR` | — |
| Realized / capital gains | **DONE** | `calculateRealizedGains`, by month and by day | — |
| Risk metrics (σ, Sharpe, Sortino, VaR, β, α) | **BLOCKED** | none in production code; volatility and drawdown exist only as **Monte Carlo simulation outputs** and in the GEM backtest util | needs a portfolio return series built from price history |
| Concentration / diversification | **DEFERRED (READY)** | computable read-side from the existing authoritative allocation — no new data needed | **the top Finsight candidate** — see below |
| Index data / benchmarks | **DONE** | `market_index_prices`, `performance-comparison.service.ts` | — |
| Investment reports | **DONE** | `investment-reports/**` | — |
| Alerts | **DONE** | `notification-center/**`, `push/**` | — |
| AI investment assistant | **DONE** | `backend/src/ai/**`, `mcp/**` — real providers, no mock | — |
| Portfolio-grounded AI | **PARTIAL** | `ai/context/financial-context.builder.ts` | deepen as analytics land |
| News | **PARTIAL** | `security-news.service.ts` | — |
| Sentiment / events / catalysts | **DEFERRED** | absent from production code | — |
| Stock screener | **DEFERRED** | must be reimplemented natively — Finsight's ignored its own filters, so its implementation is REJECTED as a source | — |
| MF category explorer / comparison | **DEFERRED** | AMFI search resolves schemes; no category model and no comparison | needs a category source |
| Rolling returns | **READY** (funds) | the AMFI series is fetched in full, so fund rolling returns are computable; equity history is only as deep as the backfill | bounded by equity history depth |
| Fund overlap | **DEFERRED** | only tag-exposure comments exist | — |
| Watchlists | **BLOCKED** | nothing beyond `securities.is_favourite`, a boolean | real watchlists are a small module if wanted |

**Finsight answer:** the market-data and return stack is absorbed and real — NSE/BSE, AMFI, valuation, five allocation dimensions including India-mapped country, CAGR/XIRR/TWR, realized gains, reports, alerts and AI. What is missing is **depth**: risk statistics, concentration, and MF research.

---

## Validation — actual results

| Gate | Result |
|---|---|
| **CI OOM fix, A/B** | **with**: 4 suites, **973 passed** · **without**: 2 workers OOM, 442 ran |
| Largest spec alone at a 1 GB cap | 276 passed (disproves the single-file cause) |
| Jest config guard | 26 passed |
| **Frontend — every transaction component test** | **34 files, 1205 passed** |
| New unit tests — day groups | 15 passed |
| New unit tests — month navigator | 9 passed |
| New unit tests — grouped register | 6 passed |
| `tsc --noEmit` | clean |
| eslint on every changed file | clean |
| i18n structural parity, all locales | **18/18 identical to `en`** (544 key paths); pseudo-locale regenerated |

**Two pre-existing environment limits, recorded rather than hidden:** the local Postgres does not accept the configured credentials, so the **integration** guards could not run locally (CI runs them); and four `src/i18n` spec files fail to *load* locally (`No such built-in module: node:`) — proved pre-existing by re-running with this mission's changes stashed. Structural parity was verified directly instead.

---

## Remaining gaps (actual, not aspirational)

1. **Concentration / diversification** — dependency-ready, not built. The honest shape: Herfindahl index, effective number of holdings, and top-1/top-5 share, computed read-side from the weights `PortfolioService.getPortfolioSummary` already returns, reporting **unavailable** when holdings are unpriced. No new data, no parallel engine, deterministic tests.
2. **Market-cap allocation** — blocked; no market-cap data exists to allocate.
3. **Risk statistics** — blocked on a portfolio return series; the price history exists, the series does not.
4. **UPI / payment method** — no field exists; a scope decision precedes the code.
5. **Import pack** — CSV/QIF/OFX/`.mny` import is real; the Fintrack 9-column layout, content-based dedup and Indian payment methods are a dedicated mission.
6. **Indian number formatting** — lakh/crore display and an `en-IN` preset (the formatter currently hardcodes K/M/B/T).
7. **Variable-date Indian holiday calendar** — unchanged and deliberately so; `indianCalendarComplete(year)` stays `false`, because a date recalled rather than sourced would silently mis-date a settlement. The open question is the authoritative annual source and who maintains it.
8. **Watchlists** — absent beyond a favourite flag.
9. **Six new UI strings** ship as English in the 18 full mirrors; translations pending (standing policy).

---

## Recommended next mission (dependency-ordered)

1. **Concentration / diversification analytics** — the only Finsight item that is ready today with **zero new data**. Small, read-side, deterministic, and it gives the allocation views meaning they do not currently have.
2. **Indian number formatting + fiscal-year helper** — two `READY` items, self-contained, and together they make money Indian-readable and FY reporting possible.
3. **Wire the merchant normalizer into import, then seed Indian merchants** — the normalizer already exists and import never calls it; the seeds make first-run categorisation useful.
4. **`zizmor`** — now the last red job on `main`; the unit job beside it is trustworthy again, so the remaining failure is worth clearing.
5. **Watchlists** — small and visible, but better placed after the analytics that give a watchlist something to say.

Not recommended yet: risk statistics, fund overlap and equity rolling returns (all need history depth), and the Fintrack bucket/dashboard work (presentation of a shape the ledger now has).

---

## NEVER to be imported

**Fintrack:** inverted income sign, float money, `Math.abs` double-count traps, weak short dedup hashes, free-text transfers, `confirm()` flows, demo numbers as data, inert rule fields.
**Finsight:** hard-coded CAGR/XIRR, zero or placeholder analytics presented as real, AI echo shown as intelligence, orphaned provider code, float valuation, FX-blind aggregation, stored-never-rebuilt cost basis, string-patched bridges.

---

## Mission artefacts

| Ref | What |
|---|---|
| `9f1ea16c2` | ledger: month navigation, day grouping, day subtotals |
| `e157904cf` | CI: Jest worker recycling for the OOM, plus its guard |
| **PR #10** | both of the above — **open, unmerged** |
| **PR #5** | this status — **the only status PR, never merged, overwritten each mission** |
| `f642088a0` | `main` tip (India foundation: phases #2–#9) |
| `4c1b7cce0` | previous mission: backup `REFS` rule for the SIP postings FK |
