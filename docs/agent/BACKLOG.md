# Backlog

Priority levels: **P0** correctness, security or data integrity; **P1** required
foundation; **P2** product functionality; **P3** enhancement or optimisation.

A task is done only when the gate written beside it passes. "The screen exists"
and "the endpoint answers" are not gates. Dependencies are named in brackets.

## Autonomous build queue (T1-T14) — complete

The original queue from `AUTONOMOUS_BUILD.md`. Kept because each line records
what was actually delivered, including the parts deliberately left out.

- [x] T1 India tax engine core: FY-versioned config, old vs new regime comparison, 80C/80D/80CCD(1B) headroom (pure TS, `backend/src/tax-india/`, unit tests)
- [x] T2 Tax engine: capital gains STCG/LTCG classifier (equity 12 months, debt/other rules per FY config)
- [x] T3 Tax engine wired as AI tools AND MCP tools (`tax_compare_regimes`, `tax_deduction_headroom`), both layers, with evidence field
- [REMOVED: duplicate of backend/src/import/sms/ (composite parser, review_needed flow, sender registry)] T4 SMS parser (HDFC, ICICI, SBI, Axis, Kotak templates, UPI VPA extraction), pure TS with fixtures
- [REMOVED: duplicate; SMS review flow already exists in backend/src/import/sms/] T5 Ingestion review queue: entity, migration, `schema.sql`, service, controller (nothing posts without confirmation)
- [x] T6 (POST /categorization/suggest wires tiers 1-3: RulesService, merchant reference + user category resolution, payee history; reports the deciding tier. Tier 4 is reported as needs_ai only; the AI call and any write stay in the existing confirmed-action flow) Categorization pipeline tiers 2-4 (merchant defaults, historical payee pattern, AI fallback) logging the tier on the result
- [x] T7 `action_history.actor_type` (user|ai|mcp) and `tool_name`, via ambient actor context set by the AI confirm path and the MCP transport (`tier` deliberately not added: it belongs to categorization output). Verified: schema.sql apply, 195-migration replay, migration alone on old schema, real-DB integration spec
- [x] T8 (calculators only; entities need the DB design below, see N5) India asset metadata: EPF/PPF/NPS/FD/RD/SGB/physical gold maturity and interest calculators (pure TS), then entities
- [REMOVED: already exists, securities/amfi-nav.service.ts] T9 AMFI NAV fetcher in market data
- [x] T10 (GET /anomalies: category spikes + subscription increases on real data, integration-tested; duplicates + low-balance detectors exist but are not exposed; no alerts/cron/AI/MCP — see N4) Deterministic detectors: spending spike (>2 sigma), subscription increase, low-balance projection
- [x] T11 (simulators exposed to AI + MCP as plan_simulate; Monte Carlo/goals reuse not done) Debt snowball/avalanche + FIRE simulators (reuse `monte-carlo`, `goals`)
- [x] T12 (GET /coach/weekly deterministic metrics; POST /coach/weekly adds an AI narrative that is rejected if it quotes any number not computed, one retry naming the offending numbers; on demand, not stored, no cron) Weekly coach report (deterministic metrics, LLM narrative with citations)
- [x] T13 (NOT a new wizard: the app already had a first-run language/currency step, a Getting Started dashboard card and an intro tour. The real gaps were the AI provider and notifications steps, added to the existing card: /settings/ai and /settings#notifications; 18 locales translated, pseudo-locale regenerated) Onboarding wizard (frontend, English catalogs only)
- [x] T14 Excel (.xlsx) import: `POST /import/xlsx/sheets` lists sheets with a guessed header row and preview; `POST /import/xlsx/to-csv` converts one sheet to CSV and the existing CSV wizard takes over. Reader skips a title banner (distinct-value header scoring, merged-cell safe) and stops at the first blank row; 25 MB multipart limit; `veryHidden` sheets excluded. Verified: 21 backend unit tests, 155 frontend tests, backend+frontend typecheck, lint, i18n parity, both production builds

## Reconciled next work — 2026-11-11 (main `259f7690e`)

The queue above is finished. These are the gaps the implementation and the
session records actually leave behind, strongest evidence first. Nothing here
is a new plan: each item comes from a document already in the repo.

### P0 — none open

No known correctness, security or data-integrity defect is open. The red
frontend i18n gate, the calendar-dependent backend case and BETA-001 were all
fixed on 2026-11-11, and `module-graph.spec.ts` is explained rather than red.
See `HANDOFF.md`.

### Recovered and fixed on 2026-11-11

- **Locale parity was red on `main`.** PR #30 merged before the last two commits
  on its branch: `7c599b717` (attention / chart-fold / where-you-stand strings
  for every full-translation locale, and the due-soon plural dropped) and
  `29eda0f89` (README sections for the dashboard, currencies, deployment and
  testing) were left on `origin/claude/dreamy-clarke-6543cx`, unreachable from
  `main`. Both are recovered on this branch. Evidence:
  `messages.parity.test.ts` went from 36 failing to 1,646 passing, and the full
  frontend unit suite is 882 files / 16,792 tests.
- **`performance-comparison.service.spec.ts`** asserted a range tier that
  drifted with the calendar; the clock is now pinned per case.
- **BETA-001** (N1 below) is fixed in the index batch upsert.

### P1 — foundation and integrity

1. [x] **N1. BETA-001: the KOSPI market-index upsert collides with itself.**
   - Objective: stop the `QueryFailedError ... ON CONFLICT DO UPDATE command cannot affect row a second time [21000]` logged on every boot.
   - Context: `backend/src/securities/market-index.service.ts`; evidence and reproduction in `docs/beta/artha-local-beta-01.md`.
   - **Fixed 2026-11-11:** `bulkUpsert` collapses duplicate `(index_code, price_date)` rows over the whole payload before batching, and the later observation wins, which is what inserting them one at a time would do. A unit case feeds two bars on one date and asserts one row with the later close; `market-index.service.spec.ts` is 49/49.
   - Still open: a real boot against an empty database was not repeated (no PostgreSQL here). Re-check the boot log as the closing evidence.

2. **N2. Restore rehearsal against a disposable database.**
   - Objective: prove that a backup exported from a running installation restores, which is the half of the contract never exercised.
   - Context: `docs/backup-restore-contract.md`, `docs/support-backup.md`, `backend/src/backup/`.
   - Deps: PostgreSQL.
   - Acceptance: export → restore into an empty database → every contract check passes, including the `REFS` map coverage for newer tables.
   - Gate: scripted or automated restore run recorded in `HANDOFF.md`; a restore must never target the beta database.

### P2 — product

3. **N3. Mission 5B: implement `docs/specs/fund-categories-and-comparison.md`.** — category half **done**, comparison half **open**.
   - **Category half (done 2026-11-11, `fm/artha-fund-categories-01`):** the four nullable columns, the parser, `FundClassificationService.ensureFundClassification` (write only on an answer, INV-FUNDCAT-002), capture on the securities list/detail and rolling-returns reads, the detail rows, the list column and the client-side category filter, the source scan that bans a guessed/defaulted category, and the real-DB integration spec. Invariants INV-FUNDCAT-001/002 catalogued and in the verification matrix. Remaining from §9 for this half: nothing.
   - **Comparison half (open):** `GET /investments/performance/funds/comparison`, the grouped `FundComparisonTable`, the `fundCategory` fields on the comparison member, and INV-FUNDCMP-001..003. Deps: the rolling-returns engine, which is on `main`.
   - Gate (comparison): spec §9 U4/U5, I1/I3, the E2E journey, `tools/list`-equivalent none (no AI/MCP surface), i18n in every locale.

4. **N4. Expose the two detectors that are built but unreachable.**
   - Objective: duplicates and low-balance projection already exist in `backend/src/finance-detectors/` but no endpoint, alert or cron consumes them.
   - Deps: N1 is unrelated; alerts need the notification preferences contract.
   - Acceptance: a caller can obtain both detector results without duplicating the spike/subscription logic; unknown data stays unknown.
   - Gate: real-DB integration spec per detector, mutation-checked by removing the user filter.

5. **N5. India asset entities and UI (T8 follow-on).**
   - Objective: FD/RD/PPF/EPF/NPS/SGB/physical-gold records, not just calculators.
   - Deps: a schema decision (entity shape + RLS), migration plus `database/schema.sql`.
   - Acceptance: a user can record and see each asset; calculated maturity/interest comes from the existing pure calculators, never a second engine.
   - Gate: migration replay, RLS isolation test, calculator parity test.

6. **N6. Decide where India tax rules live.**
   - Objective: close the open owner question in `HANDOFF.md` — `backend/src/tax-india/` currently carries FY rules in TypeScript while a versioned `tax_rules` table already exists.
   - Acceptance: one authoritative source, with the other removed rather than kept in sync by hand.
   - Gate: the chosen source is what `tax_compare_regimes`/`tax_deduction_headroom` read, proven by a test that changes a rule and sees the tool answer change.

7. **N7. End-to-end coverage of the AI and MCP write paths.**
   - Objective: `india_tax` and `plan_simulate` are covered by executor unit tests and an MCP JSON-RPC check, but not through the AI Assistant path with a real provider; MCP write attribution is covered only at the context level.
   - Deps: an AI provider for the assistant half.
   - Acceptance: one recorded run per path.
   - Gate: run recorded in `HANDOFF.md`; `tools/list` byte budget re-measured (it grew 50.5 KB → 54.3 KB across T3 and T11, about 560 tokens per MCP request).

8. **N8. Excel import: E2E journey and a short guide.**
   - Objective: the feature is unit- and component-tested but has no browser journey, and no guide equivalent to `docs/import-ms-money.md`.
   - Acceptance: an E2E that uploads a workbook, picks a sheet and header row, and reaches the CSV mapping step with the expected columns.
   - Gate: Playwright spec green in the native stack; README already documents the formats.

### P3 — enhancement

9. **N9. Re-measure accessibility on a clean build.**
   - Objective: the last two axe violations were fixed after the measured run and never re-measured.
   - Context: `scripts/a11y-audit.cjs`, `docs/design/README.md` (it records 604 → 2).
   - Gate: a fresh `.next`, `RATE_LIMIT_MAX=100000`, and the audit's own run recorded; zero violations across the six pages in light, dark and phone width.

10. **N10. Verify the deployment paths that were written but not run.**
    - Objective: Railway, Vercel and Cloudflare configs exist and the native Ubuntu install was verified; the hosted deploys and macOS were not.
    - Gate: one recorded run per path, or an explicit statement that the path is unsupported.

11. **N11. Test-infrastructure: `module-graph.spec.ts` OOMs under parallel workers.**
    - Objective: the spec passes alone (59/59) but kills a Jest worker at `--maxWorkers=3`.
    - Gate: the spec runs green in the CI unit job without raising the heap.

## Process items, not code

- **PR #27** (`fm/artha-local-beta-01` → `main`) is still open and now badly stale (its base is `5ab3f6188`, 39 commits behind). It also carries the root-level marketing-likeness experiment, which is unrelated to the beta environment its title describes. Split it or close it before the beta triage mission; do not merge it as-is.
- The rolling status snapshot lives on `fm/artha-mission-status` (`docs/status/artha-mission-status.md`) and is deliberately never merged. Read it with `git show origin/fm/artha-mission-status:docs/status/artha-mission-status.md`; its "last updated" line names the commit it describes.
