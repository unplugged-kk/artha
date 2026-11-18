# Personal beta execution record

## 2026-11-17 baseline resume

Date and operator timezone: 2026-11-17 18:45 IST (Asia/Kolkata).
Step and status: 0 running; A1 pending; A2-A5, B1-B4, C and D pending.
Checkout / branch / SHA / local changes preserved: `/Users/kishore/git/artha`, `release/personal-beta-2026-11-22`, `1edce9d6214bf32fd25d41a151ec49ba80d0b643`. Created release branch from main without resetting, stashing or committing owner work. Preserved modified `.claude/settings.json`, `backend/src/import/xlsx-sheet-reader.util.ts`, `backend/src/import/xlsx-sheet-reader.util.spec.ts`; preserved untracked `AGENTS.md`, `docs/release/artha-agent-runbook.md`, `docs/release/artha-weekend-release.md`. This execution record is newly added.
Disposable environment ID or candidate image digest: planned project `artha-weekend-e2e`, database hostname `postgres`, database name `artha` within that project's isolated network. No database or browser suite run yet. Integration database `artha_test` not provisioned. No candidate digests established.
Command or user action: `git status --short --branch`, `git rev-parse HEAD`, reader diff inspection, `git show origin/main:docs/release/personal-beta-gap-register.md`, runtime and Docker checks; background job `artha-beta-baseline` runs separate workspace `npm ci` commands and then `TZ=UTC npm run test:unit -- --runInBand src/import/xlsx-sheet-reader.util.spec.ts` in backend.
Expected / observed: checkout matches planning SHA. Reader edits retain numbered-placeholder skipping and TOTAL footer termination for the recognized tracker layout, with regression case. No new execution record found; older baseline is dated November 14 and is not current verification. Node v24.22.1, npm 11.19.1, Compose 5.5.1, Docker server 29.6.1; Node 24 matches CI and Dockerfiles. Disk reports 612 GiB available. No listeners on 3000/3001 and no running Docker containers observed. Private input directory exists; workbook bytes were not opened, copied or uploaded. Dependency installation and current reader result remain pending.
Evidence path (synthetic or private, no secrets): `/private/tmp/artha-beta-synthetic-evidence/` holds workspace install logs and reader-suite log, once generated. Prior gap register inspected, not accepted as fresh runtime evidence.
Blocker and owner: final deployment, real posting, secret store, off-host backup and physical-device acceptance require owner involvement. Independent import/recovery agent assignment pending: available agent types do not match the models required by the installed subagent policy; no incompatible agent launched. Main agent owns baseline and A1. No production configuration changed.
Single next action: observe baseline job exit and reader result, then prepare loopback-only disposable Compose override and reproduce A1 using a locally generated synthetic XLSX.

## 2026-11-17 dependency and reader result

Date and operator timezone: 2026-11-17 IST (Asia/Kolkata).
Step and status: 0 workspace installs and reader suite passed; disposable database readiness pending; A1 preparation running.
Checkout / branch / SHA / local changes preserved: same release branch and SHA as above; owner changes unchanged, no lockfile changes reported by git status.
Disposable environment ID or candidate image digest: `artha-weekend-e2e`, hostname `postgres`, port 5432, database `artha`, no published database port. Startup in progress, not readiness evidence. This is a development-image reproduction, not production-image acceptance.
Command or user action: three workspace `npm ci` commands; reader suite; `npx playwright install chromium`; ExcelJS generation of synthetic A1 workbook; Compose `up -d --build --wait` with local loopback override, followed by `/api/v1/health/ready` probe.
Expected / observed: baseline job exit 0. Reader: 1 suite, 12 tests passed, 4.963 seconds. All lockfiles use version 3; root package engines unspecified. Chromium was absent and installation exited 0. Synthetic workbook has header row 4, a numbered placeholder, four populated source rows and TOTAL EXPENSES footer; generation checks gross 280, expenses 240, bank close 760. These are fixture controls, not observed postings.
Evidence path (synthetic or private, no secrets): `/private/tmp/artha-beta-synthetic-evidence/reader-suite.log`, workspace `*-npm-ci.log`, `chromium-install.log`, `a1-mixed-accounts.xlsx`, `compose.loopback.yml`, `stack-start.log`.
Blocker and owner: stack build/readiness pending under background job `artha-beta-stack`; no browser reproduction yet.
Single next action: inspect startup exit and readiness, then exercise the current wizard with the synthetic workbook and compare persisted register results.

## 2026-11-17 disposable readiness and browser blocker

