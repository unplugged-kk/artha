# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; the matrices and evidence are below.

Last updated: 2026-09-12 · `main` at `f642088a0` · mission branch `fm/artha-productize-01` (**PR #11, unmerged**)

---

## TL;DR

- **Five tickets delivered and validated**: concentration/diversification analytics, India-first number formatting, the Indian fiscal year, merchant normalization inside import, and the `zizmor` CI job.
- **`zizmor` was not a security finding.** The job was red because `upload-sarif` could not publish — first a missing `actions: read` permission, then, underneath it, **code scanning not being enabled on this repository**. The scanner is not suppressed; its findings are now printed into the job log, which is the only place they are visible here. Enabling code scanning is a repository setting and is **escalated** (Open decisions).
- **The Indian financial year did not exist.** `budgets.fiscalYearStart` was declared and read by nothing; it is now defined once and wired into the transaction filter.
- **The merchant normalizer was never called by import**, so one merchant written three ways became three payees. It is now the matching rule — and the fix exposed that the normalizer had **no Indian legal forms**, so no Indian merchant would ever have matched.
- **Indian number formatting was correct but unreachable**: `en-IN` was not offered as a number-format preference. It is now.
- **One objective deliberately deferred**: Indian merchant seeds. The blocker is a real product decision, not budget — see *Indian merchant seeds*.
- **Careful with the stated baseline:** PR #10 (ledger month/day UX + the Jest OOM fix) is still **open and unmerged**, so `main` does not have it. Nothing here redoes that work.

---

## Current capability status

| Objective | Result |
|---|---|
| Concentration / diversification | **DONE** — `f9a0a4a35` |
| Indian number formatting | **DONE** — `bc73cecd2` |
| Indian fiscal-year helper | **DONE** — `900604820` |
| Merchant normalizer → import | **DONE** — `d183ddc8d` |
| Indian merchant seeds | **DEFERRED** — one product decision needed (below) |
| `zizmor` CI failure | **RESOLVED in code, escalated for the repo setting** — `941d5204f`, `a31f1f2fb` |
| Watchlist foundation | **NOT STARTED** — budget went to the six above |

---

## Concentration / diversification — DONE

`backend/src/securities/concentration.util.ts`, wired in `PortfolioService.getPortfolioSummary`, surfaced on the LLM/MCP summary too.

Read from the allocation the summary **already** draws — same prices, same FX, same consolidation by security, same denominator — rather than walking the holdings again. A second walk would be a second valuation, and the day it disagreed with the portfolio value beside it there would be no way to tell which was right. The module is pure and takes the slice list as input, so the two cannot drift; a **reconciliation test on the real summary path** asserts `drawnValue === Σ allocation values`.

**Measured:** Herfindahl-Hirschman index (Σ wᵢ², 0–1); effective number of holdings (its reciprocal — the standard inverse-HHI convention, named as a convention rather than as something proprietary); top-1 and top-5 share; the largest positions. **Two bases**, each with its own denominator: holdings alone, and holdings plus cash.

**Every treatment defined**, because an undefined denominator is how a concentration figure misleads:

| Question | Answer |
|---|---|
| Valuation date/time | None of its own, and it does not invent one: this is a current-state measure over the summary's own prices (each carrying its own price date) and current cash. A historical "as of" figure needs the historical valuation path and is not attempted. |
| Valuation source | The existing portfolio valuation. No second engine. |
| Cash | One slice of the *portfolio* basis, excluded from the *holdings* basis. |
| Unpriced instruments | Inherited exclusion from the allocation builder; reported as `unpricedPositions`, and `status` drops to `partial`. |
| Unconvertible currency | Same — reported as `missingRatePairs`. |
| Zero/negative value | Carries no weight; counted as `nonPositiveValuePositions` so the reader knows it exists. |
| Unavailable data | `status: "unavailable"` when nothing could be drawn. |
| Denominator | The drawn total (positive positions + positive cash), matching the allocation builder. Negative cash does **not** shrink it and inflate every weight. |

Tests (24 unit + 1 reconciliation): one holding; two equal; evenly distributed; highly concentrated; cash-only; zero-value; unpriced; partially priced; multi-account consolidation; the reporting currency; negative cash; both bases; the reciprocal identity.

---

## Indian number formatting — DONE

Chart labels were the only place that decided compact units itself, with K/M/B/T hardcoded. They now ask `Intl` which units the reader's locale counts in — `en-IN` gives 1.5K / 1.5L / 1.5Cr, `en-US` gives 1.5K / 1.5M / 1.5B / 1.5T — so nothing in the module knows the words lakh or crore, and no component needs `/100000` or `/10000000`. Each unit's threshold is derived by probing `Intl` with a known magnitude and dividing what came back, so a threshold cannot drift from its unit.

Full formatting already grouped correctly for any locale (it always went through `Intl`); that is now proved rather than assumed: `en-IN` renders `12,34,567` and `9,87,65,432`.

**The reach mattered as much as the formatting:** `en-IN` was not offered in the number-format preference, so an Indian user could reach this only through a browser locale or by choosing Hindi. It is now an option, labelled with a sample that shows its own grouping.

Digit policy unchanged — whole under the smallest unit, one decimal on the smallest unit, two above — so en-US output is byte-identical, and the en-US cases hold it to that. Tests: 11 new (grouping, compact units, negatives, zero, precision, the browser-language fallback) beside the 52 existing.

---

## Indian fiscal year — DONE

Artha had no financial-year concept at all. `budgets.fiscalYearStart` is declared on the entity and the frontend type and read by **nothing**, and the budget date helpers are monthly-only — so this defines the concept rather than centralizing one.

`frontend/src/lib/indian-fiscal-year.ts`: 1 April – 31 March, labelled by the year it begins in (FY 2026 = Apr 2026 – Mar 2027). Year of a date, start, end, range, label, and a same-year comparison. Boundaries are computed, never written as `getMonth() >= 3` at a call site.

Dates are calendar dates; a `Date` is read in **UTC**, the convention the budget helpers already use, so a timestamp near midnight cannot fall into a different year depending on the reader's machine. The one place that genuinely needs India's own zone is the trading calendar, which already has `Asia/Kolkata` helpers.

**Wired to a real consumer:** "This financial year" and "Last financial year" in the transaction filter, resolved through the existing period resolver, reading the same **local** calendar date every other period uses — so a reader ahead of UTC does not get the year that has just ended on the morning of 1 April (there is a test for exactly that).

19 tests: both boundary days, a leap day inside a year, the calendar-year rollover, contiguity, a century label, malformed input, and the resolver.

---

## Merchant normalization — DONE

Import already had a normalizer next to it and never called it. `resolvePayee` tried an exact name, then an alias, then created a payee from whatever the bank wrote — so `AMAZON PAY INDIA`, `Amazon Pay India Pvt Ltd` and `AMAZON PAY INDIA PRIVATE LIMITED` became three payees, and the register could no longer answer "how much do I spend at X". The Auto-Merge feature has used `payee-normalize` for exactly this; import did not.

It now does: exact → alias → **normalised equality**.

- **Equality, not similarity.** The fuzzy helpers are deliberately not used here: merging two genuinely different merchants files transactions under the wrong one and the user cannot see it, while a missed merge is visible and fixable in the payee list.
- **Non-destructive.** Normalisation decides *matching*; nothing stored is rewritten. A payee the import has to create keeps the raw spelling it saw. A matched payee resolves to that payee's own name, exactly as the existing exact and alias paths already did.
- **One query per import, not per transaction.** The index lives on the import context and payees created during the run register themselves, so a spelling first seen in row 3 is matched in row 300.

**A real gap this exposed:** the suffix list was European and North American (`GmbH`, `SRL`, `PTE`) with **no Indian legal form**, so `Pvt Ltd`, `Private Limited` and `LLP` survived normalisation and no Indian merchant would have matched. Those four tokens are added.

Tests (6): reuse across a spelling difference; one payee across two spellings in one import; two look-alike merchants kept apart; the raw spelling preserved on create; a name that normalises to nothing not sweeping unrelated rows onto one payee; a city-qualified variant deliberately left alone.

---

## Indian merchant seeds — DEFERRED, with the decision that unblocks it

**Not built, and not for budget reasons.** A seed table is easy; making it *do* something honest is the problem:

- Artha's category names are **user data**. The import's `categoryMap` is keyed by the spelling in the file being imported, so there is no vocabulary to map a seed's category onto.
- The only two ways to make seeds act today are (a) attach a default category to a new payee by creating categories the user never asked for, or (b) compute a suggestion that no surface renders. §"No false completion" defines both as not-implemented — and (a) also silently writes to a user's category list during an import.
- What seeds genuinely improve at the payee boundary — matching an Indian merchant written several ways — is already delivered by the normalization work above, including the Indian legal forms and digit/store-number noise.

**The decision needed:** may an import attach a *default category* to a payee it creates, and if so, how does a seed's category map onto the user's own category vocabulary (match by name, by a slug, or by asking)? Answer that and the seed table plus its matcher is a small, self-contained piece of work with the tests the mission specifies (known match, case, punctuation, UPI reference noise, near-match that must not match, multiple candidates).

---

## Import foundation — current state

| Property | State |
|---|---|
| Formats | CSV (mapped), QIF, multi-QIF, OFX/QFX, `.mny` |
| Raw-source preservation | ✅ — normalization matches, it never rewrites; a created payee keeps the raw spelling |
| Merchant normalization | ✅ — new; exact → alias → normalised equality |
| Sign convention | ✅ — Artha's own; no Fintrack sign was imported |
| Decimal-safe amounts | ✅ — existing pipeline |
| Account / transfer semantics | ✅ — existing, untouched |
| Duplicate detection | ⚠️ **partial** — transfer/split signature counting only; **no content hash, no unique index**. `.mny` hashes the staged *file*, not transactions |
| Idempotency | ⚠️ — re-import creates duplicates for non-transfer rows |
| Payment methods (UPI) | ❌ — no field exists anywhere |
| Content dedup | ❌ — deliberately not attempted; Fintrack's 20-character hash is REJECTED |

A full import redesign (content-hash identity, idempotency, the Fintrack 9-column layout) is **deferred to a dedicated mission** — it is a schema-and-identity change, not a normalizer change, and doing it inside this one would have been the scope creep the mission warns against.

---

## zizmor / CI

**It was never a security finding.** `Backend Unit Tests` (fixed in PR #10, still unmerged) and this job were the two red jobs on `main`. This one failed in `upload-sarif`, and there were **two** causes stacked:

1. A missing permission. The job declares a `permissions:` block, which sets every unnamed scope to `none`, so `actions` was `none` and reading the workflow run was refused: `##[error]Resource not accessible by integration — rest/actions/workflow-runs#get-a-workflow-run`. Fixed with `actions: read` (the least privilege that permits it).
2. Underneath it, the actual blocker: `##[error]Please verify that the necessary features are enabled: **Code scanning is not enabled for this repository.**`

So the job's colour encoded **whether a publishing feature is switched on**, not anything the scan found.

**What changed:**

- The findings are now **printed into the job log**. The SARIF upload is the richer channel but exists only where code scanning is enabled; without a readable channel the scan was invisible here, and an advisory scan nobody can read is not a control.
- **Publishing is best-effort.** Enable code scanning and the same step starts publishing with nothing else changed — that is the owner-level action this cannot reach from code.
- **Nothing was suppressed, narrowed, or silenced.** The scanner still runs over every workflow, still honours the documented suppressions in `.github/zizmor.yml`, and still writes its SARIF artifact.
- The three line-number suppressions were **re-derived twice** during this change (each edit moves `ci.yml`), verified to address the same content both times. A stale pointer silently detaches a suppression and is invisible — the config now says so.

**Verified in CI on the corrected head — the job passes, for the right reason:**

```
Report findings →  No findings to report. Good job! (5 suppressed)
Upload SARIF    →  ##[error] Code scanning is not enabled...   (step: success)
```

`No findings to report` is the scan's own verdict after the documented suppressions — which also confirms the re-derived pointers still match, since un-suppressed findings would appear here. The upload's error is real, is logged, and no longer decides the job.

**Escalated:** enabling code scanning is a repository setting.

---

## Watchlists — NOT STARTED

Nothing beyond `securities.is_favourite`, a boolean. Deferred by budget, not by a dependency: the foundation is small (user-scoped, references existing securities, add/remove, ordering, a current-price column from the existing provider pipeline with an explicit unavailable state, authorization enforced). It was last in the mission's own priority order and it stayed there.

---

## Fintrack adoption matrix

`DONE` · `PARTIAL` · `READY` · `BLOCKED` · `DEFERRED` · `REJECTED`.

| Capability | Status | Actual implementation | Evidence | Next action |
|---|---|---|---|---|
| Transaction ledger | **DONE** | `TransactionList.tsx` register | existing | — |
| Month navigation | **DONE** (PR #10, unmerged) | `MonthNavigator.tsx` + page, driving the existing date filters | not yet on `main` | merge PR #10 |
| Day grouping | **DONE** (PR #10, unmerged) | `groupByDate` + `transaction-day-groups.ts` | not yet on `main` | merge PR #10 |
| Day subtotals | **DONE** (PR #10, unmerged) | `groupTransactionsByDay` — income/expense, transfers/VOID excluded, cross-currency withheld | not yet on `main` | merge PR #10 |
| Relative dates | **DONE** (PR #10, unmerged) | *Today* / *Yesterday* in day headings, absolute date kept | not yet on `main` | merge PR #10 |
| Quick add | **PARTIAL** | "Create & New" (`useTransactionSubmitMode`), `RecentTransactionsPopover` quick-fill | no distinct minimal entry flow | optional |
| Merchant normalization | **DONE** | `import-regular-processor.service.ts` → `payee-normalize.util.ts` (exact → alias → normalised equality); Indian legal forms added | 6 new tests; 28 suites / 717 tests green | — |
| Indian merchant seeds | **DEFERRED** | none | no category vocabulary to map onto | see *Indian merchant seeds* |
| Four-bucket taxonomy | **READY** | categories have hierarchy + `is_income`; no bucket concept | additive layer | do not replace the category model |
| INR formatting | **DONE** | `useNumberFormat.ts` derives compact units from `Intl`; `en-IN` offered as a preference | 11 new tests; `en-IN` → `1.5L`, `1.5Cr`, `12,34,567` | translate the new label |
| Fiscal-year helper | **DONE** | `lib/indian-fiscal-year.ts` + *This/Last financial year* in the filter | 19 tests | — |
| Budget concepts | **DONE** | `backend/src/budgets/**`, budget indicators in the register | existing | — |
| 5 % tolerance bars | **READY** | budget health/alerts exist | tolerance band is additive | small |
| Dashboard concepts | **PARTIAL** | widget registry + range selectors; differs from Fintrack's six-month view and five KPIs | existing | product decision |
| Import | **PARTIAL** | CSV/QIF/multi-QIF/OFX/QFX/`.mny`, column mapping, preview, commit | `import/import.service.ts` | dedicated mission for dedup + layout |
| SMS intake | **DEFERRED** | only the `sms_sender_registry` table | no parser | dedicated mission |
| Rules engine | **DEFERRED** | none | — | dedicated mission |
| Goals | **DEFERRED** | none | — | product module |
| Emergency fund | **DEFERRED** | none | — | product module |
| Credit cards | **PARTIAL** | `accounts/statement-cycle.service.ts`; card payment splits | existing | — |
| Recurring transactions | **DONE** | `backend/src/scheduled-transactions/**` — richer than Fintrack's | existing | — |
| SIP plan-vs-actual | **DONE** | `sip-plan-comparison.service.ts` | PR #9, merged | — |

---

## Finsight adoption matrix

| Capability | Status | Actual implementation | Evidence | Next action |
|---|---|---|---|---|
| NSE equities | **DONE** | `.NS` via `instrument-key.util.ts` | single exchange→suffix authority | — |
| BSE equities | **DONE** | `.BO`, same table | " | — |
| AMFI | **DONE** | `amfi-nav.service.ts` — by scheme code, NAV dated on its own day | PR #6, merged | — |
| Aliases | **DONE** | `instrument_aliases` + `instrument-alias.entity.ts` | PR #3, merged | — |
| Valuation | **DONE** | `PortfolioService.getPortfolioSummary` + `PortfolioCalculationService` | completeness-gated | — |
| CAGR | **DONE** | `calculateCAGR` | real, gated on `valuationComplete` | — |
| XIRR | **DONE** | `xirr.util.ts` + `calculateXirr` | PR #9, merged | — |
| TWR | **DONE** | `calculateTWR` | existing | — |
| Realized gains | **DONE** | `calculateRealizedGains`, by month and day | existing | — |
| Allocation | **DONE** | by security, tag, tag-key, sector, country (NSE/BSE → India), asset class | `portfolio-calculation.service.ts`, `sector-weighting.service.ts` | — |
| Concentration / diversification | **DONE** | `concentration.util.ts` — HHI, effective holdings, top-1/top-5, two bases | 24 unit + 1 reconciliation test | — |
| Risk | **BLOCKED** | none in production; volatility/drawdown exist only as Monte Carlo *outputs* and in the GEM backtest util | needs a portfolio return series from the price history | build that series first |
| Drawdown | **BLOCKED** | same | same | same |
| Correlation | **BLOCKED** | same | same | same |
| Market-cap allocation | **BLOCKED** | **no market-cap data exists** — no column, no weighting code; a spec asserts `marketCap` is *not* a report column | previous matrix said READY; that was wrong | needs a reference-data source |
| Stock screener | **DEFERRED** | none | Finsight's ignored its own filters — REJECTED as a source | reimplement natively |
| Research / detail | **PARTIAL** | `security-detail.service.ts`, `security-news.service.ts` | existing | — |
| Mutual-fund analytics | **DEFERRED** | AMFI search resolves schemes; no category model, no comparison, no overlap | fund rolling returns are computable (full series); equity is bounded by backfill | needs a category source |
| Watchlists | **BLOCKED** | `securities.is_favourite`, a boolean | — | small module, not started |
| Alerts | **DONE** | `notification-center/**`, `push/**` | existing | — |
| Reports | **DONE** | `investment-reports/**`, `performance-comparison.service.ts` | existing | — |
| News | **PARTIAL** | `security-news.service.ts` | existing | — |
| Sentiment | **DEFERRED** | absent from production code | — | defer |
| Events | **DEFERRED** | absent | — | defer |
| AI investment assistant | **DONE** | `backend/src/ai/**`, `mcp/**` — real providers, no mock | concentration now in the summary | — |

---

## Financial correctness

**No financial semantics changed in this mission.** Precisely:

- No sign convention, ledger action, cash leg, VOID rule, cost-basis replay, FX rule, TWR, CAGR or XIRR was touched. Cost basis remains transaction-derived and `holdings.average_cost` a rebuildable cache.
- **The concentration measure cannot disagree with the valuation it describes**: it consumes the allocation slices, so it inherits the same prices, the same FX conversion, the same consolidation and the same denominator. It performs no valuation of its own.
- It **never manufactures a total**: partial data yields `status: "partial"` with the excluded counts, and nothing drawn yields `unavailable`. A zero/negative position carries no weight rather than a guessed one.
- Amounts it reports are the allocation's own values, unchanged and unrounded.
- **Number formatting is presentation only.** It changes how a value is rendered, never the value; the underlying amounts, precision rules and conversion are untouched, and en-US output is byte-identical to before.
- **The fiscal-year helper computes dates only.** It moves no money and reads no amount.
- **Merchant matching writes no financial data.** It selects which existing payee a row references; it does not create categories, alter amounts, or rewrite stored names.
- No new schema, no migration, no provider, no currency, no credential.

---

## Validation

| Gate | Result |
|---|---|
| Backend typecheck | clean |
| Backend — import + payees | **28 suites, 717 tests passed** |
| Backend — portfolio / concentration / calculation | 264 passed |
| Backend — portfolio.service reconciliation test | passed on the real summary path |
| Frontend — number formatting | 63 passed (11 new) |
| Frontend — fiscal year + periods | 40 passed |
| Frontend — settings + filter panel | 782 passed |
| Frontend typecheck + eslint | clean |
| i18n structural parity | **all 40 namespaces × 18 locales identical to `en`**; pseudo-locale regenerated |
| `zizmor` job | **PASSES** on the corrected head — `No findings to report. Good job! (5 suppressed)` |
| Other CI jobs on PR #11 (first pass) | Dockerfile lint, docs/manifests, Helm, license ×2, NPM audit, schema drift, PR checklist — all pass |

**Pre-existing failure met and proved baseline**: `InsightsAggregatorService › computes average monthly spending from completed months only` (date-sensitive) — it fails identically with this mission's changes stashed.

---

## Known limitations

1. **`main` does not have PR #10.** The ledger month/day UX and the Jest worker-recycling fix live only in that unmerged PR. Until it merges, `Backend Unit Tests` is still red on `main`.
2. **The Jest recycling trade-off is unresolved** — the OOM abort is gone, but the job runs materially longer and its completion was never confirmed. One CI iteration should settle whether `512MB` is the right bound or whether the two ~8,000-line suites should be split.
3. **Code scanning is not enabled**, so zizmor's findings are visible only in the job log and the SARIF artifact.
4. **Import dedup is still signature-based** — no content hash, no unique index, no idempotency for non-transfer rows.
5. **UPI / payment method does not exist** as a field.
6. **Market-cap allocation and risk statistics are blocked** on data that is not collected.
7. **The variable-date Indian holiday calendar is unchanged and deliberately so**: `indianCalendarComplete(year)` stays `false`, because a date recalled rather than sourced would silently mis-date a settlement.
8. **One new UI label** (`en-IN`) and the fiscal-year period labels ship as English in the 18 full mirrors; translations pending (standing policy).
9. **Watchlists are not started.**

---

## Open decisions

1. **Enable code scanning on the repository** (Settings → Code security). Owner action. Until then zizmor's richer channel is unavailable, though its findings are no longer invisible.
2. **Merge order for PRs #10 and #11.** #10 carries the ledger UX and the Jest fix and is independent; #11 is built from `main` and does not depend on it.
3. **The Indian holiday calendar's authoritative source** and who maintains it annually — unchanged from the last mission, still the one item of the approved foundation that is deliberately incomplete.
4. **May an import attach a default category to a payee it creates**, and how does a seed's category map onto the user's own category vocabulary? This is the single decision blocking Indian merchant seeds.
5. **The Jest recycling bound** — `512MB` versus a higher one, or splitting the two largest specs.
6. **Is UPI/payment-method a scope item?** No field exists; the code follows the decision.

---

## Recommended next mission

1. **Merge #10, then resolve the Jest recycling bound** with one CI iteration — the backend suite is currently an unknown rather than a signal on `main`.
2. **Indian merchant seeds**, once decision 4 is answered — small, self-contained, and the payee foundation it needs now exists.
3. **Watchlists** — small, visible, and the last `BLOCKED` row that needs no new data source.
4. **Import identity** (content hash, idempotency, the Fintrack layout) as its own mission — it is a schema-and-identity change.
5. **A portfolio return series**, which is what unblocks risk, drawdown, correlation and equity rolling returns at once.

Not recommended yet: market-cap allocation (no data), sentiment/events (nothing real backs them), and the Fintrack bucket/dashboard redesign (presentation of a shape the ledger now has).

---

## NEVER to be imported

**Fintrack:** inverted income sign, float money, `Math.abs` double-count traps, weak short dedup hashes, free-text transfers, `confirm()` flows, demo numbers as data, inert rule fields, destructive merchant normalization.
**Finsight:** hard-coded CAGR/XIRR, zero or placeholder analytics presented as real, AI echo shown as intelligence, orphaned provider code, float valuation, FX-blind aggregation, stored-never-rebuilt cost basis, string-patched bridges.

---

## Commits / PRs

| Ref | What |
|---|---|
| `f9a0a4a35` | concentration and diversification over the existing valuation |
| `bc73cecd2` | India-first number formatting + the `en-IN` preference |
| `900604820` | Indian financial year + `This/Last financial year` filter periods |
| `d183ddc8d` | merchant normalization in import + Indian legal forms |
| `941d5204f` | zizmor: the missing `actions: read` permission |
| `a31f1f2fb` | zizmor: the real cause (code scanning not enabled) + visible findings |
| **PR #11** | all of the above — **open, unmerged** |
| **PR #10** | ledger month/day UX + Jest worker recycling — **open, unmerged** |
| **PR #5** | this status — **the only status PR, never merged, overwritten each mission** |
| `f642088a0` | `main` tip |
