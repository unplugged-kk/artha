# Personal Beta v1 - live baseline

Recorded 2026-11-14 08:50 UTC. Mission ARTHA-PERSONAL-BETA-RELEASE-01, Phase 0.

## Repository

- Remote: `https://github.com/unplugged-kk/artha`
- `origin/main`: `862626cce0c1057bd978b0fbe18b9ebd5b48be3a` (merge of #34)
- Release branch: `fm/artha-personal-beta-release-01`, created from that SHA, no stacking, no cherry-picks
- Working tree on start: clean except the protected untracked `.commandcode/`
- Migrations: 196 files in `database/migrations`
- Docker Compose files: `docker-compose.{prod,dev,demo,e2e,zap,cloudflare}.yml`

## Pull requests

| PR | State | Base | Disposition |
|---|---|---|---|
| #34 fund classification | MERGED 2026-11-14 | main | In main. |
| #35 fund comparison API | MERGED 2026-11-14 | fm/artha-fund-categories-01 | Content reached main through #34. |
| #36 fund comparison UI | MERGED 2026-11-12 | fm/artha-fund-comparison-01 | Content reached main through #35 and #34. |
| #31, #33 XLSX import | MERGED | main | In main. |
| #26 de-brand | MERGED | main | In main. |
| #27 local beta env | OPEN | main | Stale, carries unrelated marketing experiment. Not merged, not revived. |
| #32 handoff correction | OPEN | main | Docs only. Not merged as-is. |
| #5 rolling status | OPEN | main | Stays open, one file only. |

Issues open: #29 (Bearer exceptions past review-by), #28 (ZAP baseline report).

## CI on main

Run `43570068476` (CI Pipeline, `862626cce`) was `in_progress` when recorded: E2E shards 1-4 still running.
Four jobs have already failed. The same four failed on the previous main run `43009491207` (`259f7690e`), so they
predate #34/#35/#36. PR Checklist and Fork Images: success. ZAP Baseline: success on `259f7690e`.

| Job | Cause (from the log) | Class |
|---|---|---|
| License Compliance (backend) | `Package "buffers@0.1.1" is licensed under "UNKNOWN" which is not permitted by the --onlyAllow flag` | License policy, transitive dependency |
| NPM Audit | 21 vulnerabilities in one workspace (9 moderate, 10 high, 2 critical); 39 in another (3 low, 25 moderate, 9 high, 2 critical) | Dependency vulnerabilities, exposure not yet assessed |
| Documentation vs Manifests | `XLSX_IMPORT_LIMIT_MB` read in `backend/src/import/xlsx-import.controller.ts:44` but not documented | Doc drift, introduced by the XLSX import PR |
| Bearer Security Scan | 1 HIGH, `javascript_lang_non_literal_fs_filename` (CWE-73) at `scripts/a11y-audit.cjs:51`; plus 8 exceptions past review-by date (issue #29) | Real finding in a dev script, and expired exceptions |

E2E shards: result pending at the time of writing; recorded as UNKNOWN, not passing.

## Architecture facts (CODE VERIFIED, not run)

- NestJS backend is long-running, with in-process scheduled work and advisory locks (`backend/src/common/db/advisory-locks.ts`, `locks.ts`, `db-migrate.ts`, `db-init.ts`).
- MCP relay state is held in process memory (`backend/src/mcp/mcp-relay-*`), so run exactly one backend replica until proven otherwise.
- `docker-compose.prod.yml` sets `RLS_MODE: ${RLS_MODE:-off}`. RLS is off by default and enforce mode is unverified at runtime.
- Healthchecks and `restart: unless-stopped` are declared in the prod compose file; behaviour not yet exercised.
- Production image boot on current main: not verified.
- Backup restore: never rehearsed end to end (Phase 2).

## Environment limits

- `/Users/kishore/Downloads/Sept -2026.xlsx` is not reachable from this host (no `/Users` path). Real-workbook reconciliation is owner-dependent.

## Strategy

1. Phase 1 audits are read-only; the lead integrates findings into `personal-beta-gap-register.md`.
2. Fixes land on this branch in small commits; split into separate PRs (backup, CI/security, deploy, import) only where independent.
3. No PR is merged. No deploy. Synthetic data only.