Date and operator timezone: 2026-11-17 IST (Asia/Kolkata).
Step and status: 0 passed for local prerequisites and reader checks; A1 owner-blocked before UI interaction.
Checkout / branch / SHA / local changes preserved: same release branch and SHA as above; owner source changes preserved.
Disposable environment ID or candidate image digest: `artha-weekend-e2e`, database `postgres:5432/artha` on the isolated Compose network; app ports bound to loopback by override.
Command or user action: Compose startup and readiness probe completed; `agent-browser --version` attempted before browser use.
Expected / observed: stack job exit 0 and `/api/v1/health/ready` returned `{"status":"ok"}`. Required browser automation CLI returned `agent-browser: command not found` (exit 127). Playwright Chromium installation succeeded earlier, but that does not install this CLI. No users registered or workbook submitted yet.
Evidence path (synthetic or private, no secrets): `/private/tmp/artha-beta-synthetic-evidence/stack-start.log`; background monitor `artha-beta-stack` retains readiness response and exit code.
Blocker and owner: installed browser skill requires asking the owner to install missing `agent-browser` rather than substituting another automation tool. Stack readiness is not an A1 pass.
Single next action: owner installs `npm i -g agent-browser && agent-browser install`; then resume the synthetic wizard reproduction.

## 2026-11-17 A1 reproduction

Date and operator timezone: 2026-11-17 19:10 IST (Asia/Kolkata).
Step and status: A1 passed as a reproduction (defect confirmed); A2 pending.
Checkout / branch / SHA / local changes preserved: `release/personal-beta-2026-11-22` at `1edce9d62`; owner reader edits included in the stack build and preserved.
Disposable environment ID or candidate image digest: `artha-weekend-e2e` development images, database `postgres:5432/artha` on the isolated network, app on loopback. Use `BASE_URL=http://localhost:3001`; `127.0.0.1` hangs on "Loading Artha" because `PUBLIC_APP_URL`/CORS name `localhost`.
Command or user action: `cd e2e && BASE_URL=http://localhost:3001 npx playwright test --config playwright.local.config.ts tests/import-xlsx-mixed-accounts.spec.ts --retries=0`. The `agent-browser` CLI is still not installed; the repo's Playwright harness was used, as the runbook requires for A5. The spec seeds INR Test Bank (opening 1000) and Test Card (credit card, 0), uploads the synthetic workbook, and takes the best path available today: sheet Transactions, auto-detected header row 4, sign Reverse (positive = withdrawal), payee transfer rule "Card payment" -> Test Card, destination Test Bank, transfer mapping accepted.
Expected / observed: the sheet picker shows the four data rows and placeholder #2 (later dropped), and excludes the TOTAL footer. Review shows 4 transactions and one target account. Completion reports Imported 4, Errors 0. Expected bank 760, card 0. Observed bank 720, card +40 in two runs. Cause: the mapping step has no source/account column and the commit carries one `selectedAccountId` per file (`useImportWizard.ts`), so Test Card's Fuel posts to the bank. The transfer leg posts correctly as linked -40/+40. Additional observations: (1) the default sign is As-is (positive = deposit), so a positive expense tracker increases balances unless the user reverses it; (2) Payee auto-maps to Description, so payees became "Groceries"/"Fuel" and the Payee column was ignored; (3) categories stay NULL, so October 100 / November 140 spending cannot appear by category; (4) the Map Transfer Accounts copy says "your QIF file" for an XLSX upload. The success screen gives no sign that balances are wrong. This confirms Appendix C.
Evidence path (synthetic or private, no secrets): `/private/tmp/artha-beta-synthetic-evidence/a1-01..04*.png`; failing regression spec `e2e/tests/import-xlsx-mixed-accounts.spec.ts` (red by design until A2/A3 land).
Blocker and owner: none for A2. Import track: main agent. Recovery track (B) not yet started; no compatible subagent was launched (installed policy).
Single next action: A2. Add a source-column mapping (label -> owned account, once per distinct label, with per-row override) to the existing CSV/XLSX column mapping and carry the per-row account through preview and the import DTO. Keep the single-account CSV path unchanged.

## 2026-11-17 A2/A3/A5 mixed-account import

