# Backup and restore rehearsal

Branch `fm/artha-personal-beta-release-01`, synthetic data only, disposable Postgres 16
(`docker run postgres:16-alpine`, container `artha-rehearsal-pg`, port 55432, no volume).

## Verdict

Updated 2026-11-17 (release branch `release/personal-beta-2026-11-22`): host-loss recovery VERIFIED on
synthetic data with production images; see "Host-loss rehearsal" below. The off-host copy in that run
was a second directory on the same Mac, so a real off-host location and its credentials remain owner
work. The original 2026-11-14 verdict follows.

PARTIALLY VERIFIED. Export to a restore into a different account passes, including attachments and
NULLs. A restore into a second, empty database has NOT been run, so the recovery gate is not closed.

## What ran

Command (from `backend/`, with `DATABASE_HOST=localhost DATABASE_PORT=55432 DATABASE_USER=artha_test
DATABASE_PASSWORD=test_password DATABASE_NAME=artha_test`):

```
npx jest --config ./test/jest-e2e.json --runInBand --testPathPatterns="backup-restore.integration"
```

| Check | Result |
|---|---|
| Baseline suite at `862626cce` (15 tests: full round trip, encrypted round trip, wrong password, loan self-link, scan pair, custom currency, attachment completeness, schema coverage guard) | VERIFIED, 15 of 15 pass |
| `payees.address/email/phone` and `securities.fund_house/fund_scheme_type/fund_category/fund_classification_updated_at` round trip, populated and NULL | VERIFIED, new test passes |
| Scan pair with corrupt visible bytes restores everything else | VERIFIED. Fails with `violates foreign key constraint` without the fix, passes with it |
| Archive with no `accounts` or `transactions` data is refused before the wipe | VERIFIED by unit test |
| Interrupted restore leaves a healthy database | CODE VERIFIED: wipe and inserts share one `withScopedDb` transaction. Not exercised with an injected failure |
| Truncated or corrupt encrypted file, wrong password | CODE VERIFIED. A corrupt file is reported as a wrong password (BR-5) |
| Duplicate and concurrent restore | NOT TESTED |
| Restore into a second empty database | NOT RUN |
| Row-count and balance comparison against a captured baseline artifact | NOT RUN |
| Application start against the restored database | NOT RUN |

## Defects found and fixed

- BR-1: one unrestorable scan-pair attachment rolled back the whole restore.
- BR-2: an envelope with no table data wiped the account and reported success.

## Open

BR-3 (restored counts include rows skipped by `ON CONFLICT DO NOTHING`) and BR-4 (deferred foreign keys left NULL when
the archive omits the referenced table). See `personal-beta-gap-register.md`.

## Still required before real data goes in

Seed a multi-tenant synthetic dataset, capture exact-decimal balances and row counts to a JSON artifact, export through
the application, restore into a second empty database, compare, then start the production image against it. Until that
run passes, treat recovery as unproven.

## Host-loss rehearsal (2026-11-17)

Synthetic data only. Images built from a clean `git archive` of `c376afeb3` (includes the BR-3 fix):
backend `sha256:51111cefd1c7644587a47eb54408a44f5ac107b2c6ea043723877e176cb1dba4`, frontend
`sha256:0e73028a7af22a0356d3ac7cfe7fc2db7ed36eab40b0c8f49cf9e6fa07319939`, PostgreSQL pinned as
`postgres@sha256:81e77a4833487b8132fe4b00bedd39dc3f74b8641e387f19312a48f7de218c2e`. One backend replica,
196 migrations applied.

### Procedure (operator copy; secrets live only in the env files)

Each installation is `docker-compose.prod.yml` plus a private override that pins the images, renames the
containers and binds the frontend to loopback, and a private env file (mode 600) with fresh
`POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, the host backup and attachment directories, and
`DISABLE_HTTPS_HEADERS=true` only while it is reached over plain loopback HTTP.

```sh
# Bring an installation up; readiness checks the database.
docker compose --env-file <stack.env> -f docker-compose.prod.yml -f <override.yml> up -d --wait
curl -s http://localhost:<port>/api/v1/health/ready      # {"status":"ok"}

# Before anything else: the service user (uid 1001) must be able to write both mounts.
docker exec <backend> sh -c 'touch /data/backups/.p /data/attachments/.p && rm /data/backups/.p /data/attachments/.p'

# Register the owner, then close registration and restart.
#   REGISTRATION_ENABLED=false in the env file, then the same `up -d --wait`.

# Capture, export, copy off the host (REHEARSAL_* variables hold the credentials).
node scripts/beta-recovery-rehearsal.mjs manifest <url> manifest-before.json
node scripts/beta-recovery-rehearsal.mjs export   <url> owner.artha
# copy owner.artha to the off-host location; keep the backup password separately

# Database snapshot for rolling back a migration on the same installation.
docker exec <postgres> pg_dump -U <user> -d artha -Fc > snapshot.dump

# Host loss: bring up an empty installation, register the owner, close registration, restore.
node scripts/beta-recovery-rehearsal.mjs restore  <new-url> owner.artha
node scripts/beta-recovery-rehearsal.mjs manifest <new-url> manifest-after.json
node scripts/beta-recovery-rehearsal.mjs compare  manifest-before.json manifest-after.json

# Rollback: restore the snapshot into an EMPTY database, then start the matching pinned images.
docker compose ... up -d --wait postgres
docker exec -i <postgres> pg_restore -U <user> -d artha --no-owner < snapshot.dump
docker compose ... up -d --wait
```

Never downgrade a migrated database in place: roll back by restoring the snapshot taken before the
upgrade into a fresh database and starting the image it was taken with.

### Results

| Check | Result |
|---|---|
| Stack A (prod images, loopback) reaches DB-backed readiness | VERIFIED, 47 s |
| Service user writes both mounts | VERIFIED on a `/Users/...` host path. FAILED on `/private/tmp/...` -- Docker Desktop does not share that path, so the container got a root-owned VM-local directory and backups would never have reached the host. On Linux the shipped `./artha/*` bind mounts still need `chown 1001:65533` (RT-2, not exercised on Linux) |
| Seed: two INR accounts, categorized purchases across Oct/Nov, a bank-to-card transfer, two identical purchases, a reconciled row, a category budget, a PNG receipt; a second tenant with its own account | VERIFIED |
| Second tenant sees none of the owner's records | VERIFIED on A, B (off and enforce) and the rollback target |
| Encrypted export, copied to a second directory | VERIFIED (not a real off-host location) |
| A stopped; B bootstrapped empty, owner registered, registration closed (register now 403), restore of the copy | VERIFIED, 55 s from stopping A to restored |
| Restart B, log in again, manifest compare (balances in minor units, every posting by business key with status, category and transfer counterparty, monthly category sums, budget, receipt SHA-256) | VERIFIED, identical |
| `RLS_MODE=enforce` on B: runtime role verified as non-superuser, no BYPASSRLS, manifest identical, isolation holds | VERIFIED |
| Export and restore again under enforce | VERIFIED, identical |
| Rollback target: snapshot restored into an empty database, same pinned images started, migrations a no-op | VERIFIED, 50 s, manifest identical |
| Wrong backup password and truncated archive against the production stack | Covered by the integration suite (prior data unchanged). The production-stack rerun was cut short by the login rate limit (429) and is pending |

