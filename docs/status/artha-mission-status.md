# Artha mission status — review me here

**How this works:** each mission rewrites this file as a current snapshot (never a diary). **This PR is never merged — it is overwritten.** The summary is at the top; matrices, evidence, baseline audit, and the next-mission brief are below.

Last updated: 2026-09-17 · `main` at **`9df296b58`** · **PR #20 and PR #21 are MERGED** · next mission: **Mission 1**

---

## TL;DR

- **Mission:** repair every failing CI check on PR #20 and PR #21, verify both, leave both ready. Both are now **merged into `main`** at the owner's instruction; `main` is `9df296b58`.
- **The baseline was redder than the handover said.** `main` itself (`d98886c13`) failed Backend Unit Tests, Backend Integration Tests, Frontend Unit Tests, Frontend Lint & Type Check, Schema vs Migrations Drift and Bearer Security Scan. Both PRs inherited those; PR #21 additionally carried its own.
- **Thirteen distinct defects repaired**, each at its root cause rather than at its symptom: no test skipped, no assertion loosened, no guard grandfathered, no constraint disabled, nothing financial changed.
- **The E2E lane was the blind spot.** It had been *skipped for weeks* behind the failing unit lanes, so nothing had ever driven the UI against the real backend. Unblocking it exposed four defects nobody could have seen, including one that made the SMS intake feature entirely non-functional.
- **Next mission remains Mission 1** (below). It has not been started.

---

## Current main / repository state

- **main SHA:** `9df296b58` — `Merge pull request #21`. Contains `a6344a1b1` (`Merge pull request #20`) on its first-parent chain.
- **Merged this mission:** PR #20 (`fm/artha-goals-01`, head `b66931750` → merge `a6344a1b1`) and PR #21 (`fm/artha-product-ux-01`, head `0823c661e` → merge `9df296b58`).
- **Rolling Status PR:** PR #5 (`fm/artha-mission-status`), containing strictly one file (`docs/status/artha-mission-status.md`).
- **Merged before this mission:** PR #1 – #4, PR #6 – #19.

---

## Current mission status: CI repair & verification

