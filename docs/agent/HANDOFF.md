# Handoff log

Newest entries last.

- Research pass done; plan corrected against repo (see AUTONOMOUS_BUILD.md). Next: T1.
- T1 done: backend/src/tax-india (FY config, regime comparison, 80C/80CCD1B/80D headroom; 12 tests). Refuses above surcharge threshold. Next: T2 (not wired to AI/MCP until T3). Note: git push got 403 from the sandbox; commits are local.
- T2 done: equity STCG/LTCG classifier, 1.25L exemption, loss set-off, null totals on unknown lots (grandfathering not modelled -> unknown). Scope is listed equity only; debt/other deferred. Push works now. Next: T3 (wire to AI + MCP).
- T3 done: india_tax tool (compare_regimes, deduction_headroom) in AI executor + MCP via tax-india/tax-llm.ts; one tool instead of two to save tools/list bytes; total budget raised 50500->52200. tax/mcp/ai-query suites green (1176 tests). Next: T4 SMS parser.
- T4 done: backend/src/india-ingestion/sms-parser.ts (HDFC/ICICI/SBI/Axis/Kotak fixtures, UPI VPA/ref, null date when ambiguous, OTP rejected). Real bank formats vary; fixtures are representative, not exhaustive. Next: T5 review queue.
- T8 calculators done (FD, RD, PPF, EPF, NPS, SGB; backend/src/india-assets). RD checked against an independent per-deposit sum. Entities/UI not built. T5/T7 BLOCKED: no PostgreSQL running in this sandbox. Reordered to pure/offline work: T6 tiers, T10, T11 next.
- T10 detectors + T11 debt/FIRE simulators done as pure modules (backend/src/finance-detectors, finance-simulators; 22 tests). NOT yet wired to AI/MCP/alerts/cron: each wiring needs both layers (see T3 pattern) and tools-list byte budget review.
- T6 (categorization decision core) and T12 (coach metrics + verifyNarrative) done as pure modules, 18 tests.
- STATE AT STOP: T1-T4, T6, T8, T10-T12 delivered as tested pure modules; only T1-T3 are user-reachable (india_tax AI+MCP tool). T5, T7 blocked on PostgreSQL; T9 blocked on network; T13 not started.
- Suggested next agent: (1) start PostgreSQL, do T5+T7 with scripts/verify-schema.sh; (2) wire detectors/simulators/coach/categorization/SMS parser into services, AI executor AND MCP together, mind the tools/list byte budget; (3) T9, T13.
- CORRECTION: T4 (SMS parser) and T5 (review queue) duplicated existing `backend/src/import/sms/`; my `india-ingestion/` module was removed and the uncommitted T5 migration reverted. Research had only read docs, not source.
- LOCAL DB: PostgreSQL 16 is installed but stopped each session. Start with `pg_ctlcluster 16 main start`; role artha_user/artha_password (superuser) and db artha_test were created. An integration spec (category-delete-set-null) passed against it via `npx jest -c test/jest-e2e.json <path>`.
- OPEN QUESTION for the owner: should tax-india load rules from the existing `tax_rules` table (DB-versioned) instead of TS config? Not decided.
- T7 done and verified end to end on local PostgreSQL 16 (scratch db artha_schema built from schema.sql; all 195 migrations replayed; migration:lint OK; integration spec test/integration/action-history-actor passes). T9 removed: AMFI already exists.
- T11 wired: plan_simulate tool (debt_payoff, fire) in AI executor + MCP via finance-simulators/simulate-llm.ts. NOTE for owner: tools/list grew 50.5KB -> 54.3KB across india_tax + plan_simulate (~560 tokens per MCP request); consider trimming or making these opt-in.
- T10 service + GET /anomalies done, verified by real-DB integration spec (4 tests; mutation-checked). Reuses TransactionAnalyticsService.getGroupedTotals/getRecurringCharges so investment/transfer exclusions are inherited. MTD-vs-full-month comparison is conservative (misses early-month spikes by design).
- E2E (real server): `scripts/e2e-local-boot.sh` builds nothing itself; run `cd backend && npm run build` first. It creates db artha_run, runs db-init + db-migrate, boots dist/main.js, registers a user, checks /anomalies (401 anon, 400 bad date, empty, real spike seeded by SQL), creates a PAT, speaks MCP JSON-RPC (initialize, tools/list, india_tax with a string income, plan_simulate, india_tax error on missing income). All 13 checks PASS. The 2 "error" lines in the server log are Yahoo Finance lookups failing because the sandbox has no internet.
- NOT covered end to end: the AI Assistant path for india_tax/plan_simulate (needs an AI provider; covered by unit tests on the executor only), MCP write attribution (actor_type='mcp'; covered by integration test of the context only), and any frontend.
- Known failing before my changes: src/securities/performance-comparison.service.spec.ts (expects a 5y backfill window, gets 10y; clock-dependent; untouched by this branch). module-graph.spec.ts OOMs a Jest worker under --maxWorkers=3 but passes alone.
- FULL VERIFICATION (local PostgreSQL 16, TZ=UTC), at commit after the E2E script:
  * Backend unit: 658/660 suites, 16,471 tests pass. Failing: performance-comparison.service.spec (pre-existing, clock-dependent, file untouched by this branch) and module-graph.spec (Jest worker OOM under --maxWorkers=3; passes alone, 57/57).
  * Backend integration: 46/46 suites, 524/524 tests pass. Needs `ALTER ROLE artha_user CREATEDB` (migration-path spec) and `NODE_OPTIONS=--max-old-space-size=9000` (one process holds all 46 specs; default heap OOMs).
  * Backend typecheck is clean. eslint: clean on all 48 .ts files changed here; 4 prettier errors remain in one brand-guard spec under src/common (not touched here). i18n:check: ok. migration:lint: ok. schema.sql applies; all 195 migrations replay as no-ops.
  * scripts/e2e-local-boot.sh: 13/13 checks pass against the compiled server.
