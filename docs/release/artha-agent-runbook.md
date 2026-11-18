# Run the Artha personal beta release

**Assignment for the next agent.** Deliver a private Artha installation for one household by Sunday, 22 November 2026. Start with the first unchecked step below whose prerequisites pass. Finish each step with its evidence and update the execution record. Existing Artha is the product. Use its register, budgets, transfers, reconciliation, backup and import services. The owner approves the final live deployment and the first real posting.

Use this runbook for implementation. Use the adjacent artha-weekend-release.md for the release test matrix. No special agent plugins, paid services or access to prior chat are required.

## 0. Establish a safe baseline on Tuesday

1. Locate the Artha checkout. On the owner's Mac it is /Users/kishore/git/artha. Record the output below. The planning baseline was 1edce9d62. Two workbook-reader files already had local changes. If the checkout has advanced, inspect those changes against HEAD and retain equivalent behavior. Do not reset, stash or overwrite the owner's work.
2. Inspect backend/package.json, frontend/package.json, e2e/package.json, their lockfiles and the CI workflow for runtime versions. Install per workspace. There are separate test and build commands. Check Docker Compose, a disposable PostgreSQL instance, Chrome or Playwright Chromium, and free ports 3000 and 3001.
3. Keep original workbooks outside Git, build contexts, screenshots and CI. On this machine the input archive is in Downloads and the extracted workbook is under /private/tmp/finance-nov17/input. If the temporary directory disappeared, extract the archive to a newly created private directory. A remote agent uses a synthetic workbook and leaves the private replay to the local agent. Never send this workbook to a hosted Artha instance, CI or an external parser.
4. Use disposable database credentials and directories for all tests. Record database hostname and name before any integration or browser run. Artha's integration pretest can create artha_test. Its browser setup registers users. Never point these commands at daily-use data.

```sh
cd /Users/kishore/git/artha
git status --short --branch
git rev-parse HEAD
git diff -- backend/src/import/xlsx-sheet-reader.util{,.spec}.ts
node --version
docker compose version
(cd backend && npm ci && npm run test:unit -- --runInBand src/import/xlsx-sheet-reader.util.spec.ts)
(cd frontend && npm ci)
(cd e2e && npm ci)
```

**Exit evidence:** checkout SHA, tracked and untracked owner work, test database identity, and reader suite result. The prior reader test had 12 passing cases. Record today's actual result. Assign the import and recovery tracks independently.

## A. Make a mixed-account workbook safe to post, Wednesday through Friday

**A1. Reproduce through the current UI.** Generate a synthetic XLSX locally with ExcelJS. Use a Transactions sheet with header row 4, numbered rows, one numbered placeholder between valid rows and a TOTAL EXPENSES footer. Include these four data rows in INR. Start the bank at 1,000 and the card at zero. Assign the same synthetic payee to both bank purchases.

| Date | Source | Description | Amount | Review choice |
|---|---|---|---:|---|
| Oct 31 | Test Bank | Groceries | 100 | Expense |
| Nov 1 | Test Card | Fuel | 40 | Expense |
| Nov 2 | Test Bank | Card payment | 40 | Transfer to Test Card |
| Nov 3 | Test Bank | Groceries | 100 | Expense |

Run the existing wizard on a disposable stack. Record whether the preview and register can realize these results. Four source rows total 280. Expenses total 240. Bank closes at 760, card liability returns to zero, and the transfer contributes zero expense. October spending is 100 and November spending is 140. A transfer may produce two linked postings. Do not equate SQL posting count with source-row count.

**A2. Extend the existing preview.** Trace frontend/src/hooks/useImportWizard.ts from selectedAccountId through the import DTO, controller and backend/src/import/import.service.ts. Inspect the existing regular processor, transfer path and account ownership checks. Preserve the ordinary single-account bank CSV path. Detect the tracker by sheet and headers. Ask the user to map each distinct source label once, then allow a per-row override. Keep combined source labels, missing dates, unmapped accounts and uncertain investment or transfer classifications visible. Show original amount, proposed direction, both accounts for transfers and a reason for each rejected or skipped row. An unresolved row must be corrected or explicitly skipped.

