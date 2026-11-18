# Artha personal beta release plan

Target Sunday, 22 November 2026. Use one private installation for daily entries, a reviewed November import and recovery from a lost host. Saturday is the dress rehearsal. Keep original workbooks on the owner's machine. Artha holds canonical PostgreSQL records. Disconnected phone entry remains a separate Pocket Ledger workflow. If disconnected editing is required for cutover, keep Excel/Pocket Ledger as the system of record this weekend.

## How to read this

One box is one unit of work. Each box names the evidence. Check a box only when its evidence exists. Use the installed poteto-mode `playbooks/autopilot-stack.md`. The operator owns merge and deployment. Suggested roles below can be held by the same engineer.
Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] Tue 17 Nov. Capture the starting SHA, current CI, available host/disk, ownership of the two local importer edits and the exact build images. Compare `git show origin/main:docs/release/personal-beta-gap-register.md` with current code before opening defects.
- [ ] Record a safe source for rollback, encrypted off-host backup storage and who holds the restore credentials. Rehearse with synthetic records before bringing in personal data.
- [ ] Throughput checkpoint on Thu evening. If a reviewed ledger and recovery rehearsal both lack an owner or runnable test, freeze additional features. During execution use an hourly audit equivalent to `/loop 1h`. Send a status message on a changed blocker or passed gate.

### Spawn owners

- [ ] Start A (import engineer) and B (runtime/recovery engineer) independently on Wednesday. Start C (release owner) on synthetic fixtures immediately. Its final checks depend on A and B.
- [ ] Friday 20 Nov is feature freeze. Saturday 21 Nov is private UAT on the intended desktop and phone. Sunday 22 Nov is an operator decision based on receipts.

### PR mechanics

- [ ] Preserve the existing working-tree fix and its test in A. Stage only reviewed source and synthetic fixtures. Keep raw workbooks, database dumps, encrypted backups, screenshots with real details and credentials outside Git.
- [ ] Run lint, typecheck, unit suites, affected PostgreSQL integration tests, production builds and CI on the candidate SHA. Record commands, exit codes and image digests.

### Verdict and merge

- [ ] Review the mobile import and daily-entry flows with synthetic screenshots. Resolve each critical discrepancy or keep the release on synthetic data. Operator merges verified heads bottom-up.

### Boot recipe

- [ ] Use two isolated production-like Compose projects with distinct database volumes, attachment directories, networks and ports. Bind privately. Start one backend replica per stack. Check database readiness before opening the UI. Use local Playwright and synthetic receipts for CI. Use real files only on the owner's trusted machine.

## Import November into the right accounts (A)

**Depends on.** None.

**Files.**

- [ ] Record the changed paths under backend/src/import, frontend/src/hooks/useImportWizard.ts, frontend/src/components/import, e2e/tests/import.spec.ts.

**Build.**

- [ ] Reuse the sheet reader and CSV pipeline. Add a tracker preview with source-to-account mappings and an explicit expense, income, transfer or investment choice. Resolve ambiguous wallet combinations manually. Identify workbook rows across retries and filename changes, flag revised rows and require review of overlap. Commit the accepted batch atomically. Show other sheets and their migration status. Offer a manual Categories budget checklist and investment-plan comparison if full-sheet migration misses freeze.

**You see.**

- [ ] The raw total is ₹172,411 across 36 rows. Register changes agree with reviewed signs and accounts. Compare calendar months separately. Show ₹202,091 planned, ₹99,988 actual and ₹102,103 shortfall as workbook reference values unless the corresponding plans are persisted. A checked row with no actual payment creates no transaction.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Run the existing sheet-reader Jest suite plus synthetic mixed-account, partial row, duplicate and rollback cases. Exercise the XLSX wizard through Playwright against PostgreSQL.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `swarm workers` at the PR head.

