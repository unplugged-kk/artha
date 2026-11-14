# Personal Beta v1 - gap register

Built from the Phase 1 audits at `main` `862626cce`. Status: FIXED (code and test on this branch),
OPEN (owner or later work), NOT VERIFIED (read from code, not reproduced at runtime).
Release-blocker: B = blocks putting real data in, N = does not.

## Backup and restore

| ID | Sev | Finding | Evidence | Status | B |
|---|---|---|---|---|---|
| BR-1 | High | One unrestorable scan-pair attachment failed the whole restore (FK on `original_of_attachment_id`). | `backup-attachment-transfer.service.ts`, `restoreDeferredFkColumns`. Reproduced by an integration test that fails without the fix. | FIXED | B |
| BR-2 | High | An archive with no table data wiped the account and reported success. | `validateBackupFormat` checked only `version` and `exportedAt`. | FIXED (requires `accounts` and `transactions`) | B |
| BR-3 | Med | Restored counts include rows swallowed by `ON CONFLICT DO NOTHING`; no final count check. | `insertRows` increments without `rowCount`. | OPEN, NOT VERIFIED | B |
| BR-4 | Med | `accounts.institution_id` and other deferred FK repairs silently leave NULL when the referenced table is absent from the archive. | `restoreDeferredFkColumns` `if (!rows) continue`. | OPEN, NOT VERIFIED | N |
| BR-5 | Low | A truncated or corrupt encrypted file is reported as a wrong password. | `maybeDecrypt`. | OPEN | N |
| BR-6 | Low | Export column guard matches a column name anywhere in the SQL string. | `export-driver-values.spec.ts`. | OPEN | N |
| BR-7 | Low | Strict `version === 1`; no forward or backward migration path. | `validateBackupFormat`. | OPEN | N |
| BR-8 | Info | `payees.address/email/phone` and the four `securities.fund_*` columns round-trip, NULL included. | Integration test, passes. | VERIFIED | - |

## Financial correctness and import

| ID | Sev | Finding | Status | B |
|---|---|---|---|---|
| FI-1 | High | Net-worth history left an unpriced held security out with no flag. Now `pricesComplete` and `unpricedSecurityIds` on daily and breakdown points. No frontend surface reads them yet. | FIXED server side, consumer OPEN | B |
| FI-2 | High | CSV/XLSX amount that was blank or unreadable imported as 0; `12,50` became 1250. | FIXED | B |
| FI-3 | Med | Rows with a missing or bad date were dropped with no count. Now rejected with a row number and reason, merged into `errors`. | FIXED | B |
| FI-4 | Med | Both debit and credit filled kept the credit and lost the debit. Now rejected. | FIXED | B |
| FI-5 | Med | Overlapping re-export without a source id can import duplicates; `skipped` mixes several causes. | OPEN, NOT VERIFIED | N, owner reconciles |
| FI-6 | Med | INV-IMPORT-003: a category collision aborts the whole import. | OPEN | N |
| FI-7 | Gap | No integration or E2E tests for credit-card cycle and utilization, net worth, goals, or CSV/XLSX import. | OPEN | N |

## Security and CI

| ID | Sev | Finding | Status |
|---|---|---|---|
| CI-1 | High | License Compliance: `buffers@0.1.1` has no license anywhere verifiable. Removed from the tree by overriding `unzipper` to 0.12. Not allowlisted. | FIXED locally |
| CI-2 | High | NPM Audit: runtime criticals (`next`, `proxy-addr`, `dompurify`) and highs (`nodemailer`, `undici`, `axios`, `multer`). Gate now reports 0 high and 0 critical in both workspaces. | FIXED locally, full suites pending |
| CI-3 | Med | Documentation vs Manifests: `XLSX_IMPORT_LIMIT_MB` undocumented. | FIXED (`check-env-docs` passes) |
| CI-4 | High | Bearer CWE-73 at `scripts/a11y-audit.cjs:51`. Inline `bearer:disable` with reason; the script is operator-run. | FIXED locally, not re-scanned |
| CI-5 | Med | 15 Bearer exceptions past review-by (issue #29 lists 8). Not extended; each needs re-review. | OPEN |

## Production runtime

| ID | Sev | Finding | Status | B |
|---|---|---|---|---|
| RT-1 | Med | No `enableShutdownHooks`, no `stop_grace_period`: `docker stop` can cut a backup or restore short. | OPEN | N, before daily use |
| RT-2 | Med | Bind mounts `./artha/backups`, `./artha/attachments` are root-owned, backend runs as uid 1001 and read-only. Writes probably fail on a fresh host. | OPEN, NOT VERIFIED | B |
| RT-3 | Med | Compose does not pass `LISTEN_HOST`, `TRUST_PROXY_HOPS`, `CLIENT_IP_HEADER`. | OPEN | N |
| RT-4 | Med | `:latest` and floating `postgres:16-alpine`: no pinned rollback target. | OPEN | N |
| RT-5 | Low | Healthcheck uses `/live`; readiness (`/ready`, checks the database) is unused by compose. | OPEN | N |
| RT-6 | Med | `docs/deployment/README.md` says crons are lease-guarded; `docs/concurrency-and-idempotency.md` CONC-004 says several are not. Stay at one backend replica. | OPEN (doc) | N |
| RT-7 | High | `.env.example` carries `MSN_API_KEY` that looks real and a live `ENCRYPTION_KEY=change-me-...` line. Owner: confirm and rotate. | OPEN | B |
| RT-8 | Med | RLS enforce mode never exercised at runtime. | OPEN | B |

## Owner-dependent

The real workbook (`Sept -2026.xlsx`) is not on this host. Production secrets, hosting account, DNS, and the deploy itself stay with the owner.