**A3. Write one reviewed batch.** Keep source row, date, raw source label, immutable source identity, signed amount, target account, optional transfer account, category, payment mode, tag and disposition together through preview and commit. Validate user ownership for every account and type before writing. Reuse Artha's exact decimal conventions and import-identity.util.ts. Preserve legitimate identical purchases with distinct occurrence or source identifiers. Commit all accepted postings inside one database transaction. Concurrent retries must converge. A changed or remapped source row must surface for review. Never silently apply a replacement or convert a card payment into another expense.

**A4. Cover auxiliary sheets explicitly.** On the preview show each sheet as imported, reference only, skipped or unsupported. For Categories compare category budget against Insights and show discrepancies for an owner choice. Preserve the Investments distinction between planned, actual and checked. An empty actual stays empty even when checked. Savings and wallets are snapshots. They do not create income. If plan or budget persistence misses Friday freeze, leave those sheets active in Excel and state that boundary on the completion screen. Do not claim workbook replacement.

**A5. Verify in three layers.** Add synthetic reader/processor tests, a PostgreSQL integration test exercising the public import boundary, and an XLSX browser case beside e2e/tests/import.spec.ts. Assert unchanged balances on immediate retry, renamed-file retry, concurrent retry, and an invalid last row. Add a separate case for two truly identical purchases. Reopen the register after commit and compare each account against the A1 calculation. Do not accept preview-only evidence.

**Private acceptance:** replay November through a loopback-only stack with external providers disabled. Independently compare worksheet rows to a local reviewed mapping. Expect 36 populated positive rows, 13 nonblank source labels, gross ₹172,411, October gross ₹10,360 and November gross ₹162,051. Investment controls are ₹202,091 planned, ₹99,988 actual and ₹102,103 shortfall. Derive expected signed balances from approved mappings. Gross amounts alone cannot establish those balances. Record aggregate results privately. On a discrepancy save sheet/row references locally and stop posting.

## B. Prove the installation can be recovered, Wednesday through Friday

**B1. Prepare two independent installations.** Read docker-compose.prod.yml, docs/deployment/README.md and docs/release/backup-restore-rehearsal.md. Define stack A and recovery stack B with separate database volumes, host paths, ports, encryption configuration and networks. Use fresh secrets from an operator-managed secret store. Pin all images by digest, record the application SHA and migration state, use one backend replica, and bind privately. Test readiness through /api/v1/health/ready. Bootstrap the owner and disable new registration. Use synthetic accounts for a second tenant to test isolation.

**B2. Capture a manifest before export.** Include accounts and currencies, signed balances in minor units, monthly category sums, transfers and their links, reconciliation state, a budget, distinct duplicate-looking purchases, and a receipt attachment with a SHA-256 hash. Define stable business keys for comparison across remapped database IDs. Export an encrypted application backup. Keep a separate off-host copy and the required credentials. Also rehearse the database/volume snapshot required to roll back migrations on the same installation.

**B3. Fix misleading recovery evidence.** Inspect backend/src/backup/backup-restore-database.service.ts around ON CONFLICT DO NOTHING. Distinguish actual inserts, legitimate reuse of shared records and unexpected omissions. Add a failing fixture first. Compare restored links and balances after ID remapping. Fail a restore with an unexplained omission and prove rollback leaves the prior account intact. Extend backend/test/integration/backup-restore.integration.spec.ts. Verify an incorrect password, truncated backup and interrupted restore on disposable data.

**B4. Rehearse total host loss.** Stop A. Recover from the off-host copy into B using the documented bootstrap procedure. Log in after restart. Independently query the restored records, open the receipt and compare its bytes and the B2 manifest. Test tenant isolation using both accounts and the configured RLS enforcement mode. Prove the service process can write backups and attachments under its production UID. Time the rehearsal and record commands without secrets. A successful download or a green restore toast is insufficient.

