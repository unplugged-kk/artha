# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, and the next-mission brief are below.

Last updated: 2026-09-25 · `main` at **`cfe995483`** · **Mission 1 MERGED (PR #22)** · next mission: **Mission 2 — Fintrack Completion Audit & Implementation**

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

## Known limitations

- Date-aware / historical FX and multi-currency revaluation are covered by backend unit tests; the E2E stack pulls rates from an external provider, so an end-to-end conversion is not deterministic offline.
- Firefox E2E runs in CI — Playwright browsers cannot be installed on the arm64 / Ubuntu 26.04 runner used for local verification.

## Deferred — later missions

Fintrack features, Finsight analytics, India instrument/tax/Account-Aggregator specifics, CAS/broker imports, advanced risk metrics, and new AI/MCP capability.

## Next mission

**Mission 2 — Fintrack Completion Audit & Implementation**. PR #22 is merged; Mission 2 is ready to begin from `main` at `cfe995483`.