Date and operator timezone: 2026-11-17 20:00 IST (Asia/Kolkata).
Step and status: A2 passed (synthetic). A3 passed for atomic batch, ownership and retry convergence; changed/remapped-row detection still pending. A5 passed for unit, PostgreSQL integration and browser layers (synthetic). A4 pending.
Checkout / branch / SHA / local changes preserved: `release/personal-beta-2026-11-22` on `1edce9d62` plus uncommitted work below; owner reader fix retained unchanged.
Disposable environment ID or candidate image digest: integration DB container `artha-beta-itest-pg`, `localhost:55433/artha_test`, user `artha_test`. Browser: `artha-weekend-e2e` development images rebuilt from the working tree, app on loopback. No candidate digest yet.
Command or user action: backend `TZ=UTC npx jest src/import` (1916 passed); `npx jest --config ./test/jest-e2e.json --runInBand --testPathPatterns=import-source-accounts` (8 passed, repeated 5x); frontend `npx vitest run src/components/import src/hooks src/test src/app/import src/lib/import.test.ts`; `cd e2e && BASE_URL=http://localhost:3001 npx playwright test --config playwright.local.config.ts tests/import-xlsx-mixed-accounts.spec.ts --retries=0` (1 passed).
Expected / observed: what changed: a CSV/XLSX `sourceAccountColumn` (auto-matched from a "Source" header) routes each row by its label. A new "Match sources to accounts" step maps each distinct label once (exact-name prefill, blank labels shown as "(no source)", explicit "Skip these rows"), and Next stays disabled until every label is resolved. The source-aware review shows per-account balance change, every row with signed amount, source, transfer counterparty and a per-row "Post to" override, plus unreadable rows with reasons and an explicit "leave out" checkbox. Import stays blocked until they are resolved. On the server (`ImportService.importCsvBySourceAccount`): nothing is written while any row is unresolved or unreadable. All accounts are written inside one `withScopedDb` transaction, and any row failure rolls back every account. Ownership is checked per account inside that transaction, and post-processing runs after commit. Results: A1 bank 760 and card 0 with 5 postings for 4 source rows (transfer = linked -40/+40). The review showed Test Bank -240.00 and Test Card 0.00 before writing. Immediate and renamed-file retries imported 0 with balances unchanged; three concurrent submissions converged to 760/0 and 5 postings across 25 stress iterations. Invalid last row: rejected with no write; with explicit skip, imported and reported. A foreign-tenant account in the second group rolled back the first group (bank stays 1000). Two identical purchases were kept as two postings. Skip and per-row override were honoured. Also fixed: Payee now auto-maps to a Payee column before Description; the "your QIF file" copy on transfer mapping is now neutral. Single-account CSV path unchanged (existing import suites green).
Evidence path (synthetic or private, no secrets): `backend/test/integration/import-source-accounts.integration.spec.ts`, `frontend/src/components/import/SourceRouting.test.tsx`, `e2e/tests/import-xlsx-mixed-accounts.spec.ts` (XLSX generated by `e2e/helpers/xlsx-fixture.ts`, self-checked against the production reader; no new dependency). Screenshot `e2e/test-results/import-xlsx-mixed-review.png` (synthetic).
Blocker and owner: none. Remaining A work: A3 changed or remapped source-row detection (a row whose amount or mapped account changed since a prior import currently imports as new). A4 auxiliary-sheet status. Category/payment-mode/tag columns use the existing mappings and are not yet exercised with the tracker layout. October/November spending split not yet asserted through budgets.
Single next action: A3 overlap review, a dry-run check that flags rows matching existing register entries (same date and amount, other account or changed payee) before commit.

Test harness note: post-import processing fires `NetWorthService.recalculateAccount` without awaiting it. Left running, it deadlocked the next test's `TRUNCATE` once in about 25 runs. The new suite stubs it, and the comment records why.

## 2026-11-17 B3 restore counts (BR-3)

Date and operator timezone: 2026-11-17 20:00 IST.
Step and status: B3 passed for counts, unexplained omissions, rollback, truncated archive and wrong password (synthetic). Interrupted restore covered by the injected-conflict rollback case; a process kill mid-restore is not yet exercised. B1/B2/B4 running.
Checkout / branch / SHA / local changes preserved: as above.
Disposable environment ID: `artha-beta-itest-pg` (`localhost:55433/artha_test`).
Command or user action: added failing cases first. Then `npx jest --config ./test/jest-e2e.json --runInBand --testPathPatterns=backup-restore.integration`. Before the fix, the duplicated-row archive restored successfully ("Received promise resolved instead of rejected").
Expected / observed: `insertRows` now uses `ON CONFLICT DO NOTHING RETURNING 1` and counts only written rows. A declined row fails the restore unless its table is in `PRESERVED_ON_RESTORE` (legitimate reuse, e.g. `payee_lookup_usage`). The restore transaction rolls back and the destination's prior accounts, transactions and balances are byte-identical afterwards. Reported counts now equal `COUNT(*)` per table. The full suite passed 20/20, including the existing round trip, custom currency, scan pair and encrypted cases. Unit mocks were updated to return the written marker (`backup.service.spec.ts`, `notification-restore-bounds.spec.ts`, `retired-notification-preference.spec.ts`).
Evidence path: `backend/test/integration/backup-restore.integration.spec.ts` (describe "restored counts are rows actually written").
Blocker and owner: none.
Single next action: B1/B2. Bring up stacks A and B from the production images with distinct volumes, ports and secrets; seed the manifest; export; restore into B.