**Exit evidence:** pinned digests, restore manifest with zero unexplained differences, restart and login result, off-host backup location identifier, operator-accessible recovery procedure and a tested rollback. If recovery fails, proceed with synthetic UAT only.

## C. Verify the release candidate, Saturday 21 November

Run these commands from the Artha root. Provision the isolated PostgreSQL test instance and export its DATABASE_* settings before the integration suite. The E2E Compose services have fixed published ports. Check for conflicts and adjust only the disposable override if occupied. A clean test instance must contain no existing users when running E2E global setup.

```sh
(cd backend && npm exec -- eslint src/import src/backup && npm run typecheck && npm run test:unit -- --runInBand && npm run test:integration && npm run build)
(cd frontend && npm run lint && npm run type-check && npm test && npm run build)
docker compose -p artha-weekend-e2e -f docker-compose.e2e.yml up -d --build
(cd e2e && BASE_URL=http://localhost:3001 npm test -- --config playwright.local.config.ts tests/import.spec.ts tests/reconciliation.spec.ts tests/backup.spec.ts)
```

Also run the new XLSX spec if it is a separate file. Inspect the global setup and health diagnostics if startup fails. Run normal repository CI against the intended release SHA. Development Compose evidence and production-image rehearsal evidence are separate. Record both.

1. On desktop, open the register after import, add an expense, edit its category and reconcile against a synthetic statement. Verify the balance, calendar-month budget, transfer treatment and CSV contents after reload.
2. On physical Android and iPhone, connect to the private HTTPS installation. Test login, file selection, preview, keyboard entry, save feedback and reopen. Interrupt the network during a save and reconnect. Check the server exactly once and clearly report any unsaved edit. A viewport emulation result must be labelled as such.
3. Check incomplete valuations on any dashboard metric used for a decision. A missing price must be visible. Separate missing data from zero.
4. Freeze the tested SHA and digests. Log each failed gate with actual result, expected result and a private or synthetic reproduction. Re-run affected gates after a fix. If no physical device is available, explicitly leave that device unverified and narrow the release claim.

## D. Decide and execute cutover, Sunday 22 November

| Condition | Decision |
|---|---|
| Money controls, duplicate handling, private access, restart, recovery and agreed device gates passed | Present exact SHA, digests, target, evidence, rollback point and residual limits for explicit owner approval. |
| Ledger passes but some sheets remain reference-only | Offer a ledger-only beta with those sheets still maintained in Excel. Owner accepts that narrower scope before cutover. |
| Unexplained balance, missing attachment, cross-tenant visibility or failed restore | Hold real data. Keep prior tracker and assign the failing gate. |
| Backend-free offline entry is mandatory | Keep Pocket Ledger or Excel active. A server-backed Artha deployment cannot satisfy that release criterion. |

After approval, bootstrap privately, take a verified pre-import backup, import once, reconcile against the reviewed mapping and record the first off-host encrypted backup. Check readiness, login, registration closure and backup freshness the following day. If cutover fails, stop writes, retain a private copy of post-cutover changes, restore the matching pinned images and pre-import data into an isolated target, verify balances and only then redirect access. Never downgrade a migrated production database in place on the assumption that old binaries are compatible.

## Resume after any interruption

Keep one execution record in the release branch. Mark each step pending, running, passed, failed or owner-blocked. A planned check is not a passed check. Use this format for each update.

```text
Date and operator timezone:
Step and status:
Checkout / branch / SHA / local changes preserved:
Disposable environment ID or candidate image digest:
Command or user action:
Expected / observed:
Evidence path (synthetic or private, no secrets):
Blocker and owner:
Single next action:
```

First action for a fresh agent: run section 0 and reproduce the four-row mixed-account import from A1. First action for a returning agent: read the last execution record, verify its SHA and environment, and rerun the last uncertain gate.
