# Fund Rolling Returns

Status: **Approved** 2026-09-26 (Mission 4, owner-delegated approval). All ten approval items in the Phase 2 synthesis accepted as recommended: distribution-only view; 1Y/3Y/5Y; actual days / 365.25 with 1Y absolute; `manual` rows admitted; IDCW computed and captioned; statistics shown with explicit missing-window disclosure; existing performance card captioned only; no AI/MCP tool; read-time `ensureSecuritiesHistory`; owner-only route.


The contract for the rolling-returns view of an Indian mutual fund priced from
AMFI NAVs: what a figure claims, which NAVs may form the series, when a window
is refused, and what the payload must say about what it could not work out.

This document is the specification required by
`docs/financial-calculation-contract.md` section 9. It governs
`backend/src/securities/rolling-returns.util.ts`,
`PerformanceComparisonService.getRollingReturns` and the
`FundRollingReturnsCard` that renders its output. It inherits, and does not
restate, `docs/time-series-contract.md` (the time dimension) and
`docs/financial-calculation-contract.md` (what a calculation may claim). The
closest precedent is `docs/security-benchmark-comparison.md`.

## 1. What the view answers

> Had I bought this fund on any day in its history and held it for exactly one,
> three or five years, what would the NAV have returned -- at worst, typically,
> at best, and how often would it have been positive?

A rolling return is a **point-to-point return on the fund's own NAV series**,
evaluated once per window end. It describes the instrument, not the user's
holding: no quantity, cost basis, cash flow, XIRR or TWR enters it.

The view is the **distribution** of windows, not a single trailing figure. The
trailing N-year return (the window ending today) is already shown by the
Security performance card, so this view does not repeat it -- one page never
carries two different numbers labelled "3Y" for the same kind of question.

## 2. Non-goals, stated so they are not read in

- **No currency conversion.** AMFI NAVs are INR; a ratio of two INR NAVs is
  currency-free. `currencyCode` is carried for labelling only; `FxAggregate`,
  exchange rates and `roundMoney` do not apply. INV-FX-001 is untouched.
- **Nothing is materialized.** A pure read. No table, no migration, no
  `schema.sql` change, no fingerprint (financial contract sections 5 and 7 are
  N/A). The only side effect is the existing, cooldown-gated provider history
  fetch (section 4.3).
- **No fund comparison, category, benchmark, overlap, risk statistics (std dev,
  drawdown, Sharpe), plotted rolling series, or portfolio rolling returns.**
- **No AI Assistant / MCP tool** in this change (section 9).

## 3. Eligibility

| Security | Result |
|---|---|
| Not owned by the caller, or does not exist | `404 errors.securities.selectionNotFound`; no price row is read |
| Owned, `amfi_scheme_code` null or blank | `200`, `eligibility: "NOT_AN_AMFI_FUND"`, `periods: []` |
| Owned, `amfi_scheme_code` non-blank | `200`, `eligibility: "ELIGIBLE"`, all three periods |

The predicate is `amfi_scheme_code`, never `security_type = 'MUTUAL_FUND'`:
Yahoo, MSN and manual entry also emit `MUTUAL_FUND`, and only the scheme code
routes a security to `AmfiNavService`
(`backend/src/securities/providers/quote-provider.registry.ts`).

**Growth vs IDCW.** Artha has no plan-option field, and AMFI rows carry no
adjusted close. A Growth plan's NAV is a total-return series; an IDCW plan's
NAV drops by each payout, so a NAV return understates what the holder earned.
The view is computed for every eligible scheme and **always** captioned
"Based on NAV. For IDCW (dividend) plans, payouts are not added back." No
name-based detection: a heuristic with no schema field behind it is not a
classification.

## 4. The series

### 4.1 Which rows

Read through the one door, `loadPriceSeries`
(`backend/src/common/time-series/price-series.util.ts`), with:

- `table: "security_prices"`, `ids: [securityId]`, `sampling: "day"`, no
  `fromDate` (whole stored history), no `toDate`;
