# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). The summary is below; the detail is here. **This PR is never merged — it is overwritten.**

Last updated: 2026-09-12 · Code branch `fm/artha-xirr-sip-sessions` (PR #9) · `main` at `816e2819f`

---

## TL;DR

- **The India investment foundation is now complete for everything that is safely achievable.** SIP plan-vs-actual — the one ticket deferred last mission for want of a link — is **implemented and tested**.
- **One item remains deliberately incomplete: the variable-date holiday calendar.** No trustworthy, maintainable source exists in the repository, so `indianCalendarComplete(year)` still returns `false`. Dates were **not** invented.
- Nothing was reimplemented: AMFI NAV, India instrument UX and the three investment actions were already merged and were **validated, not rebuilt**.
- **7 test failures across the swept suites — all 7 pre-existing baseline, none a regression.** Two were caught by repo guards while building SIP (see below).
- Two PRs open, **neither merged**: #9 (code) and #5 (this status).

---

## Ticket table

| Ticket | Status | Commit | PR |
|---|---|---|---|
| **A — SIP plan-vs-actual** | **DONE** — link column + write path + comparison service | `18edb3421` | #9 |
| B — India instrument UX | **DONE** (implemented earlier; re-validated) | `bc06d6f50` | #7 |
| C — BONUS / FEE / TAX_WITHHELD | **DONE** (implemented earlier; re-validated) | `383458beb` | #8 |
| D — AMFI NAV provider | **DONE** (implemented earlier; re-validated) | `47be2126c` | #6 |
| E — Indian holiday calendar | **PARTIAL** — mechanism complete; variable-date **data not curated** (deliberate) | `16861cd85` | #9 |
| — native XIRR (prior mission) | **DONE** | `8606d4f5a` | #9 |
| — India identity / NSE-BSE quoting | **DONE** (earlier missions) | `e88d29b95`, `5146e80f5` | #3, #4 |

---

## India investment foundation

**Instrument identity** — ISIN with ISO 6166 check-digit validation, AMFI scheme code, alias registry (`instrument_aliases`), India instrument types (REIT, GOLD, PPF, EPF, NPS, FD, RD, SGB, ESOP, ULIP), one central `toProviderInstrument` symbol boundary.

**Market data** — AMFI mutual-fund NAV by scheme code (dated on the NAV's own day, NSE session, 4h cache that does not cache failures, circuit-breaker, no fallback to an equity provider); NSE `.NS` and BSE `.BO` quoting through a single exchange→suffix table.

**Trading calendar** — `indianMarketDay` (weekend / named closure / trading, null for a malformed date), `nextIndianTradingDay`, `previousIndianTradingDay`, `indianHolidayName`, `effectiveIndianValuationDate`, bounded searches, and `indianCalendarComplete(year)`.

**Investment actions** — `BONUS` (quantity only, basis kept **known**, distinguishes it from ADD_SHARES whose cost is unrecorded), `FEE` and `TAX_WITHHELD` (cash only, amount from `price`, quantity ignored, positive magnitude).

**XIRR** — investor-signed dated cash flows, 365-day convention, grid scan + bisection, deterministic lowest root, `null` when no solution exists, wired into the portfolio summary beside TWR and CAGR with each flow at its own historical rate.

**SIP plan-vs-actual (new)** — the plan comes from `ScheduledOccurrenceService` (cadence, overrides and moving due dates are **not** reimplemented), the actual from the investment row the posting created. Per occurrence: `plannedAmount`, `actualAmount`, `variance`, `investmentTransactionId`, and status `matched | partial | extra | missed | voided | unknown`.

---

## Financial correctness

- **Sign convention**: unchanged. No Fintrack inverted-income convention was imported.
- **Cost basis**: unchanged, still transaction-derived; `holdings.average_cost` remains a rebuildable cache. Nothing in this mission touched replay.
- **Cash legs**: unchanged. SIP *reads* them; it does not write money.
- **The actual is never the plan.** A posted occurrence whose amount is unknowable reports `actualAmount: null` and status `unknown`, and its total is withheld. Substituting the planned amount would produce a perfect plan-vs-actual report for every portfolio — the exact defect the feature exists to expose.
- **A reversed contribution is `voided`, not `matched` and not `missed`.** The postings query reads VOID rows deliberately and says so; filtering them away would turn a reversal into an apparent missed payment.
- **`missed` means zero contributed**, which is a fact (no posting, no money), not an assumption.
- **Matching tolerance** is the storage scale (`NUMERIC(20,4)`): a difference below the fourth decimal is representation, not variance.
- **XIRR** returns `null` rather than a plausible number when no rate solves the series.
- **No hard-coded analytics** were added. No NAV, price, return or FX value is fabricated anywhere.

### Safety of this mission's change (schema / security / data)

- The one schema change is **additive and nullable**: `scheduled_transaction_postings.investment_transaction_id`, with a named FK `ON DELETE SET NULL`. **Nothing is backfilled** — the link was never recorded, and matching by date would be a heuristic standing in for a fact.
- **No destructive or irreversible migration.** `verify-schema` confirms every retained migration is a no-op when replayed on top of `schema.sql`.
- **RLS unchanged** (the table remains indirect via `scheduled_transactions`).
- **Backup coverage updated in both directions**: the column is classified `keep` in support-backup rules, and `restore-plan` defers it — `investment_transactions` restores *after* the postings table, so leaving it inline would raise a foreign-key violation on every SIP posting in a backup.
- **No credentials, no new provider trust, no new external calls.** Provider responses remain validated before use.
- **Residual risk**: a pre-existing posting reports `unknown` rather than a number. That is a visible gap, not a silent error.

---

## Fintrack adoption matrix

Evidence is the repository at this branch's head. `DONE` = implemented and working; `PARTIAL` = some pieces; `READY` = dependencies suffice; `MISSING` = not present; `DEFERRED` = later; `REJECTED` = must not be imported.

| Capability | Status | Action | Evidence |
|---|---|---|---|
| Month-keyed ledger | PARTIAL | DEFERRED | Register exists (`frontend/src/app/transactions/`); Fintrack's month keying + day grouping is UX work, not started |
| Date-grouped rows | MISSING | DEFERRED | No grouping component |
| Day subtotals | MISSING | DEFERRED | — |
| Smart relative dates | MISSING | DEFERRED | Absolute formatting only |
| Data-quality badges | MISSING | DEFERRED | Per-row badge not present |
| Quick add (date + amount) | MISSING | DEFERRED | Transaction form is full-field |
| Single add/edit modal | DONE | — | Existing transaction form |
| Minimal required date + amount | PARTIAL | DEFERRED | Amount + account required; account is forced |
| UPI default / suggestion | MISSING | DEFERRED | No payment-method field anywhere (`paymentMethod` matches nothing) |
| 9-column CSV import | MISSING | DEFERRED | No importer in `transactions/` |
| Merchant normalization | PARTIAL | READY | `payees/`, payee aliases and lookup providers already exist |
| Duplicate detection | MISSING | DEFERRED | No duplicate-transaction detection found; bulk-update "deduplicated" is a different concern |
| Four-bucket taxonomy | MISSING | DEFERRED | Categories have hierarchy + `is_income`; no buckets |
| Indian merchant keyword starters | MISSING | READY | `categories/` seeding is the natural seam |
| Six-month dashboard selector | PARTIAL | DEFERRED | Dashboard widget registry exists; range selector differs |
| Five-KPI dashboard | PARTIAL | DEFERRED | KPI set differs from Fintrack's five |
| Budget bars | DONE | — | `backend/src/budgets/**` |
| 5% tolerance bars | MISSING | READY | Budget health/alerts exist; tolerance band is additive |
| INR compact formatting | PARTIAL | READY | Number-locale formatter exists; Cr/L compaction not added |
| Indian fiscal-year helper | PARTIAL | READY | `budgets/entities/budget.entity.ts:31` has `fiscalYearStart`; no general FY utility |
| April FY cutover | PARTIAL | READY | Same field; no cutover logic outside budgets |
| Goals | MISSING | DEFERRED | No goals module |
| Emergency fund | MISSING | DEFERRED | — |
| **SIP plan-vs-actual** | **DONE** | — | `scheduled-transactions/sip-plan-comparison.service.ts` (this mission) |
| Credit-card cycle | PARTIAL | DEFERRED | `accounts/statement-cycle.service.ts` |
| Recurring transactions | DONE | — | `backend/src/scheduled-transactions/**` (richer than Fintrack's) |
| Accounts / cards | DONE | — | `backend/src/accounts/**` |
| SMS intake | MISSING | DEFERRED | Only the `sms_sender_registry` table exists; no parser |
| Rules engine | MISSING | DEFERRED | No rules module |
| Transaction auto-classification | MISSING | DEFERRED | No auto-categorisation found |

**Fintrack answer:** the *concepts* absorbed are recurring transactions, accounts/cards, budgets and now SIP plan-vs-actual; the personal-finance **UX** layer (month ledger, quick add, buckets, import) is largely unabsorbed and is a product mission, not a foundation one.

---

## Finsight adoption matrix

| Capability | Status | Action | Evidence |
|---|---|---|---|
| NSE equities | DONE | — | `.NS` via `instrument-key.util.ts` |
| BSE equities | DONE | — | `.BO` same table |
| AMFI NAVs | DONE | — | `amfi-nav.service.ts` |
| Provider aliases | DONE | — | `instrument_aliases` + `instrument-alias.entity.ts` |
| Historical prices / NAVs | DONE | — | `security_prices` + AMFI series fetch |
| Portfolio allocation | DONE | — | `portfolio-calculation.service.ts` |
| Sector allocation | DONE | — | `sector-weighting.service.ts` |
| Country allocation | DONE | — | `securities.country_weightings` + rollup |
| Market-cap allocation | PARTIAL | READY | A `marketCap` report column exists; no allocation view |
| CAGR | DONE | — | `calculateCAGR` (real, completeness-gated) |
| **XIRR** | **DONE** | — | `xirr.util.ts` + `PortfolioCalculationService.calculateXirr` |
| Risk metrics (β/α/Sharpe/Sortino/σ/VaR) | MISSING | DEFERRED | No portfolio risk surface; only a strategy backtest util |
| Diversification metrics | MISSING | DEFERRED | — |
| Drawdown | MISSING | DEFERRED | Not in production code |
| Correlation | MISSING | DEFERRED | — |
| Stock screener | MISSING | DEFERRED (reimplement natively) | Finsight's ignored every filter — REJECTED as a source |
| Stock detail / research | PARTIAL | DEFERRED | `security-detail.service.ts` |
| Index data | DONE | — | `market_index_prices`; `performance-comparison.service.ts` |
| MF category explorer | PARTIAL | READY | AMFI search resolves schemes; no category model |
| MF comparison | MISSING | DEFERRED | — |
| Rolling returns | MISSING | DEFERRED | Needs NAV history depth |
| Portfolio (fund) overlap | MISSING | DEFERRED | Only tag-exposure "overlapping" comments exist |
| News | PARTIAL | DEFERRED | `security-news.service.ts` |
| Sentiment | MISSING | DEFERRED | No hits in production code |
| Events / catalysts | MISSING | DEFERRED | No hits |
| AI investment assistant | DONE | — | `backend/src/ai/**`, `mcp/**` (real providers) |
| Portfolio-grounded AI | PARTIAL | READY | `ai/context/financial-context.builder.ts` |
| Alerts | DONE | — | `notification-center/**`, `push/**` |
| Investment reports | DONE | — | `investment-reports/**` |
| Watchlists | PARTIAL | DEFERRED | `securities/entities/security.entity.ts:129` `is_favourite` only |

**Finsight answer:** the market-data and core-return stack is absorbed and real (NSE/BSE/AMFI, allocation, CAGR, XIRR, reports, alerts, AI). The analytics *depth* (risk, drawdown, correlation, rolling returns, screener, MF comparison) is structurally ready but needs price/NAV history depth that does not exist yet.

**REJECTED, never to be imported** — Fintrack: inverted income sign, float money, `Math.abs` double-count traps, weak dedup hashes, free-text transfers, `confirm()` flows, demo numbers as data, inert rule fields. Finsight: hard-coded CAGR/XIRR, zero/placeholder analytics shown as real, AI echo shown as intelligence, orphaned provider code, float valuation, FX-blind aggregation, stored-never-rebuilt cost basis, string-patched bridges.

---

## What Artha can do now that it could not at the start of the chain

- Price an Indian mutual fund from AMFI by scheme code; price NSE/BSE equities.
- Record ISIN, AMFI scheme code and ticker aliases; create India instrument types.
- Record a bonus issue, a standalone fee, and tax withheld.
- Reason about Indian trading days and the day a valuation should be struck on.
- Report **XIRR** beside TWR and CAGR.
- **Compare a SIP plan with what was actually invested**, per occurrence, including missed, partial, extra and reversed contributions — with an explicit "unknown" wherever the amount cannot be established.

---

## Validation

| Gate | Result |
|---|---|
| SIP plan-vs-actual (new) | **13 passed** |
| XIRR solver | **19 passed** |
| Indian calendar module | **26 passed** |
| securities + scheduled-transactions + backup sweep | **3015 passed, 7 failed** |
| `scripts/verify-schema.sh` | **OK** — migration replay is a no-op on `schema.sql` |
| typecheck, lint | clean |
| Frontend suite | **not run** (no frontend change this mission) |
| Full backend suite | **not run** — the targeted sweep above was used instead |

**All 7 failures are pre-existing baseline, verified as a set with no other failures present:**

| # | Failure | Cause |
|---|---|---|
| 1–5 | `AutoBackupService` (5 tests) | macOS resolves `/var/folders/…` to `/private/var/folders/…`, so the expected temp path differs. Platform-specific, environmental, not code. |
| 6 | `SecurityPriceService › backfillSecurityHoldingPeriod › still clips when no range is given` | expected `< 40`, got `40` — red on `main` |
| 7 | `YahooFinanceService › fetchHistorical › should set hours to midnight` | `getHours()` expected `0`, got `5` (IST runner vs UTC-midnight date) — red on `main` |

**Two regressions I introduced and fixed** (recorded because both were caught by repo guards, not by me):

1. My XIRR query used the `investmentEffectStatusSql` helper, which expands to `status != 'VOID'` at runtime but is invisible to the void-classification guard's **static** scan. Replaced with the literal predicate the guard documents.
2. Adding the SIP column pushed `support-backup-rules.ts` past the repository's **line ceiling** (802 > 800). Fixed by trimming my own comment rather than grandfathering the file.
   A third guard — `restore-plan`'s forward-reference check — was satisfied before it could fail, because the postings table restores before `investment_transactions`.

---

## Known limitations

1. **Variable-date Indian holidays are not curated.** Only the three statutory national closures are encoded. `indianCalendarComplete(year)` returns `false`, and an "open" verdict means "no *known* closure" — not a claim the exchange traded. This is deliberate: a date recalled rather than sourced would silently mis-date a settlement.
2. **SIP amounts for postings made before this change report `unknown`.** Nothing was backfilled. Future postings link exactly.
3. **`TAX_WITHHELD` is still not linked** to the income row it was withheld from.
4. **XIRR omits a REDEEM's accrued-interest companion** (that companion carries no cash leg of its own) — documented in code.
5. **SIP comparison is a service, not a surface.** The foundation is complete and tested; no UI renders it yet (deliberately — the mission asked for the foundation, not a dashboard).
6. Two baseline test failures and five macOS-environmental failures remain, as above.

---

## Open decisions

**One, and it is a data-sourcing decision rather than an engineering one:**

**The Indian holiday calendar needs an authoritative, maintainable source.** The mechanism is finished and waiting: adding a year to the variable-date table flips `indianCalendarComplete(year)` to `true` and every consumer inherits it at once. What it needs is a decision on where the dates come from — the NSE/BSE published annual trading-holiday list, transcribed and versioned per year — and who maintains it annually. Until then the calendar is honest about what it does not know. No other decision is outstanding; everything else in this mission was ordinary additive work.

---

## Recommended next mission

Ranked by dependency readiness, financial correctness, user value and leverage:

1. **Indian holiday-data curation** — the only unfinished item of the approved foundation, and the mechanism already reports when it is done. Small, bounded, real correctness value for settlement and valuation dating.
2. **`TAX_WITHHELD` attribution link** — small additive work that completes the action's contract.
3. **Market-cap allocation** — `READY` on the existing weighting architecture; the last allocation dimension Finsight had that Artha lacks.
4. **Indian fiscal-year helper + Indian merchant category seeds** — both `READY`, self-contained, and they unlock FY reporting and first-run categorisation together.
5. **Fund overlap / MF comparison** — high value, but genuinely blocked on NAV history depth; needs its own data-retention work first.

Deliberately *not* recommended yet: risk metrics, drawdown, correlation and rolling returns (all blocked on history depth), and the whole Fintrack personal-finance UX layer (a redesign, not a foundation).

---

## Commits / PRs

| Ref | What |
|---|---|
| `18edb3421` | SIP plan-vs-actual: link column, write path, comparison service, tests |
| `8606d4f5a` | native XIRR + portfolio wiring |
| `16861cd85` | Indian trading calendar |
| **PR #9** | `fm/artha-xirr-sip-sessions` → calendar, XIRR, SIP — **open, unmerged** |
| **PR #5** | this status — **open, never merged, overwritten each mission** |
| `816e2819f` | `main` tip; contains the earlier merged phases (#2–#8) |
