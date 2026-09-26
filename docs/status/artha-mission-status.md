# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, and the next-mission brief are below.

Last updated: 2026-09-26 - `main` at **`88aba19ec`** - **Mission 1 MERGED (PR #22)** - **Mission 2 COMPLETE - Fintrack audit, scope exhausted, no code change** - **Mission 3 MERGED (PR #23)** - **Mission 4 - Fund Rolling Returns: code PR #24 OPEN (not merged)** - **Mission 5A - Mutual-Fund Categories & Comparison: specification APPROVED, committed as documentation only, docs PR #25 OPEN (not merged); implementation intentionally NOT started** - **Artha de-branding (Monize removal): implemented on `fm/artha-debrand-01`, code PR #26 OPEN (not merged)** - next: merge PR #24, then the de-brand PR #26, then the spec PR #25, then start **Mission 5B (implementation)**

---

## TL;DR

- **Mission 1** — "Complete Initial Artha / Monize Productization & Foundation Integration" — is implemented on `fm/artha-productization-01` and **merged** as code **PR #22** into `main` (merge commit `cfe995483`).
- **Product identity (Scope A):** user-facing Monize residue replaced with Artha across every frontend/backend locale catalog, email subject, service worker string, PDF/CSV export, the TOTP issuer, the Swagger title and the OAuth consent pages — plus the remaining non-catalog strings (backup-format error, Ollama model hint, `.mny` and Google-referrer error fallbacks, two Swagger descriptions, and the backend e2e reset-subject assertion).
- **INR-first (Scope B):** a brand-new user's default currency is **INR**; an existing user's stored `default_currency` is never rewritten (the fallback applies only when the preference is unset). No implicit migration.
- **CI repair:** the previous head's only red job was Backend Unit Tests — ten suites still asserted the old USD fallback (12 tests). They now assert the intended INR default.
- **E2E:** a new `e2e/tests/artha-foundation.spec.ts` covers journeys A/C/F/G/H; `settings.spec.ts` and `transactions.spec.ts` cover B/D/E.
- **CI green:** every GitHub Actions check on PR #22 passes — Backend Unit/Integration, Frontend Unit, all four E2E shards (chromium + firefox), schema drift, Bearer scan, Lighthouse. `mergeStateStatus: CLEAN`.
- **No financial invariant, schema, migration or FX engine changed.**

---

## Current repository state

- **main SHA:** `88aba19ec` - `Merge pull request #23` (Mission 3).
- **Rolling status PR:** PR #5 (`fm/artha-mission-status`) — strictly one file, `docs/status/artha-mission-status.md`.
- **Code PRs:** **PR #22** (Mission 1) and **PR #23** (Mission 3) **MERGED**; **PR #24** - `feat: fund rolling returns` (`fm/artha-finsight-rolling-returns` -> `main`) - **OPEN** (Mission 4).
- **Documentation PRs:** **PR #25** - `docs: add mutual fund categories and comparison specification` (`fm/artha-fund-categories-spec` -> `main`) - **OPEN** (Mission 5A; docs only, no production change).
- **Stabilization PRs:** **PR #26** - `chore: remove Monize branding from Artha` (`fm/artha-debrand-01` -> `main`) - **OPEN** (Artha de-branding; rename only, no feature work).
- **Merged PRs:** #1-#23.

---

## Mission 1 execution summary

| Scope | Objective | Implementation | Status |
|---|---|---|---|
| **A** | Artha identity / Monize residue | Artha copy across all locale catalogs, email subjects, service worker strings, PDF/CSV exports, TOTP issuer, Swagger, OAuth consent, and the remaining non-catalog error/help strings. Internal identifiers preserved. | **Done** |
| **B** | INR-first defaults | `FALLBACK_DEFAULT_CURRENCY = INR` in `default-currency.util.ts`, `user-preference.entity.ts`, `user-preference.factory.ts`, `lib/default-currency.ts`. New users get INR; existing preferences untouched. | **Done** |
| **C** | Currency switching / FX revaluation | Existing authoritative FX path (`FxAggregate`, `resolveFxRateOrNull`, date-aware `getRateForDate`) verified, not reimplemented; no second engine added. | **Verified** |
| **D** | Core product experience | Auth, onboarding, dashboard, accounts, transactions, navigation and settings traced and exercised; the INR default confirmed end-to-end. | **Verified** |
| **E** | PWA / mobile / runtime | Manifest (`Artha`), service worker, responsive shell and production build verified. | **Verified** |

---

## Preserved invariants & boundaries

1. **Internal identifiers kept:** `monize://` entity-link scheme, `MZBE` backup magic bytes, the `X-Monize-Share-Name` header, the MCP protocol server name and `monize:` scope prefix, Bearer test credentials, and upstream repository/licence links.
2. **Financial safety:** no change to decimal arithmetic, sign conventions, transfer/split/VOID semantics, cost basis, valuation, FX, TWR/CAGR/XIRR, or RLS.
3. **Schema/migrations:** untouched — schema parity unaffected.
4. **No implicit migration:** flipping the fallback constant changes only what an *unset* preference resolves to.

---

## Validation

| Gate | Command | Result |
|---|---|---|
| Backend typecheck | `npm run typecheck` | Clean |
| Backend lint | `npm run lint` | Clean |
| Backend build | `npm run build` | Clean |
| Backend unit — repaired suites | `npm run test:unit -- <10 suites>` | **492 passed** (the 12 CI failures fixed) |
| Backend unit — copy-touched suites | `npm run test:unit -- backup-stream-crypto ollama payee-lookup` | **110 passed** |
| Frontend typecheck | `npm run type-check` | Clean |
| Frontend lint | `npm run lint` | Clean (1 pre-existing `sw.js` warning) |
| Frontend i18n | `npm run i18n:check` | Clean |
| Frontend build | `npm run build` | Clean (standalone output) |
| E2E — new journeys | `artha-foundation.spec.ts` (chromium) | **7 passed** |
| E2E — currency/settings | `currencies.spec.ts`, `settings.spec.ts` (chromium) | **12 passed** |
| Live probe | `/api/v1/health`, `/users/preferences`, `/manifest.webmanifest` | healthy; new user `INR`; manifest `Artha` |
| **CI (PR #22, head `8abd9f4be`)** | full GitHub Actions run | **All checks pass** — Backend Unit (1h20m), Backend Integration, Frontend Unit, E2E shards 1–4, Schema vs Migrations Drift, Bearer Security Scan, Lighthouse, NPM Audit, zizmor |

The complete backend unit suite (98 minutes, 646 suites) and the full chromium+firefox E2E matrix run in CI and are green on the pushed head.

---

## Commits & pull requests

| Ref | Description | State |
|---|---|---|
| `4da72c42a` | `feat: complete initial Artha productization` | Committed |
| `a85bb23e5` | `test: align joint accounts integration and frontend test expectations with Artha copy and INR default` | Committed |
| `9dce9741b` | `fix: align the USD-fallback suites with the INR default and finish user-visible Artha copy` | Pushed |
| `8abd9f4be` | `test(e2e): add the foundational Artha journeys and install the USD test currency` | Pushed |
| **PR #22** | `feat: complete initial Artha productization` | **MERGED → `main` (`cfe995483`)** |
| **PR #5** | Rolling status (this file) | **OPEN — 1 file** |

---

## Mission 2 — Fintrack Completion

**Status: COMPLETE — SCOPE EXHAUSTED / AUDIT ONLY.** No code change, no code PR, no `fm/artha-fintrack-01` branch.

**Conclusion:** the selected Fintrack scope has been exhausted. Every Fintrack capability adopted into Artha is already implemented and verified on `main` at `cfe995483`. The remaining Fintrack capabilities are either explicitly NOT ADOPTED / REJECTED or belong to later Finsight/Artha scope. There is no valid implementation gap for this mission, so none was invented.

### Adopted Fintrack capabilities — all DONE

| Capability | Artha evidence (`origin/main`) |
|---|---|
| Daily transaction ledger / date grouping (Today/Yesterday, per-day income/expense) | `frontend/src/lib/transaction-day-groups.ts` + `TransactionList.dayGroups.test.tsx` — FX / VOID / transfer / split correct, integer-scaled, currency-mix withheld |
| Payment methods (UPI/IMPS/NEFT/RTGS/CARD/CASH/CHEQUE/OTHER) | schema enum + indexes; `TransactionRow`, `TransactionForm`, `TransactionFilterPanel`, `import/payment-method-detector.util` |
| UPI VPA + reference / RRN | schema `upi_vpa` / `upi_reference`; transaction entity, DTOs, form, row, `import/sms/parsers/upi-sms.parser`, `transaction-search.util` |
| Indian bank SMS intake + review | `backend/src/import/sms/*`, `sms_sender_registry`, `SmsIntakeStep` (PR #17 — the one concept explicitly "Rebuilt from Fintrack", `india_phase2` migration L126) |
| Merchant / payee normalization | `payee_aliases` + `merchant_references` (global, `normalized_name` / `canonical_name` / `country_code`) |
| Credit-card / billing-cycle experience | `CREDIT_CARD` account type, `statement_due_day` / `statement_settlement_day`, `statement-cycle.service`, `credit-card-detail/*` (StatementPanel, PayoffCalculator, InterestAndFeesPanel), `credit-utilization`, dashboard widgets |
| Budgets | `budgets.service`, `budget-alert.service`, `BudgetHeatmap` |
| Goals / emergency fund | PR #20 |
| Investments / SIP plans | investment engine, `sip-plan-comparison.service` |
| Recurring / calendar | scheduled-transactions + bills |
| Reports | `built-in-reports`, `reports/` engine |
| Import → ledger → rules / idempotency | `import/*`, `rules.controller`, `import-identity.util` |
| Data export | backup / export (JSON / CSV / PDF) |

### REJECTED / NOT ADOPTED

| Item | Reason |
|---|---|
| Fintrack localStorage card reward-points / "unbilled" fields | Not in the selected Artha architecture; Artha models cards by balance + statement cycle + utilization (correct accounting model). No such columns in Artha schema. |
| Fintrack AI Insights (OpenAI scoring) implementation | Belongs to the separate Finsight direction; Mission 2 scope excludes new AI. |
| Fintrack `ft-*` visual system (Kimi dark theme) | Artha has its own established design system; a second design system is out of scope. |

### Evidence inspected

- **Fintrack:** `/Users/kishore/git/Onefinance/fintrack-app/` — `HANDOVER.md` (the project's authoritative agent handover / feature record), `README.md`, Prisma models, and the application page / navigation inventory (Kimi nav), with targeted source verification.
- **Artha:** current `origin/main` (`cfe995483`) — schema, the transaction day-grouping / payment-method / UPI / SMS-intake / merchant-normalization / credit-card / budgeting / goals / investment-SIP / scheduled-transaction / reports / import-rules / export implementations and their contracts.
- **Limitation (stated honestly):** this audit used Fintrack's authoritative handover plus the page/nav inventory mapped capability-by-capability against Artha, with targeted source verification in Artha. It did **not** perform a complete line-by-line Fintrack↔Artha source diff.

### No-change confirmation

- No Artha source code modified.
- No `fm/artha-fintrack-01` branch created.
- No code PR opened.
- No scope expansion; no Finsight / tax / Account-Aggregator / new-India-instrument / new-AI work started.
- Selected Fintrack scope is **exhausted**.

---

## Mission 3 — Finsight Completion

**Status: ONE PARTIAL GAP IMPLEMENTED - code PR #23 MERGED (`main` `88aba19ec`).** Baseline `main` `cfe995483`.

**Conclusion:** the Finsight market-data, valuation, allocation, return (CAGR/XIRR/TWR), realized-gain, watchlist, benchmark, report, alert and AI stack is already absorbed natively in Artha. Exactly one selected capability was PARTIAL: **portfolio concentration / diversification** — computed by the server (`concentration.util.ts`, `f9a0a4a35`) and quoted by AI/MCP, but never displayed because the frontend `PortfolioSummary` type dropped the field. PR #23 surfaces it on the investments page. Every other row is DONE, BLOCKED on data, NOT DONE pending an approved financial spec, or REJECTED.

**Evidence inspected.** Finsight: `/Users/kishore/git/Onefinance/finsight-ai/` — `README.md` feature list; `fullstack/backend-scaffold/src/routes/{analytics,portfolio,mutualFunds,stocks,news}.ts`; `fullstack/backend-scaffold/src/db/schema.ts`; `fullstack/ai-engine/src/main.py`; `shared/symbol-aliases.json`. Harvest record: PR #5 revision `e19da578d` (Fintrack + Finsight adoption snapshot). Artha: current `origin/main` files named in the matrix. **Limitation:** capability-by-capability mapping with targeted source reads on both sides — not a complete line-by-line source diff.

### Finsight adoption matrix

| Capability | Finsight source | Artha evidence (`main`) | Status | Action |
|---|---|---|---|---|
| NSE/BSE equities (`.NS`/`.BO`) | `services/market-data/*` | `instrument-key.util.ts` | DONE | none |
| AMFI NAVs + history | `services/market-data/*` | `amfi-nav.service.ts`, `security_prices` | DONE | none |
| Provider aliases | `shared/symbol-aliases.json` | `instrument_aliases`, `instrument-alias.entity.ts` | DONE | none |
| Portfolio valuation | `routes/portfolio.ts` | `PortfolioService.getPortfolioSummary` | DONE | none |
| Allocation: security / tag / sector / country / asset class | `routes/analytics.ts` | `buildAllocation*`, `sector-weighting.service.ts` | DONE | none |
| Allocation: instrument type | `routes/analytics.ts` | `SecurityTypeAllocationWidget`, `SecurityTypeAllocationReport` | DONE | none |
| CAGR / XIRR / TWR | `routes/portfolio.ts:220-221` (`cagr: 0, xirr: 0`) | `calculateCAGR`, `xirr.util.ts`, `calculateTWR` | DONE (Finsight impl REJECTED) | none |
| Realized gains | — | `calculateRealizedGains` | DONE | none |
| **Concentration / diversification** | `routes/analytics.ts:22` (`diversificationScore: 0`) | `concentration.util.ts` + LLM/MCP; UI missing on `main` | **PARTIAL -> implemented in PR #23** | merged |
| Watchlists | `db/schema.ts` | `backend/src/watchlists/*`, `/watchlists`, `e2e/tests/watchlists.spec.ts` (PR #13) | DONE | none |
| Index / benchmark comparison | — | `market_index_prices`, `performance-comparison.service.ts` | DONE | none |
| Investment reports / alerts | — | `investment-reports/**`, `notification-center/**` | DONE | none |
| AI assistant, portfolio-grounded | `ai-engine/src/main.py:33` (static insight) | `backend/src/ai/**`, `mcp/**`, `getLlmSummary` | DONE (Finsight impl REJECTED) | none |
| Risk stats (σ, Sharpe, Sortino, drawdown, VaR) | `routes/analytics.ts:26-27,70-79` (zeros) | no flow-adjusted periodic return series (`/net-worth/investments-daily` is value incl. contributions; `calculateTWR` chains at transaction boundaries) | BLOCKED | needs a return-series spec |
| Market-cap allocation | `routes/analytics.ts`, `routes/stocks.ts` | no market-cap data | BLOCKED | needs a data source |
| Fund rolling returns | `routes/mutualFunds.ts:53-62` (empty) | AMFI series stored in full | **IMPLEMENTED in PR #24 (Mission 4)** | awaiting owner merge |
| MF category explorer / comparison | `routes/mutualFunds.ts` | no category model (mfapi `scheme_category` not captured) | NOT DONE | schema + spec, later mission |
| Fund overlap | `routes/mutualFunds.ts:69` (`overlap: 0`) | no fund-holdings data | BLOCKED | needs holdings source |
| Screener | `routes/stocks.ts:82` (filters not modelled) | none | REJECTED as source; concept DEFERRED | — |
| News | `routes/news.ts` | `security-news.service.ts` | PARTIAL (unchanged) | outside this scope |
| Sentiment / events | `routes/news.ts`, `db/schema.ts` | none | DEFERRED | — |

**REJECTED — source implementation invalid / not suitable for Artha:** hard-coded zero CAGR/XIRR, zero/empty analytics stubs (diversification, Sharpe, Sortino, drawdown, attribution, rolling, overlap — each `SELECT 1` then literals), static AI "insight", orphaned provider adapters, float valuation, FX-blind aggregation, stored-never-rebuilt cost basis. None ported.

### Implemented (PR #23)

- `frontend/src/types/investment.ts` — `PortfolioSummary.concentration?` (+ `ConcentrationMeasure`, `ConcentrationPosition`), optional for rolling deploys.
- `frontend/src/components/investments/PortfolioConcentrationCard.tsx` — renders the server figures only: effective holdings of N, largest position, top-5 share, Herfindahl index for both bases (Holdings / Including cash), and the five largest positions; `partial` names the excluded holdings; `unavailable` / null basis reads "Not available", never zero.
- `frontend/src/app/investments/page.tsx` — card under the summary/allocation row.
- i18n `investments.concentration.*`: `en`, regenerated `xx`, translated into all 18 full locales.
- Commits: `5cdade79f` (feature), `70490bd97` (translations). No backend, schema, migration, calculation, FX, cost-basis or AI change.

### Validation (Mission 3)

| Gate | Result |
|---|---|
| Frontend type-check / lint | clean / 0 errors (1 pre-existing `public/sw.js` warning) |
| Frontend i18n:check + i18n suites | clean, 1777 passed |
| Frontend unit, full (`TZ=UTC`) | 871 files, 16631 passed |
| Frontend build | clean |
| Backend typecheck / build | clean / clean (no backend change) |
| Backend concentration + portfolio specs | 164 passed |
| E2E `investments.spec.ts` (chromium, local stack) | 6 passed, incl. the 2 new concentration journeys |
| E2E regression (securities, security-detail, watchlists, currencies, investment-account-consolidation, reports, artha-foundation A/C/F/G/H) | all passed |

**E2E journeys:** (1) fresh INR user, two INR BUYs (60×100, 20×100) from a 10,000 opening balance — page matches `/portfolio/summary` exactly (`1.6 of 2` / `2.3 of 3`, `75.0%` / `60.0%`, HHI `0.625` / `0.440`, positions 75.0% / 25.0%), and again after reload; (2) cash-only brokerage — holdings basis "Not available", cash-inclusive 100.0%.

**Financial correctness:** presentation of an existing server calculation; no client money arithmetic, no second valuation/FX/return/cost-basis path. **Security/RLS:** no backend change; the card reads the same authenticated, RLS-scoped `/portfolio/summary` response.

---

## Mission 4 - Fund Rolling Returns

**Status: IMPLEMENTED - code PR #24 OPEN (`fm/artha-finsight-rolling-returns`, not merged).** Baseline `main` `88aba19ec`.

**Workflow:** 5 parallel read-only audits (financial spec, data, architecture, Finsight source, test design) -> one synthesis with a frozen API contract, file ownership map and test plan -> approved spec `docs/specs/fund-rolling-returns.md` (commit `e6c2c9741`) -> 3 parallel implementation branches on disjoint files (backend, frontend, tests) -> one integration branch with docs, translations, review and full local validation.

**Spec decisions (all ten accepted as recommended):** distribution-only view (worst / median / best / % positive / count), trailing figure left on the existing card; periods 1Y / 3Y / 5Y; actual days / 365.25 with 1Y absolute; `amfi_nav` + `manual` rows, transaction prices excluded; IDCW computed and always captioned; stats shown with explicit missing-window disclosure; existing performance card captioned only; no AI/MCP tool; read-time `ensureSecuritiesHistory`; owner-only route.

### What shipped (PR #24)

- Backend: `loadPriceSeries` gains optional `fromDate`, a parameterized `sources` filter and `basis: "RAW"`; pure `computeRollingReturns` (`rolling-returns.util.ts`); `PerformanceComparisonService.getRollingReturns`; `GET /api/v1/investments/performance/securities/:id/rolling-returns` (JWT, `ParseUUIDPipe`, 404 before any read, no delegate, throttled 60/min).
- Formula: start = last usable NAV at or before the same calendar date N months earlier, at most 14 days older; 1Y `(Pe/Ps - 1)`, 3Y/5Y `(Pe/Ps)^(365.25/d) - 1`; missing windows counted and located, never 0; a period the history does not span is `INSUFFICIENT_HISTORY`.
- Frontend: `FundRollingReturnsCard` on the security detail Overview tab (AMFI funds only; responsive table / phone cards; n/a with reason; incomplete, stale and IDCW notes; error with retry); cumulative caption on `SecurityPerformanceCard`; all 21 locales.
- Docs: INV-ROLLING-001..003 (`enforced`) in `docs/system-invariants.md` + verification matrix rows; the client trailing engine's 151-day-baseline test recorded as a located, open known-wrong test.
- No schema, migration, FX or cost-basis change.

### Validation (Mission 4, local)

| Gate | Result |
|---|---|
| Backend typecheck / eslint / build | clean / 0 errors / clean |
| Backend unit (`TZ=UTC npm run test:unit`) | 16414 passed; 5 pre-existing macOS-only `auto-backup.service.spec.ts` failures (same 5 on `main` `88aba19ec`); parity guard fixed in-branch and re-run green |
| Backend integration (disposable `postgres:16-alpine`, serial) | 44 suites, 517 passed |
| Negative controls | 365, annualized 1Y, unbounded lookup, `setUTCFullYear`, no `sources` filter, no RAW basis: each fails its named test |
| Frontend type-check / lint / i18n:check / build | clean / 0 errors (1 pre-existing `sw.js` warning) / clean / clean |
| Frontend unit, full (`TZ=UTC`) | 872 files, 16657 passed |
| E2E (chromium, `--workers=1`, local stack) | fund-rolling-returns, security-detail, gem-strategy, investments, securities, watchlists, artha-foundation: 40 passed; "every primary route" OOM-kills the dev server locally, left to CI |
| Visual | 1280 light, 390 light, 1280 dark: no defects |

**E2E journeys:** an AMFI fund seeded with FX-A shows 1Y +25.00%, 3Y +25.99%, 5Y +20.12%, equal to the awaited API response; no card and no request for a fund without a scheme code; another user gets 404 and sees nothing.

### Final integration QA (independent re-run)

The final integration/QA pass re-ran the decisive gates on the integration tip `698db6dd2` (24 GiB host; Docker VM 2 CPUs / 6 GiB).

| Gate | Command | Result |
|---|---|---|
| Backend typecheck | `npm run typecheck` | pass |
| Backend build | `npm run build` | pass |
| Backend eslint (no `--fix`) | `npx eslint "src/**/*.ts" "test/**/*.ts"` | 0 errors, 0 warnings |
| Backend unit — rolling returns, loader, service, controller | `TZ=UTC npx jest <4 specs>` | 94 passed |
| Backend unit — guards + every `loadPriceSeries` consumer | `TZ=UTC npx jest invariant-catalog-parity doc-paths source-comment-paths jest-config security-price.service market-index.service gem-price.service` | 271 passed |
| Backend integration — full, real PostgreSQL | `TZ=UTC npx jest --config test/jest-e2e.json --runInBand` (`postgres:16-alpine`) | 44 suites, 517 passed — incl. `schema-entity-parity`, `rls-enforcement`, `rls-enable`, `rls-harness` |
| Migration lint | `npm run migration:lint` | OK |
| Frontend type-check / lint / i18n:check / build | `npm run type-check` / `lint` / `i18n:check` / `build` | clean / 0 errors (1 pre-existing `sw.js` warning) / clean / clean |
| Frontend unit — full | `NODE_ENV=test TZ=UTC npx vitest run` | 872 files, 16657 passed |
| E2E — rolling returns + investment regression (chromium, `--workers=1`, local stack) | `fund-rolling-returns` + security-detail, investments, securities, gem-strategy, watchlists, currencies, investment-account-consolidation | 3 + 44 passed |
| Schema | `git diff origin/main...HEAD -- database/` | empty — no schema change |

Negative controls re-run: `365` in place of `365.25` fails U2 (and two others); dropping `basis: "RAW"` fails the stray-`adjusted_close` integration case by name. All three implementation branches (backend, frontend, tests) are ancestors of the integration tip; the diff vs `main` is 45 files, every one inside the rolling-returns scope.

### Remaining Finsight gaps after Mission 4

- MF category explorer / comparison: NOT DONE (no category model; mfapi `scheme_category` not captured).
- Risk statistics, market-cap allocation, fund overlap: BLOCKED on data.
- Client trailing-return engine (`frontend/src/lib/security-detail.ts`): known defect, follow-up.

---

## Mission 5A — Mutual-Fund Categories & Comparison (specification)

**Status: SPECIFICATION APPROVED — committed as documentation only; docs PR #25 OPEN (not merged). Implementation intentionally NOT started.**

- **Approved spec:** `docs/specs/fund-categories-and-comparison.md` (commit `360ea08a8` on `fm/artha-fund-categories-spec`; documentation PR #25).
- **Mission type:** read-only evidence + specification. **No production source code, schema, migration, API, UI or test was changed.**
- **Category decision:** capture the AMFI classification (`scheme_category`, `scheme_type`, `fund_house`) **verbatim** from the **existing** mfapi/AMFI provider into four new nullable `securities` columns (`fund_house`, `fund_scheme_type`, `fund_category`, `fund_classification_updated_at`); a staleness-gated refresh that writes **only when the provider answered** (never clobbers a known category, never stamps freshness on a failure); **no heuristic inference** (rejects Finsight's `h.sector || 'Equity'`, name-regex AMC guessing and the `'Mid Cap'` default); a missing category renders **Uncategorised**; **no category history** (labels are as-of-now).
- **Comparison decision:** side-by-side **rolling-return distributions** (worst/median/best/%positive/count) of the caller's **own AMFI funds**, **grouped by AMFI category**, **reusing the single approved engine** (`computeRollingReturns`) and the existing wire types; one batched endpoint `GET /api/v1/investments/performance/funds/comparison`; placement in the existing Security Performance report; **column sorting only** — no ranking, no score, no "best fund", no peer benchmark (no fund universe).
- **Recorded BLOCKED:** risk analytics (volatility/drawdown/Sharpe/VaR), fund overlap, peer benchmarking/ranking, market-cap allocation, and plan-option (Direct/Regular, Growth/IDCW) inference.
- **Invariants:** `INV-FUNDCAT-001/002`, `INV-FUNDCMP-001/002/003`, with a full test matrix and named negative controls.
- **Dependency:** the comparison half **requires the Fund Rolling Returns capability (PR #24)** to be merged first; the category half is independent.
- **Finsight evidence:** the original `mutualFunds` router is stubs (`compare` -> `{}`, `rollingReturns` -> `[]`, `portfolioOverlap` -> `0`) over a `mutual_funds` table that is never populated; the original UI's "category" is a sector/name heuristic. Nothing was copied.

---

## Artha de-branding — Monize removal

**Status: IMPLEMENTED on `fm/artha-debrand-01` — code PR #26 OPEN (not merged). Rename only; no feature work.**

- **Branch/commits:** `fm/artha-debrand-01` — `8208f9255` (rebrand, 478 files) and `1c8bd923d` (guard).
- **PR:** **#26** - `chore: remove Monize branding from Artha` -> `main` - **OPEN**.
- **Removed the upstream name from Artha's own surface:** README / CONTRIBUTING / SECURITY / CONTAINER_BUILD / the `CLAUDE.md` set, `docs/**` (except history), `website/**`, `.env.example` comments, helm docs and GitHub templates; Dockerfile labels and image names (`ghcr.io/unplugged-kk/artha-{backend,frontend}`); compose container/network names and host data dir (`./artha/…`); helm chart/labels/`artha-backend-service`; npm package names; demo credentials; database name + roles (`artha`, `artha_user`, `artha_app`, `artha_test`); backup magic `MZBE` -> `ARBE` (string **and** bytes); entity-link scheme `monize://` -> `artha://`; share header `X-Monize-Share-Name` -> `X-Artha-Share-Name`; MCP scope prefix `monize:` -> `artha:`.
- **Kept deliberately (not missed):** `LICENSE` (AGPL-3.0-only) and the single README provenance line (attribution/source required by the licence); `docs/release-notes/**` and `docs/audits/**` (shipped history); `graft/` (untracked, regenerable).
- **Guard:** `backend/src/common/no-monize.guard.spec.ts` fails if the token reappears outside those exemptions.
- **Accepted pre-release breaks:** backups written before this change (`MZBE`) are no longer recognised; existing MCP clients must re-authorise; persisted `monize://` AI-chat links no longer resolve.
- **Verification:** residual scan = the README provenance line only; backend typecheck + build; guards 65/65; backend targeted (`src/backup`, `src/oauth`, `src/updates`) 911 pass with the 5 pre-existing macOS `auto-backup.service.spec.ts` failures (same 5 on `main`); frontend type-check + i18n:check; frontend full suite 871 files / 16631 tests pass; `check-env-docs` / `check-docs-manifests` / `check-migration-prefixes` OK.
- **Sequencing:** merge **PR #24 first**, then this rebrand (**PR #26**), then **PR #25** — the rebrand touches files PR #24 changed, so the code PR lands first to avoid a large rebase.

---

## Known limitations

- Artha de-branding: pre-change backup artifacts and persisted `monize://` AI links are not recognised after the rename, and MCP clients re-authorise; the help/wiki links now target the Artha repository (its wiki content is not yet written).
- Mission 5A: the specification is documentation only and nothing is implemented; the comparison half cannot start until PR #24 is merged.
- Date-aware / historical FX and multi-currency revaluation are covered by backend unit tests; the E2E stack pulls rates from an external provider, so an end-to-end conversion is not deterministic offline.
- Firefox E2E runs in CI — Playwright browsers cannot be installed on the arm64 / Ubuntu 26.04 runner used for local verification.
- Mission 4: GitHub Actions credits are exhausted, so CI will not run on PR #24; local validation is the evidence. IDCW vs Growth cannot be detected (no plan-option field), so every fund's card carries the IDCW caption. The client trailing-return engine on the Security performance card (per-row adjusted/raw splice, unbounded baseline, wall clock) is unchanged.
- Local E2E (Missions 3 and 4) ran on a 6 GB / 2 CPU Docker VM: the Next dev server was OOM-killed while compiling every route (artha-foundation "every primary route", and once in reports). Affected specs passed after a container restart; the full-route sweep is left to CI on PR #23.

## Deferred — later missions

Finsight: MF categories & comparison (specification APPROVED — Mission 5A / docs PR #25; implementation NOT started, pending PR #24); fund rolling returns as an AI/MCP tool (both layers in one PR); risk statistics, market-cap allocation and fund overlap (BLOCKED on data); screener, sentiment/events (DEFERRED). Also India instrument/tax/Account-Aggregator specifics, CAS/broker imports, and new AI/MCP capability. (Fintrack: exhausted in Mission 2.)

## Next mission

**Sequence (owner-set):**

1. **Merge PR #24** — Fund Rolling Returns (Mission 4). *First, because the Mission 5B comparison half depends on its approved engine.*
2. **Merge PR #26** — Artha de-branding (`fm/artha-debrand-01`). *Before PR #25, because it touches files PR #24 changed.*
3. **Merge the specification PR #25** — `docs/specs/fund-categories-and-comparison.md` (documentation only).
4. **Start Mission 5B** — implement Mutual-Fund Categories & Comparison from the frozen specification, with three strictly-disjoint parallel tracks (Backend / Frontend / Tests) feeding one Integration & QA pass and **one** final code PR. The backend contract is the boundary for the frontend; the test track works from the frozen spec, so no two tracks implement the same logic. The local-beta observation period (Compose, real usage, bug log) runs before or alongside this, on a frozen baseline.

Not started, and out of Mission 5B by decision: risk metrics, fund overlap, market-cap allocation, peer benchmarking/ranking and plan-option inference — all recorded BLOCKED in the approved spec. Replacing the client trailing-return engine (`frontend/src/lib/security-detail.ts`) remains a separate follow-up.