- `sources: ["amfi_nav", "manual"]` -- provider NAVs, plus the user's own
  corrections (a `manual` row is a NAV typed for that date and is never
  overwritten by the provider). Transaction-derived rows (`buy`, `sell`,
  `reinvest`, ...) are **excluded**: an allotment or trade price is not the
  published NAV, and splicing it in is the per-row splice of time-series
  contract section 1;
- `basis: "RAW"` -- `close_price` for every row. A NAV has one basis. Letting
  the loader choose would pick ADJUSTED whenever a stray `adjusted_close`
  survives on an `amfi_nav` row (the upsert's `COALESCE(EXCLUDED.adjusted_close,
  security_prices.adjusted_close)` keeps a pre-AMFI Yahoo value) and would then
  drop every genuine NAV.

Both parameters are additions to the existing door, not a second query.

### 4.2 Which observations are usable

After loading, an observation is **excluded** (and counted in
`history.excludedObservationCount`) when:

- `close` is not finite, or `close <= 0` (a zero NAV is bad data, not a total
  loss -- same reading as `parseNav` and `NON_POSITIVE_BASE`);
- `date > today` (IST request day; a future-dated manual row).

Excluded rows are absent, not values: a lookup falls back to the prior usable
observation within the lag. Dates are unique by `UNIQUE(security_id,
price_date)`; the pure function asserts strictly ascending unique dates and
**throws** otherwise (a programming error, not data).

### 4.3 How much history is stored

`AmfiNavService.fetchHistorical` ignores its range and returns the scheme's
whole mfapi series, and `fetchAndStoreRange` stores it unclipped; the nightly
`settleDailyBars` re-upserts that full series for every eligible fund. So the
stored series is the full provider series once any of these has run. The one
gap is a scheme code assigned to an existing security today (no backfill until
the night). The read therefore calls the existing
`PerformanceComparisonService.ensureSecuritiesHistory([security], start5Y)`
(6-hour cooldown on `historical_backfill_attempted_at`, failures logged and
swallowed) before loading. A provider failure yields figures over what is
stored, never a 5xx.

## 5. Windows

### 5.1 Periods

| Period | Months | Annualized |
|---|---:|---|
| `1Y` | 12 | no -- absolute |
| `3Y` | 36 | yes |
| `5Y` | 60 | yes |

Fixed; no query parameter. Periods are months, never days.

### 5.2 Construction

- **Window ends are observation-based**: one candidate window per usable
  observation `e`.
- **Window starts are calendar-based**: `target = addMonthsUtc(parseYmd(e.date),
  -months)` (clamps to month end: 2024-02-29 - 12 months = 2023-02-28), then
  `s = observationAt(points, ymd(target), BOUNDARY_LAG_DAYS)` -- the last
  observation at or before the target, only if at most 14 days older. Never a
  forward or nearest lookup. `withYears`/`setUTCFullYear`/"minus 365 days" are
  wrong at leap days and are not used.
- **Pre-history**: `target < first usable observation date`. Not a window, not
  a gap, not counted.
- **Missing window**: target inside the series, `s` is null. Counted in
  `missingWindowCount`, reported in `gaps`, never 0, never bridged.
- **Computed window**: `s` resolves. `s.date < e.date` always holds for
  `months >= 1` (the target is at least 28 days before `e`, the lag is 14); the
  util asserts it.

An interior hole does not invalidate a window: a point-to-point return depends
only on its two ends (time-series contract 2.4 governs path metrics, and none
is computed here).

### 5.3 Truth table (per candidate end `e`)

| Situation | Outcome | Counted as |
|---|---|---|
| `target < firstDate` | none | pre-history (not counted) |
| usable observation within `[target - 14d, target]` | return computed | `windowCount` |
| none within 14 days, `target >= firstDate` | none | `missingWindowCount`, `gaps` |
| lag exactly 14 days | computed | `windowCount` (`<=`, inclusive) |
| lag 15 days | none | `missingWindowCount` |

## 6. Formula

`P_s`, `P_e`: the start and end NAVs (unrounded). `d = daysBetween(s.date,
e.date)` in whole calendar days.

```
1Y (months <= 12):  R = (P_e / P_s - 1) * 100
3Y, 5Y:             R = ((P_e / P_s) ^ (365.25 / d) - 1) * 100
```

- Actual observation-to-observation days over **365.25**, the repository's
  price-CAGR convention (`PortfolioCalculationService.calculateCAGR`,
  `DAYS_PER_YEAR` in `strategies/gem-backtest.util.ts`). XIRR's 365 is a
  money-weighted convention and is not the precedent.
- 1Y is absolute and never run through the power: a 10% move over 366 days
  prints 10.0000, not 9.9785.
- Negative returns are ordinary: no clamp, no abs.
- Returns are **percentage points**, not money. Every window return and every
  statistic is computed from unrounded values and rounded once, at the edge,
  with `roundToDecimals(x, 4)` (the `PP_DECIMALS` convention). The UI formats
  through `useNumberFormat().formatSignedPercent` / `formatPercent`.

## 7. Statistics per period

Over **computed windows only** (never over nulls, never with 0 substituted):

| Field | Definition |
|---|---|
| `windowCount` | computed windows |
| `missingWindowCount` | missing windows (5.3) |
| `min`, `max` | extreme window return with its `startDate`/`endDate` (the observations actually used); ties take the earliest end |
| `median` | median; mean of the two middle values for an even count |
| `mean` | arithmetic mean |
| `positiveShare` | `100 * (windows with R > 0) / windowCount`; exactly 0 is not positive |

`completeness` is `"incomplete"` whenever `missingWindowCount > 0`; the
statistics then describe the computed windows only and the UI says so, and
`gaps` names the end-date runs responsible (time-series contract section 4:
best/worst covered period may be returned labelled; the responsible ranges must
be identifiable). These are descriptive statistics of a set of independent
point-to-point returns, not a chained aggregate; no CAGR, cumulative return,
volatility or drawdown is derived from the windows.

`gaps` are runs of consecutive missing windows **in observation order** (two
missing ends with no computed window between them belong to one run), as
inclusive `{ from, to }` end dates, oldest first.

### 7.1 Period status

| Status | Condition | Stats |
|---|---|---|
| `OK` | `windowCount >= 1` | computed |
| `ALL_WINDOWS_MISSING` | `windowCount = 0`, `missingWindowCount >= 1` | all null |
| `INSUFFICIENT_HISTORY` | usable observations exist, no candidate window (series spans less than the period) | all null, counts 0 |
| `NO_PRICE_HISTORY` | no usable observation | all null, counts 0 |

A fund with 2.5 years of NAVs has **no** 3Y figure: not since-inception, not
scaled, not annualized over 2.5 years under a 3Y label.

### 7.2 History block

`firstDate`/`lastDate` (usable observations, null when none),
`observationCount` (usable), `excludedObservationCount`, and `lastIsStale =
daysBetween(lastDate, today) > BOUNDARY_LAG_DAYS`. A stale feed does not
invalidate historical windows; the UI shows "as of <lastDate>" always and a
stale warning when set. `today` is a parameter of the pure function
(`todayYMD()` in the service); the util never reads the wall clock.

## 8. Numerical examples (the test oracles)

Returns to 4dp. All computed with the rules above.

**FX-A** (sparse): 2021-06-30 = 80, 2023-06-30 = 100, 2025-06-30 = 160,
2026-06-30 = 200. `today` 2026-07-01.

| Period | Computed | Missing ends | Value |
|---|---|---|---|
| 1Y | 2026-06-30 from 2025-06-30 | 2023-06-30, 2025-06-30 (targets 2022-06-30 and 2024-06-30: nearest prior NAV 730 and 365 days old) | 200/160 - 1 = **25.0000** |
| 3Y | 2026-06-30 from 2023-06-30, d = 1096 | 2025-06-30 (target 2022-06-30) | 2^(365.25/1096) - 1 = **25.9855** |
| 5Y | 2026-06-30 from 2021-06-30, d = 1826 | none | 2.5^(365.25/1826) - 1 = **20.1155** |

1Y: `completeness "incomplete"`, `gaps [{2023-06-30, 2025-06-30}]` (one run: no
computed window between them). 3Y: gaps `[{2025-06-30, 2025-06-30}]`. 5Y:
`complete`, `windowCount 1`. Every stat of a one-window period equals that
window; `positiveShare 100`. (Convention pins: 5Y under 365 would be 20.1004,
under nominal 1/5 20.1124.)

**FX-R** (dense step function): every weekday 2024-01-01..2026-06-30 (652
rows); NAV 100 through 2024-12-31, 120 for 2025-01-01..2025-06-30, 90 for
2025-07-01..2025-12-31, 135 for 2026-01-01..2026-06-30. `today` 2026-06-30.

1Y: ends before 2025-01-01 are pre-history. Ends in H1 2025: 120/100 = +20
(129 ends); H2 2025: 90/100 = -10 (132); H1 2026: 135/120 = +12.5 (129).
`windowCount 390`, `missingWindowCount 0`, `min -10.0000`, `max 20.0000`,
`mean (129*20 - 132*10 + 129*12.5)/390 = 7.3654`, `median 12.5000`,
`positiveShare 258/390 = 66.1538`. `min.startDate` = 2024-07-01 (start of the
first H2-2025 window, end 2025-07-01); `max` = start 2024-01-01, end
2025-01-01. 3Y and 5Y: `INSUFFICIENT_HISTORY`.

**FX-R-hole**: FX-R minus 2024-05-01..2024-05-20. 1Y ends 2025-05-15,
05-16, 05-19, 05-20 have targets 15-20 days after the last prior NAV
(2024-04-30) and are missing; 2025-05-14 (lag exactly 14) is computed.
`windowCount 386`, `missingWindowCount 4`, `gaps [{2025-05-15, 2025-05-20}]`,
`mean 7.2345`, `median 12.5000`, `positiveShare 65.8031`,
`completeness "incomplete"`.

**Leap**: 2023-02-28 = 100, 2023-03-01 = 500, 2024-02-29 = 120. 1Y end
2024-02-29, target 2023-02-28 -> **20.0000**. (`setUTCFullYear` gives
2023-03-01 -> -76.0000.)

**Weekend start**: 2025-06-26 = 90, 2025-06-27 (Fri) = 100, 2025-06-30 (Mon) =
999, 2026-06-29 = 150. End 2026-06-29, target 2025-06-29 (Sun) -> 2025-06-27
-> **50.0000**. (Nearest/forward lookup gives -84.9850.)

**Annualized loss / gain**: 3Y 100 -> 150 over d = 1096: **14.4679**;
100 -> 50: **-20.6258**.

**Excluded rows**: FX-A with 2025-06-30 = 0 and an extra 2025-06-28 = 150.
The 0 row is excluded (`excludedObservationCount 1`); the 1Y window ending
2026-06-30 (target 2025-06-30) resolves to 2025-06-28, 2 days earlier:
200/150 - 1 = **33.3333**. Adding a row dated `today + 1` raises
`excludedObservationCount` to 2 and changes nothing else.

## 9. Surfaces

- **API**: `GET /api/v1/investments/performance/securities/:id/rolling-returns`
  on `PerformanceComparisonController` (class `AuthGuard('jwt')`,
  `ParseUUIDPipe`, user from `req.user.id`, owner-only -- no `@AllowDelegate()`,
  throttled 60/min because the read may reach the provider).
- **UI**: `FundRollingReturnsCard` on the security detail Overview tab, rendered
  only when `security.amfiSchemeCode` is set. One row per period: worst,
  median, best, % positive, number of periods. Nulls render "n/a" with the
  status reason, never 0%. Failed request renders an error line, distinct from
  any status.
- **Security performance card**: keeps its trailing figures; its 3Y/5Y caption
  says they are cumulative, not annualized, so the two cards cannot be read as
  disagreeing. Replacing its client engine (per-row basis splice, unbounded
  baseline, wall clock -- `frontend/src/lib/security-detail.ts`) with a server
  answer is a known defect recorded for a follow-up, not part of this change.
- **AI Assistant / MCP**: none. The logic lives on the domain service, so a
  later tool is a thin adapter that must ship on both layers in one PR and keep
  `status`, `completeness` and `gaps` in its compact shape.

## 10. Test matrix

Unit (`backend/src/securities/rolling-returns.util.spec.ts`), each naming the
naive implementation it defeats:

| # | Case | Expected | Defeats |
|---|---|---|---|
| U1 | FX-A | table in section 8 | - |
| U2 | FX-A 5Y exact value | 20.1155 | 365 (20.1004), nominal 1/N (20.1124) |
| U3 | FX-R | 390 / -10 / 20 / 7.3654 / 12.5 / 66.1538 | counting pre-history ends (652) |
| U4 | FX-R-hole | 386, missing 4, one gap 2025-05-15..20, mean 7.2345 | unbounded lookup; `<` instead of `<=` |
| U5 | Leap | 20.0000, start 2023-02-28 | `setUTCFullYear` |
| U6 | Weekend start | 50.0000, start 2025-06-27 | nearest / forward lookup |
| U7 | 1Y over 366 days, 100 -> 110 | 10.0000 | annualizing 1Y (9.9785) |
| U8 | 3Y 100 -> 150 and 100 -> 50, d = 1096 | 14.4679, -20.6258 | abs/clamp |
| U9 | Excluded rows | 33.3333, excluded 1; future row excluded | divide by zero; future NAV used |
| U10 | Empty series | every period `NO_PRICE_HISTORY` | status OK with empty stats |
| U11 | 2.5 years daily, 3Y | `INSUFFICIENT_HISTORY`, stats null | since-inception CAGR |
| U12 | Series with every start target in a hole | `ALL_WINDOWS_MISSING` | 0% |
| U13 | Even count median | mean of the two middle | picks one middle |
| U14 | A window with R exactly 0 | not positive | `>= 0` |
| U15 | Unsorted or duplicate input | throws | silent wrong windows |
| U16 | lastDate 30 days before today | `lastIsStale true`, windows unchanged | windows dropped |
| U17 | Rounding once | stats from unrounded returns | median of rounded values |
| U18 | `process.env.TZ` = Asia/Kolkata, America/Los_Angeles, Pacific/Kiritimati | identical output | local-time date arithmetic |

Loader (`price-series.util.spec.ts`): `sources` filter parameterized and applied
in the scoped CTE; `basis: "RAW"` returns `close_price` even when a row has
`adjusted_close`; omitted `fromDate` has no lower bound.

Service / controller (colocated specs): ownership before any price read; non-AMFI
returns `NOT_AN_AMFI_FUND` without ensure or read; ensure called with the 5Y
start; loader called with `sources` and `basis: "RAW"`; route 400 on a non-UUID
id; no `@AllowDelegate()`.

Integration (real PostgreSQL, serial): FX-A through the real loader; a
`buy` row on 2024-06-28 (close 1) does not resolve the 1Y target 2024-06-30,
and an `adjusted_close` on an `amfi_nav` row does not change any figure; a `manual` row is honoured; a `manual` 0 is excluded;
another user's security id is 404 and reads nothing.

Frontend: literal expected strings (en-US and de-DE), "n/a" plus reason per
status, incomplete disclosure, stale note, error state distinct from statuses,
card absent for a non-AMFI security, stale response after a security switch is
dropped, performance card shows its cumulative caption.

E2E: a security with a scheme code mfapi does not serve, FX-A seeded through
`POST /securities/:id/prices` (`manual` rows); the card shows 1Y "+25.00%",
3Y "+25.99%", 5Y "+20.12%" and equals the awaited API response.

Negative controls (financial contract 8.2), recorded in the PR: swap
`observationAt` for `pointAsOf` (U4 fails); `setUTCFullYear` (U5); nearest
lookup (U6); annualize 1Y (U7); 365 for 365.25 (U2); drop the `sources` filter
(integration `buy` case); drop `basis: "RAW"` (integration stray-adjusted case).

## 11. Invariants

- **INV-ROLLING-001** A rolling window is two usable NAV observations, the
  start at most `BOUNDARY_LAG_DAYS` before its calendar target; an unresolved
  start is a counted, located missing window, never 0.
- **INV-ROLLING-002** The NAV series is `amfi_nav` and `manual` rows on the raw
  basis only; transaction-derived prices never enter it.
- **INV-ROLLING-003** Periods over 12 months are annualized on actual days /
  365.25; 12 months is absolute; no period is reported from a shorter history.

Status at merge: enforced by the unit and integration cases above.