- [ ] Lane 1. Regression lane against trunk. Run trunk and head. Save `lane-A-1.png`. Pass when november has 36 accepted rows.
- [ ] Lane 2. Save `lane-A-2.png`. Pass when all chosen accounts match the source mapping.
- [ ] Lane 3. Save `lane-A-3.png`. Pass when positive expense decreases the account balance.
- [ ] Lane 4. Save `lane-A-4.png`. Pass when card repayment moves value between owned accounts once.
- [ ] Lane 5. Save `lane-A-5.png`. Pass when repeat import changes zero balances.
- [ ] Lane 6. Save `lane-A-6.png`. Pass when renamed duplicate requires review or is skipped.
- [ ] Lane 7. Save `lane-A-7.png`. Pass when skipped ambiguous row stays outside register.
- [ ] Lane 8. Save `lane-A-8.png`. Pass when rejected batch leaves all account balances unchanged.
- [ ] Lane 9. Save `lane-A-9.png`. Pass when checked blank actual creates no payment.
- [ ] Lane 10. Save `lane-A-10.png`. Pass when october entries appear in October budget actuals.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Select the same workbook and measure time to preview.
- [ ] Probe. Alternate three trunk and candidate runs on the same machine and fixture.
- [ ] Baseline. Record trunk first. Identify any operation available only on the candidate.
- [ ] Rule. Proposed target is 5 seconds for the November preview on the target host. Investigate a missed target before cutover.

**Review gate.** Operator reviews the daily interaction.

- [ ] Share a synthetic screenshot and short video with the operator before merge.

**Merge.**

- [ ] Record the verified SHA and operator disposition.

## Recover the private installation (B)

**Depends on.** None.

**Files.**

- [ ] Record the changed paths under docker-compose.prod.yml, backend/src/backup, backend/test, docs/release/backup-restore-rehearsal.md.

**Build.**

- [ ] Pin tested image digests, configure private HTTPS, fresh secrets, explicit row-level security mode and writable mounts. Verify actual inserted counts and dependent links. Add a two-database restore rehearsal. Include an encrypted external copy and exact rollback steps for schema changes.

**You see.**

- [ ] A second empty deployment opens the restored account and matches a recorded manifest of counts, paise totals, balances, relations and attachment hashes.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Run the backup-restore PostgreSQL integration suite and failure cases. Exercise RLS in enforce mode with two test identities.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `swarm workers` at the PR head.

- [ ] Lane 1. Regression lane against trunk. Run trunk and head. Save `lane-B-1.png`. Pass when clean install reaches DB-backed readiness.
- [ ] Lane 2. Save `lane-B-2.png`. Pass when service user writes both mounted directories.
- [ ] Lane 3. Save `lane-B-3.png`. Pass when other user sees none of the seeded records.
- [ ] Lane 4. Save `lane-B-4.png`. Pass when scheduled backup produces encrypted output.
- [ ] Lane 5. Save `lane-B-5.png`. Pass when a wrong password leaves destination unchanged.
- [ ] Lane 6. Save `lane-B-6.png`. Pass when interrupted restore preserves the previous state.
- [ ] Lane 7. Save `lane-B-7.png`. Pass when fresh database matches the signed-off manifest.
- [ ] Lane 8. Save `lane-B-8.png`. Pass when attachment hashes match after restart.
- [ ] Lane 9. Save `lane-B-9.png`. Pass when replayed restore preserves balances and row counts.
- [ ] Lane 10. Save `lane-B-10.png`. Pass when previous pinned image and compatible database snapshot start together.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Restore the same seeded encrypted backup into a fresh database and time until ready.
- [ ] Probe. Alternate three trunk and candidate runs on the same machine and fixture.
- [ ] Baseline. Record trunk first. Identify any operation available only on the candidate.
- [ ] Rule. Proposed target is 15 minutes for the personal fixture restore including restart. Investigate a missed target before cutover.

**Review gate.** None. B changes deployment and recovery checks.

**Merge.**

- [ ] Record the verified SHA and operator disposition.

## Run the daily workflow and decide cutover (C)

**Depends on.** A and B at candidate heads.

**Files.**

- [ ] Record the changed paths under e2e/tests, docs/release, existing register, budgets and reconciliation screens where a blocking failure is reproduced.

**Build.**

- [ ] Add a production-image acceptance run from account setup to import, manual edit, review, reconciliation, export, restart and recovery. Include phone-width keyboards, horizontal overflow and unsaved edits after a network interruption. Suppress or flag incomplete valuation in any dashboard total used for decisions. Freeze the release candidate after fixes.

**You see.**

- [ ] The owner can explain a monthly expense, trace it to its account, correct it, reconcile it, export it and find it again after restart.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Run the affected frontend suites and the production-image Playwright smoke. Compare exported rows and category amounts with an independently calculated fixture.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `swarm workers` at the PR head.

