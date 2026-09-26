# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, and the next-mission brief are below.

Last updated: 2026-09-26 · `main` at **`cfe995483`** · **Mission 1 MERGED (PR #22)** · **Mission 2 COMPLETE — Fintrack audit, scope exhausted, no code change** · **Mission 3 — Finsight: one PARTIAL gap implemented, code PR #23 OPEN (not merged)** · next mission: **Mission 4 — Finsight fund rolling returns (spec first)**

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

- **main SHA:** `cfe995483` — `Merge pull request #22`.
- **Rolling status PR:** PR #5 (`fm/artha-mission-status`) — strictly one file, `docs/status/artha-mission-status.md`.
- **Code PR:** **PR #22** — `feat: complete initial Artha productization` (`fm/artha-productization-01` → `main`) — **MERGED**.
- **Merged PRs:** #1–#22.

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

**Status: ONE PARTIAL GAP IMPLEMENTED — code PR #23 open (`fm/artha-finsight-01`, not merged).** Baseline `main` `cfe995483`.

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
| **Concentration / diversification** | `routes/analytics.ts:22` (`diversificationScore: 0`) | `concentration.util.ts` + LLM/MCP; UI missing on `main` | **PARTIAL → implemented in PR #23** | awaiting owner merge |
| Watchlists | `db/schema.ts` | `backend/src/watchlists/*`, `/watchlists`, `e2e/tests/watchlists.spec.ts` (PR #13) | DONE | none |
| Index / benchmark comparison | — | `market_index_prices`, `performance-comparison.service.ts` | DONE | none |
| Investment reports / alerts | — | `investment-reports/**`, `notification-center/**` | DONE | none |
| AI assistant, portfolio-grounded | `ai-engine/src/main.py:33` (static insight) | `backend/src/ai/**`, `mcp/**`, `getLlmSummary` | DONE (Finsight impl REJECTED) | none |
| Risk stats (σ, Sharpe, Sortino, drawdown, VaR) | `routes/analytics.ts:26-27,70-79` (zeros) | no flow-adjusted periodic return series (`/net-worth/investments-daily` is value incl. contributions; `calculateTWR` chains at transaction boundaries) | BLOCKED | needs a return-series spec |
| Market-cap allocation | `routes/analytics.ts`, `routes/stocks.ts` | no market-cap data | BLOCKED | needs a data source |
| Fund rolling returns | `routes/mutualFunds.ts:53-62` (empty) | AMFI series stored in full; no calculation | NOT DONE | new calculation — approved spec required before implementation (project rule) |
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

## Known limitations

- Date-aware / historical FX and multi-currency revaluation are covered by backend unit tests; the E2E stack pulls rates from an external provider, so an end-to-end conversion is not deterministic offline.
- Firefox E2E runs in CI — Playwright browsers cannot be installed on the arm64 / Ubuntu 26.04 runner used for local verification.
- Local E2E (Mission 3) ran on a 6 GB / 2 CPU Docker VM: the Next dev server was OOM-killed while compiling every route (artha-foundation "every primary route", and once in reports). Affected specs passed after a container restart; the full-route sweep is left to CI on PR #23.

## Deferred — later missions

Finsight: fund rolling returns and MF category/comparison (NOT DONE, spec first); risk statistics, market-cap allocation and fund overlap (BLOCKED on data); screener, sentiment/events (DEFERRED). Also India instrument/tax/Account-Aggregator specifics, CAS/broker imports, and new AI/MCP capability. (Fintrack: exhausted in Mission 2.)

## Next mission

After the owner merges PR #23: **Mission 4 — Finsight fund rolling returns**, starting from the latest merged `main` with a short financial spec (window alignment on non-trading days, annualization, missing-NAV policy, test matrix) for owner approval before any implementation. The AMFI NAV series it needs is already stored in full.