| # | Failing check | Actual root cause | Repair | PRs |
|---|---|---|---|---|
| 1 | Backend Unit — `array-bound-dto.spec.ts` | Seven DTO array properties (`ApplyRulesDto.ruleIds`, `CreateRuleDto.conditions`, `ReorderRulesDto.ruleIds`, `RuleActionsDto.addTagIds`, `UpdateRuleDto.conditions`, `ReorderWatchlistItemsDto.itemIds`, `ReorderWatchlistsDto.watchlistIds`) declared `@IsArray()` with no `@ArrayMaxSize`, so a request-supplied array bounded an unbounded per-element loop | A real bound on each, sized to the payload it carries (500 ids, 50 conditions, 100 tags). The grandfather list was **not** extended — it exists for properties older than the guard and may only shrink | #20, #21 |
| 2 | Backend Unit — `price-boundary.one-door.spec.ts` | `watchlists.service.ts` read the two newest closes with `ROW_NUMBER() … ORDER BY price_date DESC` and **no lower date bound**, so a quote of any age was presented as today's | Both reads carry the shared staleness window (`BOUNDARY_LAG_DAYS`, `withLeadDays`); a quote outside it reports `unavailable` rather than being carried forward — `docs/time-series-contract.md` §2.1 | #20, #21 |
| 3 | Backend Unit — `backup/module-shape.spec.ts` | `support-backup/support-backup-rules.ts` was over the 800-line ceiling (811 on `main`, 835 on PR #20) | Rule vocabulary extracted to `support-backup-column-rules.ts`, securities/holdings group to `support-backup-securities-rules.ts`, both folded back into the same `RULES` map in the same order. **No grandfather entry added** | #20, #21 |
| 4 | Backend Integration — schema coverage guard | `goals`, `goal_transactions` and `transaction_rules` hold user rows but were in neither the export nor `INTENTIONALLY_EXCLUDED_TABLES`. The rules engine had written per-column rules and two JSONB handlers for a table it never exported | All three now travel: export query, `RESTORE_PLAN` step in FK-safe order, FK-ordered teardown `DELETE`, and `REFS` entries for their foreign keys | #20 (`+ goals`), #21 (`transaction_rules`) |
| 5 | Backend Integration — golden allowlist | Nine exported columns had no classification: `categories.budget_bucket`, `budget_categories.budget_bucket`, `transactions.{import_hash, source_transaction_id, payment_method, upi_vpa, upi_reference}`, `investment_transactions.{import_hash, source_transaction_id}` | Classified with reasons: `budget_bucket` and `payment_method` are enums (`keep`); the import hash is a fingerprint of dropped content and the source id / VPA / reference are external identifiers that name the account or the person (`drop`), the same call as `accounts.account_number` | #20, #21 |
| 6 | Backend Integration — `action_history` foreign key | `ActionHistoryService.record` is never awaited by its ~40 callers (by design: an audit entry must not delay the write it describes). A write started by one test landed after the suite's `TRUNCATE … users CASCADE`, failing its `user_id` foreign key | Tracked the way price writes already are (`settlePendingActionHistoryWrites`), drained by `cleanTables` and by the backup-restore suite's own truncate. Regression test fails without the tracking (verified by mutation) | #20, #21 |
| 7 | Bearer Security Scan | Two CWE-208 findings on the 23505 duplicate-import branch, where a caught Postgres constraint name (`err.constraint`) is compared against a literal. Nothing secret is on either side | The repository's existing per-fingerprint exception list, with the reasoning and a review-by date, matching the `.mny` error-code entry beside it. Bearer not disabled; no directory or finding class suppressed | #20, #21 |
| 8 | Schema vs Migrations Drift | `schema.sql` declared the `budget_bucket` CHECK constraints **inline**, so Postgres auto-named them. The migration's `IF NOT EXISTS (conname = 'chk_…')` guard therefore passed and added a **second**, explicitly named constraint on every replay | Named the constraints in `schema.sql` to match the migration, the form the replay convention treats as authoritative. No constraint dropped or weakened; `scripts/verify-schema.sh` green | #21 |
| 9 | Frontend Unit Tests | Four suites still expected pre-rebrand copy (`alt="Monize"` in `AuthShell` and the three password pages, while the shell renders `alt="Artha"`); `SmsIntakeStep.test.tsx` imported `render` from RTL and mocked `next-intl` to return keys; `cache-prefix-classification.guard` found `rules:` unclassified and `rulesApi.apply` invalidating a non-existent `transactions:` family | Tests updated to the intended **Artha** branding (production copy untouched); the SMS test converted to the shared `@/test/render` harness with its partial mock deleted; `rules:` classified as reference data and `apply` routed through `invalidateBalanceCaches()` | #21 |
| 10 | Frontend Unit Tests — restore labels | `restore-labels.contract.test.ts` proves the restore dialog labels every count key the backend plan reports. The new plan entries would have reached the user as raw camelCase | Added the labels | #20, #21 |
| 11 | E2E — register locator | `transactions.spec.ts` identified a created transaction by its amount across every `tr`. The register now renders a **day-group header row** carrying that day's total, so a lone transaction's amount is on two rows: a strict-mode violation | A shared `registerRow` helper excludes the day-group headers. Deliberately **not** `.first()`, which would match the header and let the assertion pass without the transaction row existing | #20, #21 |
| 12 | E2E — unregistered i18n namespace | `messages.ts`'s `NAMESPACES` is hand-maintained and `rules` (PR #19's engine) and `goals` were never added, so the app never loads them and `/rules` and `/goals` render `rules.pageTitle` / `rules.createNewRule`. Invisible to unit tests, whose harness globs `messages/en/*.json` from the filesystem and bypasses the list | `rules` and `goals` registered | #20 (`rules`, `goals`), #21 (`rules`) |
| 13 | E2E — SMS intake never worked | The frontend and the API disagreed about three things, all silent because the component's unit test mocked the API with the shape the component expected: the response bodies (`candidate` with `bankName`/`payee`/`paymentMethod`/`accountMask`/`upiReference` and lowercase `parsed`/`skipped`, versus a flat `parsedTransaction` with `detectedBank`/`paymentRail`/`upiRefNumber` and uppercase `PARSED`/`IMPORTED`); the sender field (`sender`, versus `senderHeader`, which `forbidNonWhitelisted` rejected with a 400); and `getKnownSenders`'s response type. Every parse looked like a failure and no candidate card ever rendered | Types are now the DTOs verbatim and the component reads them directly — no adapter naming each field twice. The unit test mocks the real payloads, so the next drift fails a unit test. The three E2E specs written against the imagined contract now drive the real UI and assert what it does | #21 |
| 14 | E2E — watchlists spec locators | An empty watchlist renders "Add Security" twice (header action and empty state, same copy), a strict-mode violation; and the add-security modal's row is a flex container whose symbol text block and Add button are siblings, so scoping by `hasText` and taking `.last()` landed on the text column with no button | Locate the first of the two identical controls; locate the Add button directly (the search is a symbol the test invents, so exactly one matches) | #21 |

---

## How the branch coordination was handled

