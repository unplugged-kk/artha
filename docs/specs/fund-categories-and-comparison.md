# Mutual-Fund Categories & Comparison — Specification

Status: **Approved** 2026-09-26 (owner-delegated). Produced by a read-only
evidence + specification mission and committed as documentation only: no
production source was changed and no implementation has been started.

This is the design document required by `docs/financial-calculation-contract.md`
section 9 ("a financial feature of any substance starts from a short written
design document, approved before implementation"). On approval it becomes the
first commit of the implementation, landed as
`docs/specs/fund-categories-and-comparison.md`.

Baseline: `main` @ `88aba19ec`. The comparison half **depends on the approved
Fund Rolling Returns capability** (`docs/specs/fund-rolling-returns.md`, commit
`e6c2c9741`, code PR #24 on `fm/artha-finsight-rolling-returns`), which supplies
the single approved return engine and the `loadPriceSeries` parameters this spec
reuses. The category half is independent of it.

Owner decisions taken for this spec (asked and confirmed):

1. **Category source** — capture the AMFI classification (`scheme_category`,
   `scheme_type`, `fund_house`) from the **existing** mfapi provider, stored
   verbatim on the security.
2. **Comparison** — side-by-side **rolling-return distributions** of the user's
   own AMFI funds, grouped by AMFI category. No trailing point-to-point figures
   (they would duplicate the Security Performance card).
3. **Ranking** — deterministic **column sort only**; no "best fund" badge, score,
   order or recommendation.

---

## 1. What was originally intended (Finsight evidence)

`finsight-ai/README.md:10` advertises:

> **Mutual Fund Intelligence** — Category explorer, fund comparison (4 funds),
> rolling returns heatmap, risk metrics, portfolio overlap detection

The implementation behind that claim is almost entirely stubs:

| Claim | Implementation | Real? |
|---|---|---|
| Category explorer | `fullstack/backend-scaffold/src/routes/mutualFunds.ts:8-30` `list` (filter by `category`/`amc` over the `mutual_funds` table) | **Partial, dead** — the table is never populated |
| Fund detail | `mutualFunds.ts:32-41` `getById` | Same dead table |
| Fund comparison (4 funds) | `mutualFunds.ts:43-51` `compare` — takes `fundIds` 2-4, returns the rows plus **`comparison: {}`** | **Stub** |
| Rolling returns heatmap | `mutualFunds.ts:53-63` `rollingReturns` — `SELECT 1`, returns `periods: []` | **Stub** |
| Portfolio overlap | `mutualFunds.ts:65-70` `portfolioOverlap` — `SELECT 1`, returns `overlap: 0` | **Stub** |
| Risk metrics | `routes/analytics.ts` — the mission-status harvest already recorded these as hard-coded zeros | **Rejected source** |

The `mutual_funds` table (`fullstack/backend-scaffold/src/db/schema.ts:85-94`)
is `{ id, name, amc, category, nav, nav_date, returns(jsonb), last_updated }`.
The `list` route's `riskLevel`/`rating` inputs (`mutualFunds.ts:13-14`) have
**no columns** and are never applied; `sortBy`/`page` are likewise ignored. A
repo-wide search for `insert(mutualFunds)` / `.values(` finds population only for
users, alerts, reports, stock_quotes and portfolios — **the fund catalog is never
written**, so every `mutualFunds` endpoint returns nothing in practice.

The only functioning mutual-fund surface is the original UI overlay
`original-ui/lib/live-mf.js` — a table of the **user's own held funds** (scheme
code, name, live NAV, NAV date, day change, average cost, P&L), fed by
`original-ui/live-server.mjs` (`/__live/mf`). Its "category" is a **heuristic,
not data**:

- `live-server.mjs:538` — `category: h.sector || 'Equity'`
- `live-server.mjs:765-779` `marketCapBucketOf` — defaults a mutual fund to
  `'Mid Cap'` (`:777`)
- `live-server.mjs:730-763` `sectorBucketOf` — substring rules
  (`'flexi'` → Flexi Cap, `'small'` → Small Cap, …)
- `live-server.mjs:781-807` `extractAmc` — AMC guessed from the scheme **name**
  by regex (`/hdfc/i` → "HDFC Mutual Fund", …)

**Selection for Artha.** Artha already adopted Finsight's *rolling returns* and
*concentration* natively (Missions 4 and 3). The two remaining mutually-fund
capabilities are **categories** and **comparison**. Overlap and risk metrics were
already recorded REJECTED/BLOCKED in the harvest. Nothing in Finsight's
implementation is copied: the stubs are empty, and its category is a name
heuristic Artha's own precedent forbids (below).

---

## 2. Artha current state (audited)

| Capability | Status | Evidence |
|---|---|---|
| AMFI identity on a security (`amfi_scheme_code`) | **DONE** | `security.entity.ts:104-110`; `schema.sql:679`; partial unique index `idx_securities_user_amfi_code` `schema.sql:714` |
| AMFI NAV provider + routing | **DONE** | `providers/quote-provider.registry.ts:48-66`; `amfi-nav.service.ts`; parser `providers/mfapi-payload.util.ts` |
| AMFI `scheme_category` / `scheme_type` / `fund_house` captured | **NOT DONE** | parser reads only `meta.scheme_code` (`mfapi-payload.util.ts:127`) and `meta.scheme_name` (`:136-139`); fields appear only in test fixtures (`amfi-nav.service.spec.ts:5-16`, `mfapi-payload.util.spec.ts:12-26`) |
| Any fund-category model (column, DTO, UI) | **NOT DONE** | `securities` has `sector`/`industry` (Yahoo stock fields, `security.entity.ts:162-170`), `sectorWeightings`/`countryWeightings`/`assetWeightings` (manual JSONB, `:172-193`) — no fund category |
| NAV history storage (whole mfapi series) | **DONE** | `amfi-nav.service.ts:97-112` (range ignored, full series), `security-price.service.ts:1558-1576` (stored unclipped) |
| One-basis price-series door | **DONE** | `common/time-series/price-series.util.ts` (`loadPriceSeries`) |
| Rolling-return engine (1Y/3Y/5Y distribution) | **PARTIAL** — approved, on PR #24 | `securities/rolling-returns.util.ts`, `performance-comparison.service.ts#getRollingReturns` |
| Instrument-vs-instrument comparison chart | **DONE** (generic) | `performance-comparison.service.ts#getComparison` already plots ≥2 selected **securities** against each other, not only indexes |
| Category grouping / filter anywhere | **NOT DONE** | allocations group by security type, sector, country, asset class, tags (`sector-weighting.service.ts`, `investment-reports.service.ts`, `AssetAllocationChart.tsx`) — never a fund category |
| Ranking / peer percentile / category benchmark | **NOT DONE** | no fund ranking exists; `investment-reports` groupBy = `{ NONE, ACCOUNT, SYMBOL, CURRENCY }` only |
| Fund universe / catalog (browse any scheme with its category) | **BLOCKED** | Artha stores NAVs only for held securities; mfapi `/mf/search` returns codes+names only (`mfapi-payload.util.ts:156-177`) |
| Risk metrics (volatility, drawdown, Sharpe) | **BLOCKED** | no flow-adjusted periodic return series; Finsight source rejected; needs its own spec |
| Growth/IDCW, Direct/Regular as a supported distinction | **NOT DONE** | plan option lives only inside `scheme_name`; `india_holdings_ext.plan_type` is per-position, not per-security |

**Governing precedent for what "category" must and must not be.**
`docs/specs/fund-rolling-returns.md` §3 refuses name-based IDCW detection: *"no
name-based detection: a heuristic with no schema field behind it is not a
classification."* `docs/gem-strategy.md:339-367` makes the same class of rule
explicit for fund composition: *"A floor is never printed as a measurement"*,
*"No description, no estimate."* The Finsight name/regex heuristics
(`live-server.mjs:781-807`) are therefore **rejected as a source**.

---

## 3. Category specification

### 3.1 What "category" means in Artha

A **fund category** is the classification AMFI publishes for a scheme, captured
verbatim. It is a property of the **scheme** (hence of the security that carries
that scheme code), not of the user, the holding, or the portfolio. Artha does not
own this taxonomy and must not invent, normalise, or infer it.

### 3.2 Where category data comes from

Only one source is legitimate and in-architecture: the **existing AMFI provider**
(`AmfiNavService` → mfapi `GET /mf/{code}`, `meta` block), whose payload already
returns:

```json
"meta": {
  "fund_house": "Example Mutual Fund",
  "scheme_type": "Open Ended Schemes",
  "scheme_category": "Equity Scheme - Large Cap Fund",
  "scheme_code": 122639,
  "scheme_name": "Example Large Cap Fund - Direct Plan - Growth"
}
```

(fixture: `backend/src/securities/providers/mfapi-payload.util.spec.ts:12-19`).

Rejected alternatives, with reasons:

| Source | Verdict |
|---|---|
| **AMFI via existing mfapi provider** | **CHOSEN.** Authoritative, already fetched on every NAV call, no new provider. |
| A separate AMFI/SEBI category master | **REJECTED** — a new data source/provider; the mission keeps the existing market-data architecture. |
| Existing Artha taxonomy (`sector`, `industry`, tags, asset class) | **REJECTED** — these are stock/portfolio concepts; `sector` is a Yahoo stock field and is empty for AMFI funds. Using it would reproduce Finsight's `h.sector \|\| 'Equity'` error. |
| User-entered metadata | **REJECTED for v1** — not authoritative, and misclassification would make every "same category" claim wrong. (A user *tag* already exists via `security_tags` for personal grouping; it is not a fund category and is not used here.) |

### 3.3 Hierarchy, identifier, name

AMFI's own three levels, stored verbatim, no new normalisation:

| Level | Stored field | Example |
|---|---|---|
| Fund house / AMC | `fund_house` | `Example Mutual Fund` |
| Scheme structure | `fund_scheme_type` | `Open Ended Schemes` |
| Scheme category | `fund_category` | `Equity Scheme - Large Cap Fund` |

- **Category identifier** = the exact, trimmed `fund_category` string
  (case-sensitive, byte-for-byte as published). Grouping is string equality on
  that key. No case-folding, no aliasing, no synonym table — any of those would
  be Artha inventing a taxonomy.
- **Display name** = the same string, optionally split for presentation only at
  the edge: group = text before the first `" - "`, category = the remainder
  (`"Equity Scheme - Large Cap Fund"` → group `Equity Scheme`, category
  `Large Cap Fund`). The split is a rendering rule with a unit test; it never
  creates a second stored field and never feeds a calculation.
- **Classification level** = **scheme-level**. Category and sub-category are
  attributes of a scheme, not rows in a taxonomy table. There is deliberately
  **no `fund_categories` table**: the set is provider-owned and opaque, and
  materialising it would fabricate an Artha taxonomy.

### 3.4 Storage

Four nullable columns on `securities` (mirroring how `sector`/`sector_data_updated_at`
are modelled — provider metadata on the instrument):

```
fund_house                      VARCHAR(120)   NULL
fund_scheme_type                VARCHAR(80)    NULL
fund_category                   VARCHAR(120)   NULL
fund_classification_updated_at  TIMESTAMP      NULL
```

- New migration `database/migrations/20260926000000_fund_classification.sql`,
  additive and idempotent (`ADD COLUMN IF NOT EXISTS`), plus the matching
  `database/schema.sql` edit so schema/entity parity holds
  (`test/integration/schema-entity-parity.integration.spec.ts`).
- Entity additions on `Security` (`security.entity.ts`).
- No RLS change: the columns live on the already user-scoped `securities` table.
- **No fingerprint / no materialisation** (`financial-calculation-contract.md`
  §5 N/A): this is source metadata, not a derived result. Nothing is computed
  from it beyond grouping by equality.

### 3.5 Capture, refresh and update behaviour

Capture rides the **existing** AMFI fetch. Extend the pure parser so the meta is
available wherever the scheme payload is parsed:

- `MfapiScheme` (`mfapi-payload.util.ts:28-36`) gains
  `fundHouse: string | null`, `schemeType: string | null`,
  `schemeCategory: string | null`; `parseMfapiSchemePayload` (`:122-148`) reads
  them from `meta`, trimming and returning `null` for a non-string/blank value —
  never `""`, never a default.
- A new enrichment method mirrors `SectorWeightingService.ensureSectorData`
  (`sector-weighting.service.ts:162-230`), which is the established pattern for
  pulling provider metadata onto a security:

  `ensureFundClassification(securities)` — for each security with a non-blank
  `amfiSchemeCode`, when `fund_classification_updated_at` is absent or older than
  `FUND_CLASSIFICATION_STALE_MS` (7 days, matching the sector path), fetch the
  scheme meta (reusing `AmfiNavService`'s existing 4h payload cache) and write.

  **Write rule (the load-bearing one).** The `securities` row is updated **only
  when the provider actually answered** — the same distinction
  `fillEtfBreakdowns` documents (`sector-weighting.service.ts:244-250`): `null`
  means the request failed, and a failed request must neither erase a known
  category nor stamp freshness. Concretely: on a non-null `schemeCategory`,
  overwrite and stamp `fund_classification_updated_at`; on `null`, change
  nothing (no clobber, no stamp). This is INV-FUNDCAT-002.
- Called from the read paths that already touch AMFI securities — the rolling
  returns read (`performance-comparison.service.ts#getRollingReturns`), the
  comparison read (§4), and the securities list/detail load — under the caller's
  `withScopedDb` scope, failures logged and swallowed (a provider outage must
  never fail a read; cf. `ensureSecuritiesHistory`).
- No new cron is introduced; the nightly `settleDailyBars`
  (`security-price.service.ts:1374-1466`) already re-fetches AMFI schemes and is
  a natural future piggyback, but the read-time ensure is sufficient.

### 3.6 Missing / unknown category, and history

- **Missing** (`fund_category IS NULL`, e.g. never fetched, or the answer lacked
  the field): the fund is **Uncategorised**. It is shown with the literal
  "Uncategorised" and a reason, is grouped under a single `Uncategorised` bucket,
  and is **never** defaulted to `Equity`, `Mutual Fund` or any placeholder
  (explicitly rejecting Finsight `live-server.mjs:538,760,777`).
- **Unknown-string** values from AMFI are stored and shown as-is; Artha does not
  validate membership in a list it does not own.
- **Historical category changes.** SEBI/AMFI reclassify schemes over time. Artha
  keeps **last-write-wins only**; there is **no category history**. Therefore
  every category label and every like-for-like grouping is **as-of-now**, and the
  UI must say so when it groups a multi-year comparison: the group describes the
  funds **today**, not the peer set over the window. Claiming a window-period
  peer group would require a temporal category model, which is **not** built
  here (recorded as a known limitation).

---

## 4. Comparison specification

### 4.1 What comparison means

Comparison is the **side-by-side presentation of already-computed rolling-return
distributions** for two or more of the caller's own AMFI funds, **grouped by the
AMFI category of §3**. It introduces **no new formula**: every figure is the
output of the single approved engine
(`computeRollingReturns`, `backend/src/securities/rolling-returns.util.ts`, from
`docs/specs/fund-rolling-returns.md`). There is exactly one authoritative
calculation path (INV-FUNDCMP-001).

Because Artha holds NAVs only for securities the user owns (§2), there is **no
fund universe and therefore no peer benchmark**. Comparison is strictly "my funds
vs my funds". Category-relative percentiles, "top funds in the category", and any
category median presented as a market statistic are **BLOCKED** on a universe
(§6) and are **not** in this capability.

### 4.2 Inputs, eligibility, exclusions

- **Input:** `securityIds: string[]` — 2..20 distinct security ids, all owned by
  the caller (reuse the `ArrayMaxSize(20)` bound of
  `dto/performance-comparison-query.dto.ts`), plus the fixed periods `1Y/3Y/5Y`
  (no period query parameter, exactly as the rolling-returns spec fixes them).
- **Eligible instrument:** an owned security with a non-blank `amfi_scheme_code`.
- Truth table (per requested id):

| Situation | Outcome |
|---|---|
| Not owned, or does not exist | **`404 errors.securities.selectionNotFound`** for the whole request; no price row read (mirrors `loadOwnedSecurities`, `performance-comparison.service.ts`) |
| Owned, `amfi_scheme_code` null/blank | returned with `eligibility: "NOT_AN_AMFI_FUND"`, no periods, **no provider fetch, no price read** |
| Owned, AMFI, no usable NAV | `periods` present with `NO_PRICE_HISTORY` |
| Owned, AMFI, history shorter than a period | that period `INSUFFICIENT_HISTORY`, never since-inception |
| Owned, AMFI, eligible | three periods, "as of" history block |
| Duplicate ids in the request | de-duplicated before anything else |
| The same scheme twice | impossible per user — `UNIQUE(user_id, amfi_scheme_code)` (`schema.sql:714`) |

### 4.3 Series, basis, window

- **NAV basis:** raw `close_price`; sources `["amfi_nav","manual"]`; whole stored
  history. Identical to `docs/specs/fund-rolling-returns.md` §4.1 and
  INV-ROLLING-002 — the same `loadPriceSeries` call, the same basis decision
  (`basis: "RAW"`), so transaction-derived rows and a stray `adjusted_close` stay
  out here too, by construction, not by a parallel rule.
- **Window:** each fund is measured independently over its own usable history;
  the periods are the fixed 1Y/3Y/5Y. There is **no shared/common window and no
  rebasing across funds**, because the compared quantity is each fund's
  distribution, not a common-start cumulative line. (A shared-start overlay is a
  *different* feature and already exists as the generic Security comparison
  chart; it is not this capability.)

### 4.4 The specified edge cases

| Case | Rule |
|---|---|
| **Different inception dates** | Each fund reports its own `history` block and per-period `windowCount`/`completeness`. Funds are never pooled and no common start is implied. |
| **Insufficient history** | Per-period `INSUFFICIENT_HISTORY` with null statistics (inherited). |
| **Missing observations** | Per-fund `missingWindowCount` + `gaps` (inherited); the comparison surfaces the count so a fund is not read as complete. |
| **Different NAV observation availability** | Nothing is aligned across funds; each window is two observations of that fund's own series. |
| **Negative returns** | Ordinary; no clamp, no abs (inherited). |
| **Identical funds** | Deduplicated by `securityId`, then by `amfi_scheme_code`; a repeated id is shown once. |
| **Duplicate schemes across the request** | Collapse to one; note it so the user knows why their list shrank. |
| **Growth vs IDCW** | Not detectable (no plan-option field) → both allowed; the IDCW caption ("payouts are not added back") is shown once for the comparison, exactly as the rolling card does. |
| **Direct vs Regular** | **Not a supported distinction.** The plan option exists only inside `scheme_name`; Artha must not parse it. The comparison must not claim, sort, or filter on it. (`india_holdings_ext.plan_type` is per-position and is not reliable per-security.) |
| **Funds of different categories compared together** | Allowed, but each fund carries its category and funds are grouped; the UI must not present cross-category figures as peer-comparable. |

### 4.5 Presentation and ordering

- Funds are **grouped by `fund_category`**, with an `Uncategorised` group last.
- Within a group, **deterministic column sort only** (default: the request order;
  optionally the user may sort by a shown figure such as median). No rank badge,
  no score, no "best fund", no winner highlight, no recommendation — the data
  does not support a "best fund" across three periods, and the original Finsight
  had no working ranking either.
- Every null renders "n/a" with its status reason, never `0`; incomplete periods
  show `missingWindowCount`; the "as of" / stale notes travel with each fund.

---

## 5. Comparison contract (wire shape)

New endpoint on the existing `PerformanceComparisonController`
(`backend/src/securities/performance-comparison.controller.ts`), which is
owner-only for this route (no `@AllowDelegate()`), JWT-guarded, throttled 60/min
(the read may reach the provider):

```
GET /api/v1/investments/performance/funds/comparison?securityIds=<uuid,uuid,...>
```

```ts
interface FundComparisonMember {
  securityId: string;
  symbol: string;
  name: string;
  currencyCode: string;                 // labelling only (INR)
  fundHouse: string | null;
  fundSchemeType: string | null;
  fundCategory: string | null;          // null => Uncategorised
  eligibility: "ELIGIBLE" | "NOT_AN_AMFI_FUND";
  history: FundRollingReturnsHistory;   // reused type (PR #24)
  periods: RollingPeriodResult[];       // reused; [] when NOT_AN_AMFI_FUND
  deduplicated?: boolean;               // true when a repeated scheme was collapsed
}

interface FundComparisonView {
  members: FundComparisonMember[];
  groups: Array<{ category: string | null; securityIds: string[] }>;
  periods: ["1Y", "3Y", "5Y"];
  status: "complete" | "incomplete";    // incomplete if any member is not fully OK
}
```

- **No new return type is computed**; `periods` is the existing
  `RollingPeriodResult` and `history` the existing `FundRollingReturnsHistory`,
  so a later change to the rolling methodology cannot silently diverge here.
- Reuses `errors.securities.selectionNotFound` for 404 and the existing
  `ParseUUIDPipe`/UUID-list validation shape (400 on a non-UUID id).
- The Security read models (list + detail DTO/response) additionally expose
  `fundHouse`/`fundSchemeType`/`fundCategory` so the UI can label and filter
  without a second call. A standalone "categories" endpoint is **not** added —
  the category explorer is a client-side group/filter over the caller's own
  securities (see §7).

---

## 6. Performance metrics — what is in scope

| Metric | In scope? | Basis |
|---|---|---|
| **Rolling 1Y/3Y/5Y distribution** (worst, median, best, % positive, window count, gaps) | **YES** | Explicitly part of the selected capability (the rolling-returns mission); supported by stored AMFI NAVs; the single approved formula. |
| **Ranking / best-fund / category percentile** | **NO — BLOCKED** | Needs a category universe Artha does not hold. Finsight's own ranking was a stub. |
| **Category median / peer benchmark** | **NO — BLOCKED** | A median over the user's own handful of funds is a portfolio statistic, not a category benchmark; labelling it "category" would be a fabricated claim. |
| **Trailing point-to-point 1Y/3Y/5Y** | **NO** | Already shown by the Security Performance card; repeating it would put two differently-defined "3Y" numbers on fund comparison — the exact situation the rolling-returns spec §1 forbids. |
| **Absolute return** (cumulative over the window) | **NO** | Same overlap problem; the rolling distribution is the approved instrument-level view. |
| **CAGR** | **NO (new)** | The annualized 3Y/5Y rolling figure already **is** an annualized actual-days return; a second CAGR path would duplicate the engine. |
| **Volatility / std dev** | **NO — BLOCKED** | Needs a defined periodic-return sampling and consecutive observations (`time-series-contract.md` §2.4); the Finsight source returned hard-coded zeros and was rejected. Requires its own spec. |
| **Drawdown / max drawdown** | **NO — BLOCKED** | Path-dependent; needs full interior path validity; not in the approved capability. Own spec. |
| **Sharpe / Sortino / VaR / correlation** | **NO — BLOCKED** | Not supported by approved data or a defined risk-free/sampling convention; Finsight source rejected. |
| **Portfolio overlap between two funds** | **NO — BLOCKED** | Needs fund holdings data Artha does not have (`fetchStockSectorInfo`/`fetchEtfSectorWeightings` return `null` for AMFI, `amfi-nav.service.ts:147-155`). |
| **Already-existing Artha investment metrics** (portfolio CAGR/XIRR/TWR/realized gains) | **NO** | Money-weighted/portfolio-level; they describe a holding, not a fund. Unchanged by this capability. |

---

## 7. Implementation shape (files to touch on approval)

**Backend**

1. `backend/src/securities/providers/mfapi-payload.util.ts` — extend
   `MfapiScheme` + `parseMfapiSchemePayload` with `fundHouse`/`schemeType`/
   `schemeCategory` (null-safe, trimmed).
2. `backend/src/securities/entities/security.entity.ts` +
   `database/schema.sql` + new
   `database/migrations/20260926000000_fund_classification.sql` — the four
   nullable columns.
3. `backend/src/securities/amfi-nav.service.ts` — expose the scheme meta (a
   `fetchSchemeClassification(instrumentId)` that reuses the cached
   `loadScheme`), and a matching `QuoteProvider` capability if the interface
   (`providers/quote-provider.interface.ts`) needs it; keep `null` for the
   non-AMFI providers.
4. New `backend/src/securities/fund-classification.service.ts` —
   `ensureFundClassification(securities)`, modelled on
   `SectorWeightingService.ensureSectorData` (`sector-weighting.service.ts:162-230`):
   staleness gate, **only-on-provider-answer** write, `withScopedDb`, failures
   logged and swallowed.
5. `backend/src/securities/performance-comparison.service.ts` — add
   `getFundComparison(userId, securityIds)`: ownership first, dedupe, one
   `ensureFundClassification`, **one** `loadPriceSeries` call for all ids, then
   `computeRollingReturns` per fund; group by category.
6. `backend/src/securities/performance-comparison.controller.ts` +
   `dto/` — the new route; reuse `errors.securities.selectionNotFound`.
7. `backend/src/securities/securities` read DTO/mappers — expose the three
   classification fields on list/detail.

**Frontend**

8. `frontend/src/types/investment.ts` — the comparison types (mirror the
   backend, as with `FundRollingReturnsView`).
9. `frontend/src/lib/investments.ts` — `getFundComparison(securityIds)`.
10. `frontend/src/components/reports/SecurityPerformanceReport.tsx` — when ≥2
    selected instruments are AMFI funds, render the new comparison panel
    (reuses the existing security multi-select; no new page, no redesign).
11. New `frontend/src/components/securities/FundComparisonTable.tsx` — grouped
    by category; a table from `sm` up and stacked cards on phones (Mechanism A,
    as `FundRollingReturnsCard`); sortable columns; "n/a" + reason; percentage
    formatting through `useNumberFormat().formatSignedPercent` / `formatPercent`;
    region labelled "Fund comparison".
12. `frontend/src/components/securities/detail/SecurityKeyInformation.tsx` —
    show Fund house / Type / Category (text only) beside the existing AMFI scheme
    code. `SecurityList` — a Category column + client-side category filter.
13. i18n: new keys under `securityDetail.fundClassification.*` and the report
    namespace, translated into all 21 locales (en + regenerated xx, then the 18
    full locales), ICU plurals where counted; `npm run i18n:check` must pass.

**Docs**

14. `docs/system-invariants.md` + `docs/verification-contract.md` — the new IDs
    and their required-test columns (the parity guard is
    `backend/src/common/invariant-catalog-parity.spec.ts`).
15. This spec becomes `docs/specs/fund-categories-and-comparison.md` as the
    first commit.

---

## 8. Invariants

- **INV-FUNDCAT-001** — A security's fund category is the string AMFI published,
  stored verbatim, or `NULL`. It is never guessed, defaulted, or derived from the
  scheme name, sector, or type. (`NULL` renders "Uncategorised".)
- **INV-FUNDCAT-002** — A classification write happens only when the provider
  answered; a failed or empty answer neither overwrites a known category nor
  stamps freshness.
- **INV-FUNDCMP-001** — The comparison computes no return of its own: every
  figure is `computeRollingReturns` output. One engine.
- **INV-FUNDCMP-002** — No category-relative statistic (median, percentile,
  ranking, "best fund") is presented; a comparison contains only the members'
  own distributions. (No universe → no peer claim.)
- **INV-FUNDCMP-003** — A fund in the comparison whose history does not span a
  period reports `INSUFFICIENT_HISTORY`; it is never reported from a shorter
  history (inherits INV-ROLLING-003).

---

## 9. Test matrix

**Unit**
- U1 `parseMfapiSchemePayload` reads `fund_house`/`scheme_type`/`scheme_category`;
  a missing/blank/non-string field is `null`, never `""`/default.
- U2 The display split: `"Equity Scheme - Large Cap Fund"` → group
  `Equity Scheme`, category `Large Cap Fund`; a string with no `" - "` is the
  category with a null group.
- U3 `ensureFundClassification`: writes and stamps on a provided answer;
  **writes nothing and stamps nothing** on `null` (negative control for
  INV-FUNDCAT-002); skips within the staleness window.
- U4 Grouping: funds with equal category strings group together; `null` forms a
  single `Uncategorised` group; sort is deterministic.
- U5 Comparison service: ownership checked before any price read; a non-AMFI fund
  returns `NOT_AN_AMFI_FUND` with **no** ensure and **no** read; loader called
  **once** with all ids and `sources:["amfi_nav","manual"]`, `basis:"RAW"`;
  duplicate ids collapse.

**Source scan**
- SC1 No name/regex-based classification exists: a guard that fails if
  `fund_category`/`fund_house` are ever assigned from anything but the parser
  result (bans `/hdfc/i`-style rules and `|| 'Equity'` defaults). Mirrors
  `docs/system-invariants.md` ADR-0002 "prefer a scanning test".

**PostgreSQL integration**
- I1 Real loader: two funds seeded with distinct `scheme_category`; a `buy` row
  and a stray `adjusted_close` change no figure (inherits the rolling-returns
  negative controls).
- I2 `ensureFundClassification` updates the `securities` row on a stubbed
  provider answer; a stubbed failure leaves the prior category and
  `fund_classification_updated_at` untouched.
- I3 Ownership before backfill: another user's security id → 404 and
  `historical_backfill_attempted_at` unchanged (extends
  `security-cross-user-isolation.integration.spec.ts` with the comparison route).

**E2E** — `e2e/tests/fund-comparison.spec.ts`
- Two AMFI funds in the same seeded category, FX-A NAVs via
  `POST /securities/:id/prices`; the comparison shows each fund's 1Y/3Y/5Y
  distribution equal to the awaited API response, grouped under that category;
  a fund with no scheme code is excluded with its reason and makes no rolling
  request; another user gets 404 and sees nothing.

**Negative controls (financial-contract §8.2)** — each named test watched to
fail before the fix: default the category to `Equity` when `null` (U4); stamp
freshness on a failed fetch (U3); add a second return formula in the comparison
(U5/I1); introduce a category median (SC1/INV-FUNDCMP-002).

---

## 10. Risks, limitations, out of scope

- **Dependency:** the comparison half cannot ship before the rolling-returns
  capability (PR #24) is merged; the category half can.
- **No peer universe** — comparison is my-funds-only; category stats/ranking are
  BLOCKED and deliberately absent.
- **No category history** — labels/groupings are as-of-now; a multi-year window
  is labelled with today's category.
- **No plan/option distinction** — Growth/IDCW and Direct/Regular are not
  modelled; the IDCW caption is always shown.
- **Provider-transient category** — a fund that has never been fetched is
  Uncategorised until its first read-time ensure.
- **Out of scope (explicitly):** fund universe/catalog, category benchmark,
  ranking/percentile, overlap, volatility/drawdown/risk metrics, new providers,
  tax, Account Aggregator, unrelated Finsight/Fintrack features, unrelated
  refactoring.

---

## 11. Verification (how the implementation will be proven)

Backend: `npm run typecheck`, `npm run build`, `npm run migration:lint`,
`npx eslint`, the new/updated unit suites, the rolling-returns suite, the full
`npm run test:integration` (schema parity + RLS included).
Frontend: `npm run type-check`, `npm run lint`, `npm run i18n:check`,
`npm run build`, the new component tests, the full vitest suite.
E2E: the new `fund-comparison` spec plus the investment regression set, in the
repository-supported worker configuration. Negative controls run and recorded.
Schema: no drift (`schema-entity-parity`), additive migration only, RLS unchanged.