Unrelated findings fixed along the way: a prettier error in `backend/src/backup/auto-backup.service.spec.ts` (lint red) and an unused catch binding in `frontend/public/sw.js`. Found but not fixed: on macOS, `auto-backup.service.spec.ts` fails 5 cases when `TMPDIR` sits under the `/var -> /private/var` symlink, and passes 130/130 with `TMPDIR=/private/tmp/`. `validateFolder` resolves the folder but not the configured root, so a symlinked `BACKUP_ALLOWED_ROOTS` would wrongly reject a folder inside it. CI (Linux) is unaffected.

## 2026-11-17 A3 overlap review

Step and status: A3 passed (synthetic). The remaining A3 item, changed/remapped-row detection, is closed.
Command or user action: integration suite `import-source-accounts` 11/11; frontend `SourceRouting.test.tsx` 6/6; browser suite `import.spec.ts`, `import-xlsx-mixed-accounts.spec.ts`, `reconciliation.spec.ts`, `backup.spec.ts` on the rebuilt E2E stack: 13 passed, 0 failed (after fixing a stale `accept` assertion that predates this work).
Expected / observed: an unchanged re-import reports no overlaps. A row remapped to another account (first import posted card fuel to the bank) and a row whose amount changed (100 -> 110) are both listed with the existing entry, and the import is blocked until each is kept or skipped. The commit re-checks inside its transaction and answers 409 with the balances unchanged. A pending or failed check blocks the import, so it is never read as "no overlaps".
Phone-width (390px viewport emulation, not a device): no page-level horizontal overflow. The row table sat behind a sideways scroll that hid Amount and Post to, so the review now renders one card per row on phones (`useIsMobile`). Re-verified after the rebuild: overflow 0, and each card shows payee, row, date, source, amount and its Post to picker. The A1 desktop spec still passes. Evidence: `/private/tmp/artha-beta-synthetic-evidence/a-mobile-review-390-cards.png` (synthetic).

## 2026-11-17 B1/B2/B4 host-loss rehearsal

Step and status: B1 passed with owner-blocked items. B2 passed (synthetic). B4 passed (synthetic, same Mac). B3 passed.
Checkout / SHA: images from a clean `git archive` of `c376afeb3`; recovery-relevant code is unchanged since.
Disposable environment ID or candidate image digest: backend `sha256:51111cefd1c7644587a47eb54408a44f5ac107b2c6ea043723877e176cb1dba4`, frontend `sha256:0e73028a7af22a0356d3ac7cfe7fc2db7ed36eab40b0c8f49cf9e6fa07319939`, `postgres@sha256:81e77a4833487b8132fe4b00bedd39dc3f74b8641e387f19312a48f7de218c2e`. Compose projects `artha-beta-a` (127.0.0.1:3101), `artha-beta-b` (3201) and `artha-beta-r` (3301, rollback target), each with its own volume, network and fresh secrets. Private config is in `/private/tmp/artha-beta-b/`; mounts are in `~/.local/share/artha-beta-rehearsal/`.
Command or user action: `scripts/beta-recovery-rehearsal.mjs` seed, manifest, isolation, export, restore and compare; full commands in `docs/release/backup-restore-rehearsal.md`.
Expected / observed: all rows VERIFIED except BR-5 messaging. Summary: from stopping A to a restored owner on B took 55 s. After a restart and fresh login, the manifest was identical: balances in minor units, postings by business key, statuses, transfer links, monthly category sums, budget and receipt SHA-256. The same held under `RLS_MODE=enforce`, where the runtime role was verified and tenant isolation held. Registration closed (403). The service user writes both mounts on a `/Users` path. The rollback target started from snapshot plus pinned images in 50 s with an identical manifest.
Evidence path: `docs/release/backup-restore-rehearsal.md` (results table). Manifests and artifacts are kept privately under `/private/tmp/artha-beta-b/` (synthetic).
Blocker and owner: (1) a real off-host location and who holds the backup password: owner. (2) Linux host bind-mount ownership (RT-2) is unverified; on Docker Desktop a `/private/tmp` mount silently lands VM-local and is not writable. (3) Private HTTPS/TLS termination is not configured: owner/host decision. (4) BR-5: a truncated encrypted file is reported as a wrong password.
Single next action: C. Run the full repository gates on the candidate SHA, rebuild the candidate images and repeat the A1 browser case against the production-image stack.

## Safety boundaries

- Keep personal workbook bytes, private screenshots, secrets and backups outside Git and build contexts.
- Use only synthetic data until money, tenant isolation and recovery gates pass.
- The checked-in E2E compose publishes on all interfaces by default. Supply a loopback-only override before starting it locally.
- Do not run integration suites concurrently or against daily-use data.
- No passed release gate, deployment approval or workbook-replacement claim is recorded here.