PR #20 and PR #21 both branched from `d98886c13` and were independent of each other.

The shared repairs (items 1–7, 11) were applied to both branches **as the same change**, so a sequential merge could not re-apply them differently. Branch-specific parts differ only where the branches differ: PR #20 also exports `goals`/`goal_transactions` and registers the `goals` namespace; the SMS intake repair (13) and the watchlists locators (14) are PR #21's alone.

Merging PR #20 first required merging `main` back into PR #21 to clear five conflicts, all the same shape — the four *table inventory* conflicts (`restore-plan.ts`, `export-table-queries.ts`, `backup-restore-database.service.ts`, `restore-labels.ts`) resolved to `main`'s side, because post-merge the branch has the goals tables and needs their entries; `transactions.spec.ts` resolved to the branch's side, which is the same fix plus its own additions. One auto-merge artefact was fixed by hand: `BudgetBucketSummary.tsx` ended up with the same import twice. The resolved tree was verified before pushing.

---

## Validation Summary

| Gate | Command | Result |
|---|---|---|
| Backend typecheck / build | `npm run typecheck`, `npm run build` | **Clean** — both branches and the merged tree |
| Backend unit tests | `npx jest` | **Clean apart from pre-existing macOS-only failures**, reproduced identically on a pristine `main` worktree |
| Backend integration tests | `jest --config test/jest-e2e.json` | **42/43 suites.** The one failure, `attachment-late-write.integration.spec.ts`, fails identically on pristine `main` — a clock-skew artefact of this machine. Both previously-failing suites pass, on both branches and on the merged tree |
| Frontend typecheck / lint / i18n | `npm run type-check`, `npm run lint`, `npm run i18n:check` | **Clean** (lint exits 0 with one pre-existing warning in `public/sw.js`) |
| Frontend unit tests | `npx vitest run` | Affected suites green locally (836 tests across 55 files on the merged tree, incl. ui-conventions, e2e-conventions and the goals page); the full suite is confirmed by CI |
| **E2E** | `npx playwright test` against a local `docker-compose.e2e.yml` stack | **rules, transactions, sms-intake (13) and watchlists (4) all pass** — every spec this mission changed |
| Schema replay parity | `scripts/verify-schema.sh` | **OK: every retained migration is a no-op when replayed on top of schema.sql** |
| Bearer exception review | `node scripts/check-bearer-exceptions.mjs` | **OK: no exceptions stale or due** |

---

## GitHub Actions — final state

**Both PRs green.** PR #20: every check. PR #21: 23 checks, every one green, including the four E2E shards that had not run for weeks.

One recurring flake, untouched by this mission: the push-notification suite in E2E shard 1 (`e2e/push/notifications.spec.ts`, `retries: 0` there) asserts a service-worker notification within Playwright's default 5 s poll. It failed on shard 1 twice across these runs and passed on re-run both times, with no code change. Worth a follow-up hardening of that poll budget.

---

## Financial safety

No ledger, transfer, VOID, investment cash-leg, cost-basis, realized-gain, valuation, FX, TWR, CAGR or XIRR semantics were touched. No floating-point money arithmetic, shadow ledger, or duplicate engine was introduced. The only money-adjacent change is the watchlist quote read gaining the staleness bound the time-series contract already required — a *narrowing* of what may be presented as a current price, not a change to how any figure is computed.

---

## Commits / PRs

| Ref | Type | Description | State |
|---|---|---|---|
| `d98886c13` | Merge commit | Merge PR #19 — the baseline this mission started from (itself red) | Merged |
| `b66931750` | Commit | Final repair commit on `fm/artha-goals-01` | Merged |
| `a6344a1b1` | Merge commit | **Merge PR #20** (`fm/artha-goals-01` → `main`) | Merged |
| `0823c661e` | Commit | Final repair commit on `fm/artha-product-ux-01` (watchlists E2E locators) | Merged |
| `9df296b58` | Merge commit | **Merge PR #21** (`fm/artha-product-ux-01` → `main`) — current `main` | Merged |
| **PR #5** | Rolling Status PR | `Artha mission status` (`fm/artha-mission-status` → `main`) | **OPEN — 1 file** |

---

## Next Steps

1. **Merged and synchronized.** PR #20 and PR #21 are on `main` at `9df296b58`; both were green before merging.
2. **Next mission (unchanged, not started):**

   > **Mission 1 — Complete Initial Artha / Monize Productization & Foundation Integration**

   No other mission was started. Fintrack, Finsight, India features, tax, Account Aggregator, new AI/MCP, investment analytics and unrelated refactors were explicitly out of scope for this repair and remain untouched.