- T6 wired: POST /categorization/suggest (backend/src/categorization). Verified: 5 real-DB integration tests (rule > merchant > history; ambiguous merchant category stays silent; history needs a majority; no cross-user history; mutation-checked by removing the user filter) and 5 more checks in scripts/e2e-local-boot.sh (now 18). Anonymous POST gets 403 not 401 because the global CSRF guard runs before auth.
- T12 done: backend/src/coach. GET /coach/weekly (no AI cost) and POST /coach/weekly (throttled 5/min; AI narrative via AiService.complete feature "coach", verified by verifyNarrative, one retry, else withheld with reason unsupported_numbers; no_ai_provider vs ai_failed by exception TYPE because the message is translated). Figures: register in/out for the 7-day window in the user's preferred currency only (other currencies listed in excludedCurrencies); budget share uses the budget's own period; net worth is month-on-month and only when both months are fully converted. Verified: 7 real-DB integration tests (mutation-checked by disabling the verifier) + 3 checks in scripts/e2e-local-boot.sh (now 21). Not stored (no table), no cron: ai_insights was left alone because its type list feeds the insights UI. Gotcha: the fallback currency with no preference row is INR.
- T13 done as an extension, not a wizard: frontend/src/components/dashboard/GettingStarted.tsx gained two steps (AI provider -> /settings/ai, notifications -> /settings#notifications; grid now 3 columns). Found by reading the source first: the first-run preferences screen, the Getting Started card and the intro tour already existed. Verified: 86 vitest suites / 2,748 tests (i18n parity, duplicate keys, ui-conventions, tours, dashboard, settings), type-check, eslint, i18n:check, and a real Chromium run (scripts/e2e-local-ui-getting-started.cjs: card renders, both steps navigate by keyboard, notifications section scrolled into view on arrival, no horizontal scroll at 360px, no 5xx, no console errors). A guard test (getting-started-anchors.guard.test.ts) fails if the settings route or the #notifications anchor goes away; mutation-checked.
- Two wrong turns worth knowing: (1) I first linked the AI step to /settings#ai-settings, but that anchor is only a card that links to /settings/ai, so the step now goes there directly. (2) I added a hash-scroll effect to the settings page, then found useScrollSpy already scrolls to the URL hash after load (my browser check had read the page mid smooth-scroll); the effect and its tests were reverted. `next dev` also rewrites frontend/CLAUDE.md with an agent-rules block: do not commit that.
- replica-skill (github.com/Jakeschincariol/replica-skill, MIT, read-only clone at /home/user/jakeschincariol/replica-skill): the user asked to use it where it helps. Most of it clones OTHER apps (recon, build, brand, deploy, diff, entrepreneur) and does not apply to Artha. Used its replica-test method (numbered edge-case list: keyboard only, mobile width, console errors, 5xx, second user's data) for the card and the coach/categorization/anomaly tests; its contrast checker was not needed because the new UI reuses existing colour classes. Its scripts are standard-library Python, no network, read before use.

## Session notes: deployment, logo, accessibility, design

- Deployment: Railway, Vercel, Cloudflare Tunnel and native Ubuntu paths are in `docs/deployment/`. The native install was verified end to end on Ubuntu 24.04; the Railway, Vercel and Cloudflare deploys themselves were not run, and macOS was not run.
- Logo: one source, `frontend/scripts/build-app-icons.mjs`. Rerun it, then the badge script, after any change to the mark.
- Accessibility: `scripts/a11y-audit.cjs` went from 604 to 2 violations, and the last 2 are fixed but not re-measured on a clean build. Start the backend with `RATE_LIMIT_MAX=100000`, and delete `.next` before measuring.
- Design: `docs/design/README.md` and the mock in `docs/design/mockups/`. Three layout changes await the owner's decision.

## E2E run on the native stack (Node 22.23.4, Chromium)

- Command: start the stack with `scripts/install-native.sh --start` against a database with NO users (the first registered user is the admin the suite logs in as; a database that already holds the demo user makes 3 admin and backup tests fail for setup reasons), then `BASE_URL=http://localhost:3000 CHROMIUM_PATH=<chrome> npx playwright test --config playwright.local.config.ts` from `e2e/`.
- Result: 198 of 199 passed in one run with `--grep-invert "enforces a second factor"`; that test passes on its own. 
- Open defect: after the "enforces a second factor at login" test the backend process exits with `ERR_INTERNAL_ASSERTION` in `ServerResponse.detachSocket`, every time (reproduced twice). It is a Node internal assertion, the sandbox runs Node 22.23.4 and the production images use Node 24, and Node 24 could not be tried here. Unproven whether it also happens on Node 24; check before blaming the app, and check with `docker-compose.e2e.yml` (Node 24) first.

## Repository recovery session (2026-11-11, branch `fm/artha-xlsx-import-01`)

Started from `main` at `2864d1c76` (PR #30 merged). The canonical checkout was
on `fm/artha-local-beta-01`, one unpushed commit ahead of its remote and 39
commits behind `main`, with 64 modified files and a large untracked tree. Two
different efforts were mixed in that working tree; they were separated rather
than committed together.

**What was recovered as product work.** An Excel (.xlsx) import feature:
backend sheet listing and sheet-to-CSV conversion, the frontend sheet picker,
wizard wiring, and translations in all 20 translated catalogs (`en-GB` and
`en-US` take the `en` base, which the parity check confirms). It was
uncommitted but complete and tested, and `README.md` already advertised it on
the beta branch.
It is now one commit on a mission branch off `main`, with no conflicts because
none of the touched files had changed on `main` in the intervening 39 commits.

**What was deliberately not committed.**
- The marketing-site likeness experiment at the repo root (`src/`,
  `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `handover.md`,
  `capture/`, `checks/`, `investigation.cany/`, `inbox/`, `craft.json`). It
  rebuilds another product's layout at the root of a workspace whose root is
  not an app, and it also changes the root `package.json` into a Next.js app.
  It is kept off this branch and off `main`. It now lives on
  `fm/artha-local-beta-01` (`0a19e6311` site, `d14e1038a` layout tweaks,
  `a7eebbce6` content updates) and is pushed there, so PR #27 carries it too;
  that PR is the beta-environment PR and mixing the two is a reason to split
  or close it. The generated `capture/`, `checks/` and `investigation.cany/`
  artifacts stay uncommitted in every case.
- Local agent tooling: `.claude/settings.json` hook/statusline config,
  `.claude/helpers/`, `.agents/`, `.cursor/`, `.gemini/`, `.codex/`,
  `.commandcode/`, `.context/`, `.mcp.json`, `opencode.json`.
- Probe files (`src/__probe.txt`, `src/app/platform/probe.txt`,
  `src/app/platform/tiny.tsx`) and run artifacts (`feed.json`,
  `transcript.json`, `usage.json`).

**Accidental damage reversed, not committed.** Three barrel `index.ts` files
(`backend/src/reports/dto/`, `frontend/src/components/reports/`,
`frontend/src/components/ui/row-actions/`) were deleted in the working tree and
two other files had been edited to work around the deletions. All still exist
on `main` and are imported; the deletions would have broken the build.

**What was fixed or recovered.**

- Locale parity was red on `main`, not green: PR #30 merged before the last
  two commits on its branch. `7c599b717` carries the attention / chart-fold /
  where-you-stand strings for every full-translation locale (and drops the
  plural from the due-soon hint); `29eda0f89` carries the README sections for
  the dashboard, currencies, deployment and testing. Both were still on
  `origin/claude/dreamy-clarke-6543cx`, unreachable from `main`, and both are
  recovered here. `messages.parity.test.ts` went from 36 failing to 1,646
  passing.
- `performance-comparison.service.spec.ts` was the known red suite: it
  asserted a "5y" provider range for a fixed 2022-01-01..2025-12-31 window
  while the service measures that range back from today, so the assertion
  decayed with the calendar. The test now pins `todayYMD` to the window's end
  and restores it in a `finally`; 42/42 pass.
- BETA-001: `market-index.service.ts` inserted a provider payload verbatim, so
  two bars for one `(index_code, price_date)` made Postgres reject the whole
  statement and KOSPI logged a refresh failure on every boot. `bulkUpsert` now
  collapses duplicates over the whole payload before batching, and the later
  observation wins. A unit case feeds two bars on one date; the spec is 49/49.
  A real boot was not repeated, so the boot-log half of the evidence is still
  outstanding.

`module-graph.spec.ts` still passes alone (59/59) and still OOMs a worker under
`--maxWorkers=3`; that is unchanged test infrastructure, now tracked as N11 in
`BACKLOG.md`.

**Verified in this session** (Node 24 in CI, local Node 22 here):

| Gate | Result |
|---|---|
| Backend typecheck | clean |
| Backend lint | clean |
| Backend build | clean |
| Backend unit — `src/import/xlsx` + all `src/i18n` | 11 suites, 313 tests pass |
| Backend unit — `performance-comparison.service.spec.ts` | 42/42 pass after the fix |
| Backend unit — `market-index.service.spec.ts` | 49/49 pass after the BETA-001 fix |
| Backend unit — `src/securities` + `src/import` | 116 suites, 3,753 tests pass |
| Backend unit — `module-graph.spec.ts` alone | 59/59 pass |
| Frontend type-check | clean |
| Frontend lint | clean (1 pre-existing `sw.js` warning) |
| Frontend i18n parity | clean |
| Frontend tests — import client, picker, upload, wizard, page | 155 pass |
| Frontend full unit suite | 882 files, 16,792 tests pass |
| Frontend i18n parity | 1,646 pass after recovering the stranded translations |
| Frontend guards — balance-cache, test-hygiene, api-page-limits, e2e-conventions, intl | 22 pass |
| Frontend production build | clean, 56 routes |
| Backend integration / E2E / Playwright | **not run: no PostgreSQL and no browser stack in this environment** |

**Environment gotchas worth inheriting.**
- `NODE_ENV=production` leaks into this shell. React Testing Library then
  loads the production `react-dom` and every component test fails with
  `React.act is not a function`. Run frontend tests as
  `NODE_ENV=test npx vitest run ...`.
- Backend Jest config is inline in `backend/package.json`; `npx jest <path>`
  works, `--config test/jest.config.js` does not exist.
- `pg_isready` reports no server; integration and Playwright gates cannot run
  until one is started.
- **A live Craft Anything process was operating on the canonical checkout
  during this session** and switched its branch twice mid-command
  (`git reflog` shows bare `checkout` entries). Mission work was therefore
  finished in a separate worktree, `/Users/kishore/git/artha-xlsx`, on
  `fm/artha-xlsx-import-01`. Run `git branch --show-current` before assuming
  where you are, and do not run a second agent against the same checkout.
  `frontend/src/app/login/page.tsx` was left modified by that process; it is
  not part of this branch.

**Next agent: start here, in this order.**
1. `CLAUDE.md` (repo law), then `backend/CLAUDE.md`, `frontend/CLAUDE.md`,
   `database/CLAUDE.md`, `backend/src/mcp/CLAUDE.md` for the area you touch.
2. `docs/agent/BACKLOG.md` — "Reconciled next work". Take N1, then N2.
3. `docs/system-invariants.md` and `docs/financial-calculation-contract.md`
   before any money or schema change.
4. `docs/beta/artha-local-beta-01.md` for the beta baseline and BETA-001.

The beta observation period is still the product context: fix defects through
a triage mission, do not resume feature development in place. PR #27 is open,
stale, and now also carries the marketing-likeness experiment; split it or
close it before merging anything else into that branch.

## Development session (2026-11-11, branch `fm/artha-fund-categories-01`, PR #34)

Started from `main` at `259f7690e` (PR #33 merged). No local changes were
discarded: the only untracked path was `.commandcode/` (local agent tooling,
deliberately not committed). This file is the authoritative handover **and** the
session log; a separate `SESSION_LOG.md` would duplicate it, so entries continue
here, newest last, as the header says.

**Objective.** Take the highest-priority unfinished product milestone from
`BACKLOG.md`. N1 (BETA-001) was already fixed; N2 (restore rehearsal) is a
verification exercise needing a disposable database; N3 (Mission 5B, the
approved `docs/specs/fund-categories-and-comparison.md`) is the next P2 product
capability and was fully specified with invariants, a test matrix and acceptance
criteria. N3 was split the way the spec allows: the category half ships
independently of the comparison half.

**What was implemented (category half of N3).**

- `backend/src/securities/providers/mfapi-payload.util.ts`:
  `parseMfapiSchemeClassification` and the `MfapiScheme.classification` field.
  Blank/non-string become `null`, never `""`; a missing `meta` object is `null`.
- `backend/src/securities/fund-classification.service.ts`:
  `ensureFundClassification`. Seven-day staleness gate, provider answer required
  before any write or stamp, writes keyed on `(id, userId)`, one
  `withScopedDb` transaction, failures logged and swallowed. Reuses
  `AmfiNavService.fetchSchemeClassification`, which reuses the existing 4h
  scheme-payload cache, so no new provider call while the payload is warm.
- Capture is wired into the securities list, the security detail and the
  rolling-returns read.
- Schema: `fund_house`, `fund_scheme_type`, `fund_category`,
  `fund_classification_updated_at` on `securities`; migration
  `database/migrations/20261111090000_fund_classification.sql` (additive and
  idempotent) plus `database/schema.sql` in the same commit.
- Frontend: the four fields on `Security`; Fund house / Scheme type / Fund
  category rows in `SecurityKeyInformation`; a Category column on the securities
  list (`hidden md:table-cell`, same dash as an empty exchange for a non-fund);
  a client-side category filter offering only the categories present plus
  `Uncategorised` only when an AMFI fund lacks one.
- Docs: `INV-FUNDCAT-001`/`INV-FUNDCAT-002` added to the catalog and the
  verification matrix; the spec's implementation-status line and `BACKLOG.md`
  N3 record the split.

**Decisions worth inheriting.**

- A write requires a non-null `scheme_category`. The spec's write rule is
  category-driven, and an answer without one is nothing to store; the row stays
  due, so the next read retries. `fundHouse`/`fundSchemeType` are written in the
  same statement as the category, never alone.
- The mobile wrapped card does **not** carry Category. The tier row hides it
  below `md` anyway, and the page filter is the phone's way to narrow by it. The
  card's invariant comment was updated rather than left false.
- `SecuritiesService.findAll`/`findOne` were left alone: `findOne` is the
  ownership check on many write paths, and a provider fetch there would put a
  network call in front of every mutation. Capture sits on the controller's list
  route and inside `SecurityDetailService.getDetail`.

**Tests and results (all run in this environment).**

| Gate | Result |
|---|---|
| Backend typecheck / lint / build | clean |
| `src/securities` unit (52 suites) | 1,879 tests; the only 2 initial failures were DI wiring in `securities.controller.spec.ts` and `security-detail.service.spec.ts` (fixed, both green) |
| Guard suites after staging (`fund-classification.guard`, `doc-paths`, `source-comment-paths`, `invariant-catalog-parity`) | green |
| `test/integration/fund-classification.integration.spec.ts` | 4/4 on real PostgreSQL 17 |
| `schema-entity-parity`, `migration-path`, `fund-rolling-returns` integration | 16/16 |
| `migration:lint` and the 196-migration replay | clean |
| Frontend type-check / lint / `i18n:check` / parity (1,648) | clean |
| Frontend full unit suite | 882 files / 16,800 tests pass |
| Frontend production build | clean |
| Playwright / docker E2E stack | not run (no browser stack here) |

**Commits and PR.** `64f8e1d76` on `fm/artha-fund-categories-01`, pushed; PR
https://github.com/unplugged-kk/artha/pull/34. CI is the reviewer of record for
the gates that need the compose stack.

**Environment on this machine (for the next agent).** No system PostgreSQL was
running; one was created for this session with the Nix binaries:
`initdb -D /home/ubuntu/pgdata -U artha_user --auth=trust`, then
`pg_ctl -D /home/ubuntu/pgdata -l /home/ubuntu/pgdata/server.log -o "-k /tmp -p 5432" start`.
`artha_test` was created, and `ALTER ROLE artha_user CREATEDB` was granted (the
migration-path spec creates a scratch database). The shell exports
`NODE_ENV=production`, which makes `npm ci` skip dev dependencies and makes
Vitest load production React -- prefix installs with
`NODE_ENV=development npm ci --include=dev` and tests with `NODE_ENV=test`.
Backend unit tests are slow in this environment (a single suite ~25s cold); run
suites in the background rather than under the 10-minute command cap.

**Next action.** (1) Push this handover commit and let PR #34's CI run; if green,
it is ready for the project's merge rule. (2) Next milestone: the **comparison
half of N3** — `GET /investments/performance/funds/comparison`,
`FundComparisonTable` grouped by `fund_category` (Uncategorised last), the
`fundHouse`/`fundSchemeType`/`fundCategory` member fields, INV-FUNDCMP-001..003,
and the E2E journey in spec §9. Every figure must come from
`computeRollingReturns`; no category median, percentile or ranking
(INV-FUNDCMP-002). (3) Then N2 (restore rehearsal) and N4 (expose the duplicate
and low-balance detectors), both specified in `BACKLOG.md`.
