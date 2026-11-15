# Backup and restore rehearsal

Branch `fm/artha-personal-beta-release-01`, synthetic data only, disposable Postgres 16
(`docker run postgres:16-alpine`, container `artha-rehearsal-pg`, port 55432, no volume).

## Verdict

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