- [ ] Lane 1. Regression lane against trunk. Run trunk and head. Save `lane-C-1.png`. Pass when desktop completes setup through first expense.
- [ ] Lane 2. Save `lane-C-2.png`. Pass when android can enter and edit an expense.
- [ ] Lane 3. Save `lane-C-3.png`. Pass when iPhone can select a workbook and inspect preview.
- [ ] Lane 4. Save `lane-C-4.png`. Pass when network loss never reports an unsaved entry as saved.
- [ ] Lane 5. Save `lane-C-5.png`. Pass when category budget reflects an edited expense.
- [ ] Lane 6. Save `lane-C-6.png`. Pass when reconciliation preserves the statement closing balance.
- [ ] Lane 7. Save `lane-C-7.png`. Pass when account export reopens with correct signed amounts.
- [ ] Lane 8. Save `lane-C-8.png`. Pass when missing market price is visible where it affects a total.
- [ ] Lane 9. Save `lane-C-9.png`. Pass when restart retains imported and manual entries.
- [ ] Lane 10. Save `lane-C-10.png`. Pass when restored private installation completes the same daily loop.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time manual save through visibility in the register on the same fixture.
- [ ] Probe. Alternate three trunk and candidate runs on the same machine and fixture.
- [ ] Baseline. Record trunk first. Identify any operation available only on the candidate.
- [ ] Rule. Proposed target is 2 seconds for save acknowledgement on the private LAN. Investigate a missed target before cutover.

**Review gate.** Operator reviews the daily interaction.

- [ ] Share a synthetic screenshot and short video with the operator before merge.

**Merge.**

- [ ] Record the verified SHA and operator disposition.

## Close the program

- [ ] Sunday go only after all money, isolation, restore and device gates pass on the pinned candidate. Operator authorizes deployment. Capture a pre-import backup, import once, reconcile the register and schedule a verified encrypted copy off the host.
- [ ] Stop on an unexplained monetary difference, failed restore or missing data isolation. Keep original files, hold writes, restore the last verified database and matching images, then compare balances before reopening.
- [ ] If plans or budgets still require manual migration, label that work outstanding. Continue those sheets in Excel. A beta for the daily ledger is a narrower outcome than retiring the workbook.

## Appendix A. Prototype evidence

Local Artha head was `1edce9d62`. The prior local test of the modified sheet reader returned 36 rows and ₹172,411. Its 12 tests, backend typecheck and build passed. Those changes remain uncommitted. A separate workbook check found 36 positive amounts and 13 nonblank source labels. October contributes ₹10,360 and November ₹162,051 before classification. Account posting, signs, mobile usability and recovery on the target host remain unproven. The documented recovery run used a second account in the same database.

## Appendix B. Alternatives rejected

A second finance database in the browser would create two ledgers with different recovery and reconciliation rules. Defer that decision. Defer native wrappers, PDF/OCR, market feeds, historical backfill and UI redesign. Keep existing categories, scheduled transactions, cards, reconciliation and CSV export. Put historical workbook adapters, editable monthly investment plans and portable multi-sheet Excel export in the next milestone if they miss the beta cutoff.

## Appendix C. Risks

The wizard currently sends a single selected account per file. Mixed sources and positive expense amounts can produce a numerically correct preview and incorrect balances. A owns signs and routing. Category budget conflicts need a visible owner choice. Investment executions, plan totals, balance snapshots and credit-card payments each need distinct treatment.
The current restore loop increments its count after INSERT ON CONFLICT DO NOTHING. Compare database rows by remapped ID and record allowed shared-row skips explicitly. On first boot bind privately, create the owner and close public registration. Use /api/v1/health/ready for the database check. B owns floating images, writable volumes, current CI and the actual restore result. Record fresh evidence for prior release findings. Keep personal workbook bytes and identifying artifacts local throughout testing. Keep optional external providers disabled where needed to meet the owner's privacy requirement. C owns physical device evidence and the go/no-go decision. The date is a target, not an assurance.

## Appendix D. Links and reading list

Use paths relative to Artha. Start with `docs/release/personal-beta-gap-register.md`, `docs/release/backup-restore-rehearsal.md`, `docs/deployment/README.md` and `docker-compose.prod.yml`. For A inspect `backend/src/import/xlsx-sheet-reader.util.ts`, `frontend/src/hooks/useImportWizard.ts` and `e2e/tests/import.spec.ts`. Keep the verification log under `docs/release/` with synthetic evidence only.
