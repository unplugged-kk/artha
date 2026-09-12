# Artha — India investment foundation: mission status

**Living status document.** Rewritten (not appended) at the end of each working turn. This PR is never merged; it is overwritten.

Last updated: 2026-09-12 · Status branch `fm/artha-mission-status` · Code branch `fm/artha-xirr-sip-sessions` (PR #9)

---

## TL;DR

- **The mission is PARTIAL.** Two of the six tickets were outstanding when it began and both are done: the Indian trading calendar and **native XIRR**. The other four (AMFI NAV, India instrument forms, BONUS/FEE/TAX_WITHHELD, IST sessions) were **already implemented and merged** in the previous turn, so they were validated rather than rebuilt.
- **Ticket F (SIP plan-vs-actual) is deferred, not started** — the data it needs does not exist yet. Reason below; a fabricated half-model was refused.
- **Indian holiday *data* is not curated** — the mechanism is complete and reports that it is incomplete, rather than inventing dates.
- `main` is at `816e2819f`. This mission's code is on `fm/artha-xirr-sip-sessions` (PR #9, unmerged).
- The only failing CI checks are the two **pre-existing** ones, already red on `main`.

---

## Ticket table

| Ticket | Status | Commit | PR |
|---|---|---|---|
| A — AMFI mutual-fund NAV | **DONE** (implemented and merged before this mission; validated) | `47be2126c` | #6 |
| B — IST sessions + Indian holidays | **PARTIAL** — IST session primitives were already merged; **calendar primitives added this mission**; variable-date holiday **data not curated** | `16861cd85` | #9 |
| C — India instrument forms | **DONE** (merged before this mission; validated) | `bc06d6f50` | #7 |
| D — BONUS / FEE / TAX_WITHHELD | **DONE** (merged before this mission; validated). `TAX_WITHHELD` attribution **link** still outstanding | `383458beb` | #8 |
| E — native XIRR | **DONE** | `8606d4f5a` | #9 |
| F — SIP plan-vs-actual | **DEFERRED — not started** | — | — |

Merged earlier, on the captain's instruction: #2 `f470222e3`, #3 `e88d29b95`, #4 `5146e80f5`, #6 `7e5c84cf4`, #7 `5d36f76d1`, #8 `816e2819f`.

---

## What Artha can do now that it could not before this mission

- **Report a money-weighted return (XIRR)** for a portfolio, computed from the ledger's real dated cash flows, alongside TWR and CAGR — with `null` (never a plausible number) when the series has no solvable rate.
- **Reason about Indian trading days**: is a date a weekend, a known closure, or a trading day; the next/previous trading day; and which Indian trading day a valuation should be struck on.
- (From the merged work) price an Indian mutual fund from AMFI by scheme code, price NSE/BSE equities, record ISIN / AMFI scheme code / ticker aliases, create India instrument types from the UI, and record a bonus issue, a standalone fee and tax withheld.

---

## Financial correctness

- **Cost basis**: unchanged and still transaction-derived; `holdings.average_cost` remains a rebuildable cache. Nothing here touched it.
- **Cash legs**: unchanged. XIRR *reads* them, via `computeInvestmentCashImpact` — the single sign authority — so a bonus contributes nothing, a fee is an outflow, and a reinvestment is neutral without any rule being restated.
- **Action semantics**: `BONUS` quantity-only with a **known** basis; `FEE`/`TAX_WITHHELD` cash-only, amount from `price`, quantity ignored, stored as a positive magnitude.
- **XIRR methodology**: fixed grid scan for the first sign change, then bisection; deterministic; lowest root when several exist; result is a percentage matching CAGR; each flow converted at its own historical rate; terminal value supplied by the caller's valuation so the two cannot disagree.
- **Missing data**: an unpriceable or unconvertible portfolio yields `null` XIRR, not a subtotal-based figure. An uncurable holiday yields "no *known* closure" plus a `calendarComplete: false` signal, not a claim the market was open.
- **No hard-coded analytics**: no CAGR/XIRR/NAV/price/gain literal was added anywhere.

---

## Provider behaviour

| Provider | Behaviour |
|---|---|
| **AMFI** | Addressed by scheme code from `securities.amfi_scheme_code`; NAV dated on the NAV's own day with the NSE session; 4h cache (a failure is not cached); circuit-breaker + health tracking; **no fallback** to an equity provider; unreadable payload / HTTP failure / zero / negative / future-dated NAV → `null`. |
| **NSE / BSE** | Yahoo symbols built through the single exchange→suffix table (`NSE → .NS`, `BSE → .BO`); already-qualified symbols pass through. |
| **Aliases** | `instrument_aliases` (global reference data) resolves a retired ticker before formatting. |
| **Historical data** | AMFI returns the whole NAV series from one endpoint (oldest first, no invented OHLC); equity history unchanged. |
| **Failure behaviour** | A provider failure yields no price and never a zero; `security_prices` is not written with a fabricated value. |

---

## Validation

| Gate | Result |
|---|---|
| XIRR solver (new) | **19 passed** |
| Indian calendar module (extended) | **26 passed** |
| Portfolio calculation + service | **239 passed** |
| Securities suite (whole) | **1787 passed, 2 failed — baseline** |
| `scripts/verify-schema.sh` | clean (no schema change this mission) |
| typecheck, lint | clean |
| Frontend suite | **not run this mission** (no frontend change; last recorded run 16,397 passed) |

**Baseline-failure ledger (not regressions):**
1. `SecurityPriceService › backfillSecurityHoldingPeriod › still clips when no range is given` — expected `< 40`, got `40`.
2. `YahooFinanceService › fetchHistorical › should set hours to midnight on returned dates` — `getHours()` expected `0`, got `5` (runner is IST/UTC+05:30 against a UTC-midnight date).

Both reproduce on the merged `main` with this mission's work stashed. They also surface in CI as `Backend Unit Tests` and `zizmor`, both red on `main` independently of any of this work.

**One regression I introduced and fixed** (recorded because it is the kind of thing that silently ships): the first XIRR query used the `investmentEffectStatusSql` helper for its VOID filter. That expands to `status != 'VOID'` at runtime but is invisible to the void-classification guard's **static** scan, which flagged the query site. I replaced it with the literal predicate the guard documents. The guard caught it, not a test of mine.

---

## Known limitations

1. **SIP plan-vs-actual is not implemented.** `scheduled_transaction_postings` records *that* an occurrence happened (`scheduled_transaction_id`, `original_due_date`, `posted_date`) but **not the amount it booked**, and there is no link to the investment transaction the post created. An exact actual-amount comparison therefore needs (a) an additive nullable `investment_transaction_id` on the posting, set in the post path, and (b) reuse of the existing occurrence API for expected dates. Reporting the planned amount as "actual" would fabricate the number the comparison exists to produce.
2. **Indian holiday data is not curated.** Only statutory national closures are encoded; the variable-date list is empty by design and `indianCalendarComplete(year)` says so. Any consumer that must not assume can read that flag.
3. **`TAX_WITHHELD` is not linked** to the income row it was withheld from (needs a DTO field plus a guard).
4. **XIRR omits a REDEEM's accrued-interest companion** (that companion carries no cash leg of its own). Confined to bonds redeemed with accrued interest. Documented in the code.
5. **Twelve UI strings are English pending translation** across the non-`en` locales (parity requires every key to exist everywhere).
6. Two baseline test failures remain, as above.

---

## Open decisions

Only one, and it is a scope decision rather than an implementation detail:

1. **Ticket F**: approve the additive link column (`scheduled_transaction_postings.investment_transaction_id`, nullable, `ON DELETE SET NULL`) plus the post-path write and a read model — or leave SIP comparison deferred and take a different next mission. The column is additive and non-destructive; the alternative is no exact SIP comparison ever.

Nothing else needs a human: the holiday-data gap is a curation task with a named source, and the TAX link is ordinary additive work.

---

## Fintrack / Finsight adoption matrix

Evidence is the merged repository at `816e2819f`. `DONE` = implemented and validated; `PARTIAL` = some pieces exist; `READY` = dependencies now suffice; `BLOCKED` = prerequisite missing; `DEFERRED` = intentionally later; `REJECTED` = must not be imported.

### Fintrack-derived capabilities

| Capability | Artha status | Action | Evidence |
|---|---|---|---|
| Month-keyed transaction ledger | PARTIAL | DEFERRED | Register exists (`frontend/src/app/transactions/`, `register/`); Fintrack-style month keying + day grouping is UX work, not started |
| Date-grouped rows with day subtotals | MISSING | DEFERRED | No grouping/subtotal component found |
| Smart relative dates | PARTIAL | DEFERRED | Date formatting exists (`frontend/src/lib/format.ts`); relative labels not added |
| Data-quality badges | PARTIAL | DEFERRED | `built-in-reports/data-quality-reports.service.ts` exists; no per-row badge |
| Quick add (date + amount only) | MISSING | DEFERRED | Transaction form is full-field |
| Single add/edit modal | DONE | — | Existing transaction form |
| UPI as default payment mode | MISSING | DEFERRED | No payment-mode field |
| Four-bucket taxonomy | MISSING | DEFERRED | Categories have hierarchy + `is_income`; no buckets |
| Indian merchant keyword starters | MISSING | READY | `categories/country-category-additions.ts` is the natural seam |
| Budget presentation | DONE | — | `backend/src/budgets/**` (budgets, periods, alerts, health) |
| 5% tolerance budget bars | MISSING | READY | Budget health/alert services exist |
| Six-month selector / five KPIs | PARTIAL | DEFERRED | Dashboard widget registry exists; KPI set differs |
| INR compact / full formatting | PARTIAL | READY | Number-locale formatter exists; Cr/L/K compaction not added |
| Indian fiscal-year helper (April cutover) | MISSING | READY | No FY utility anywhere (0 files) |
| Goals | MISSING | DEFERRED | No goals module |
| Emergency-fund planning | MISSING | DEFERRED | — |
| SIP plan-vs-actual | **DEFERRED (this mission)** | BLOCKED | Posting has no amount and no transaction link — see limitation 1 |
| Credit-card cycle concepts | PARTIAL | DEFERRED | `accounts/statement-cycle.service.ts` + statement fields |
| SMS transaction intake | MISSING | DEFERRED | `sms_sender_registry` table exists (Phase 2 schema); no parser |
| Rules engine | MISSING | DEFERRED | No rules module |
| Recurring transactions | DONE | — | `backend/src/scheduled-transactions/**` (superior to Fintrack's) |
| Account / card management | DONE | — | `backend/src/accounts/**` |

### Finsight-derived capabilities

| Capability | Artha status | Action | Evidence |
|---|---|---|---|
| NSE / BSE equity support | **DONE** | — | `providers/instrument-key.util.ts`, merged #4 |
| AMFI mutual-fund NAV | **DONE** | — | `amfi-nav.service.ts`, merged #6 |
| Instrument taxonomy (incl. India pack) | **DONE** | — | `security-enums.ts` (REIT/GOLD/PPF/EPF/NPS/FD/RD/SGB/ESOP/ULIP) |
| Provider alias registry | **DONE** | — | `entities/instrument-alias.entity.ts` + `instrument_aliases` |
| Portfolio allocation | DONE | — | `portfolio-calculation.service.ts` allocation rollups |
| Sector allocation | DONE | — | `sector-weighting.service.ts` |
| Country allocation | DONE | — | `securities.country_weightings` + rollup |
| Market-cap allocation | MISSING | READY | Needs instrument metadata; no new architecture |
| CAGR | DONE | — | `calculateCAGR` (real, completeness-gated) |
| **XIRR** | **DONE** | — | `xirr.util.ts` + `PortfolioCalculationService.calculateXirr` (this mission) |
| Risk metrics (β/α/Sharpe/Sortino/σ/maxDD/VaR) | MISSING | DEFERRED | Finsight's were zeros — build natively later, never copy |
| Diversification metrics | MISSING | DEFERRED | — |
| Drawdown / correlation | MISSING | DEFERRED | Needs deep price history |
| Stock screener | MISSING | REJECTED as source / DEFERRED natively | Finsight's ignored every filter |
| Stock detail / research view | PARTIAL | DEFERRED | `security-detail.service.ts`, `security-news.service.ts` |
| Index data | DONE | — | `market_index_prices`, NIFTY/SENSEX symbols |
| MF category explorer | PARTIAL | READY | AMFI search returns schemes; no category model |
| MF comparison / rolling returns / overlap | MISSING | DEFERRED | Needs NAV history depth |
| News | PARTIAL | DEFERRED | `security-news.service.ts` |
| Sentiment | MISSING | DEFERRED | — |
| AI investment assistant | DONE | — | `backend/src/ai/**` + `mcp/**` (real providers) |
| Portfolio-grounded AI | PARTIAL | READY | `ai/context/**` exists; grounding depth unverified |
| Alerts | DONE | — | `notification-center/**`, `push/**` |
| Investment reports | DONE | — | `investment-reports/**` |
| Watchlists | PARTIAL | DEFERRED | `securities.is_favourite` only |

### Explicitly REJECTED (never to be imported)

Fintrack: inverted income-negative sign convention; float money accumulation; `Math.abs` double-count traps; 20-character dedup "hash"; free-text transfers; `confirm()` delete flows; demo seed numbers as product data; inert rule-engine fields.

Finsight: hard-coded CAGR/XIRR; zero/placeholder analytics presented as real; AI echo presented as intelligence; orphaned market-data code; float portfolio valuation; FX-blind aggregation; stored-never-rebuilt cost basis; the string-patched live bridge.

---

## Recommended next features (ranked)

Ranked by dependency readiness, financial correctness, user value, architectural leverage, implementation risk.

| # | Candidate | Why it ranks here |
|---|---|---|
| 1 | **SIP plan-vs-actual** (Ticket F) | The only remaining item of the approved chain; blocked only on one additive column. Highest leverage: it turns the existing scheduled-investment engine into a visible product capability. |
| 2 | **Indian holiday-data curation** (finish Ticket B) | Small, closes a real correctness gap (settlement on a holiday), and `indianCalendarComplete` already tells every consumer when it is done. |
| 3 | **`TAX_WITHHELD` attribution link** | Small additive work that completes the action's contract. |
| 4 | **Indian fiscal-year helper + Indian merchant category seeds** | Both are small, `READY`, self-contained, and unlock FY reporting and first-run categorisation. |
| 5 | **Market-cap allocation** | `READY` on the existing weighting architecture and the newest India instrument metadata; adds real analytical value without new infrastructure. |

Deliberately *not* recommended yet: risk metrics, drawdown, correlation, MF comparison/rolling returns (all need price/NAV history depth that does not exist), and anything from the deferred personal-finance UX list (a redesign, not a foundation).

---

## Recommended next mission

**"Finish the India investment chain": SIP plan-vs-actual + holiday-data curation + the TAX attribution link.** All three are bounded, additive, and unambiguous; together they close the last gaps in the approved foundation rather than opening new surface. If only one is taken, take **SIP plan-vs-actual** — it is the last unbuilt item of the original chain and its blocker is a single additive column.
