# Personal beta -- status

Updated 2026-11-18 14:10 IST. Target: private household installation by Sunday 22 November 2026.
The per-step evidence lives in `personal-beta-execution.md` (log) and `backup-restore-rehearsal.md`
(recovery). This page is the summary: where things stand, what is stuck, what is next.

Branches:
- `release/personal-beta-2026-11-22`: the beta. The owner merged it into `main` as PR #38 (head
  `c91c3f573`). The commits after that -- this page's gate results and handoff, and the two runbook files
  -- are on the branch and need a follow-up PR.
- `feat/auth0-integration` (worktree `../artha-auth0`): the Auth0 audit and proposal. Merged as PR #39
  (docs only, no code).

`main` now carries English-only strings, so the i18n parity tests fail on `main`. The project rule is
"main requires full parity", so translating the new keys is now the first job, ahead of anything else.
CI at merge time: License Compliance, NPM Audit and Bearer failed on the PR run. The same three failed
on `main` before this work (see `personal-beta-baseline.md`); re-check them on the current `main` run
rather than assuming.

## Where we are

| Step | Status | Evidence / note |
|---|---|---|
| 0 Baseline | PASS | Branch from `1edce9d62`. Owner's reader fix committed unchanged (`909281298`), reader suite 12/12. |
| A1 Reproduce mixed-account import | PASS (defect confirmed) | Old wizard: bank 720 / card +40 instead of 760 / 0. |
| A2 Per-row account routing | PASS (synthetic) | Source column, one decision per label, per-row override, row-level review with balance change per account. |
| A3 One reviewed batch | PASS (synthetic) | One transaction for all accounts, ownership checked inside, retries (immediate, renamed, concurrent) converge, remapped/edited rows held for review. |
| A4 Auxiliary sheets (Categories, Investments, Savings) | NOT STARTED | Those sheets stay in Excel for the beta unless this lands before freeze. |
| A5 Tests | PASS | Unit, PostgreSQL integration (11 cases), browser XLSX spec (desktop, and phone width by emulation). |
| A private November replay | NOT RUN | Needs the owner's machine and the real workbook; controls are in the runbook. |
| B1 Two isolated production-like stacks | PASS, with owner items | Pinned digests, loopback, fresh secrets, one replica, readiness on `/health/ready`. |
| B2 Manifest + encrypted export + DB snapshot | PASS (synthetic) | |
| B3 Restore counts (BR-3) | PASS | Unexplained omissions now fail the restore and leave prior data intact. |
| B4 Host-loss rehearsal | PASS (synthetic, same Mac) | 55 s to restored, manifest identical after restart and under `RLS_MODE=enforce`; rollback via snapshot 50 s. |
| C Release gates on candidate | PASS except translations and one failure inherited from `main` | See "Gates" below. |
| C Physical Android / iPhone | NOT TESTED | Needs devices and private HTTPS. |
| D Cutover | NOT STARTED | Needs owner approval after C. |

### Gates (complete run at `474b1410e`, logs in `/private/tmp/artha-beta-synthetic-evidence/c2/`)

Run with `TZ=UTC TMPDIR=/private/tmp/` and integration DB `localhost:55433/artha_test`.

| Gate | Result |
|---|---|
| Backend lint, typecheck, build | PASS |
| Backend unit | FAIL 36 of 16,663, all in `i18n/locales.parity.spec.ts`: untranslated new keys (expected on a WIP branch; see "Stuck" 1) |
| Backend integration | PASS 561/561 (51 suites, including `import-source-accounts` and `backup-restore`) |
| Frontend lint, typecheck, build | PASS |
| Frontend tests | FAIL 19 of 16,817: 17 i18n parity (expected) and 2 in `store/authStore.test.ts` "rehydration 502 handling". The 2 also fail on unmodified `origin/main` (checked 2026-11-18), so they are not this branch's regression, but a release blocker for "no failing tests" until fixed |
| Browser: import, XLSX mixed-account, reconciliation, backup | PASS 13/13 on the development-image stack at `5849c304e` |
| Repository CI on the pushed branch | Not yet observed |

Earlier run at `5849c304e`: 2 real regressions found and fixed in `474b1410e` (overlap query wrote its own
ledger predicate; a pre-existing restore read was missing from the attachment-guard record).

## Where we are stuck

1. **Translations (blocks merge, not testing).** New English strings exist in the backend `errors.json`
   and the frontend `import.json`. The parity tests fail for the 20 other locales until they are
   translated, which the project does in one pass at acceptance. Decision needed: translate now, or
   ship the beta from the branch without merging to `main`.
2. **Off-host backup (owner).** The rehearsal copy went to a second directory on the same Mac. A real
   off-host location is needed, plus a decision on who holds the backup password.
3. **Private HTTPS (owner).** Phones cannot be tested, and secure cookies cannot be used, until the
   installation is reachable over HTTPS on a private network (e.g. Tailscale or a Cloudflare Tunnel with
   access control).
4. **Physical devices (owner).** An Android phone and an iPhone are needed for the C2 checks. The
   390px result so far is emulation.
5. **Linux host permissions (RT-2).** Untested. The bind mounts need `chown 1001:65533`. On Docker
   Desktop, `/private/tmp` paths silently land inside the VM -- use a path under `/Users`.
6. **Known open defect BR-5.** A truncated backup is reported as a wrong password. It is safe (nothing
   changes), but the message misleads.

## Next actions, in order

1. Fix `frontend/src/store/authStore.test.ts` "rehydration 502 handling" (fails on `main` too: after a
   502 or a network error, the store no longer keeps `isAuthenticated`). Decide whether the test or the
   store is wrong, and keep the behaviour the test describes unless there is a reason not to.
2. Rebuild the candidate images from a clean `git archive` of the gated SHA. Run the A1 browser spec and
   the recovery script against the production-image stack. Record the digests.
3. Owner: choose the off-host location, the HTTPS route, the devices, and the translation timing (stuck
   items 1-4).
4. A4 if time allows before Friday freeze. Otherwise the beta scope is "daily ledger; plans and budgets
   stay in Excel".
5. Saturday: device UAT, then the private November replay on the owner's Mac (loopback, providers off).
6. Sunday: present the SHA, digests, evidence, rollback point and limits for go/no-go.

## Auth0 (separate track)

| Phase | Status |
|---|---|
| 0 Audit of existing OIDC | DONE -- `docs/auth0/00-existing-auth-audit.md` on `feat/auth0-integration` |
| 1 Architecture and decisions | PROPOSED -- `docs/auth0/01-architecture-and-decisions.md`, awaiting owner approval |
| 2+ Implementation | BLOCKED on approval of D2 (identity table), D3 (no email merging), D6 (keep Artha 2FA), and on timing (recommended: after Sunday's beta) |
| Tenant credentials | Owner fills the git-ignored `../artha-auth0/.env` (OIDC block at the top) |

Key audit findings:
- One `oidc_subject` per user cannot hold several Auth0 connections.
- An SSO-only account is merged automatically by verified email.
- Inactive users are issued tokens.
- Every OIDC login deletes Artha TOTP.
- No PKCE.

## Handoff for the next agent

Read in this order:
1. This page.
2. `artha-agent-runbook.md` (the assignment).
3. `artha-weekend-release.md` (the release test matrix).
4. The last entry in `personal-beta-execution.md`.

Facts that are easy to miss:
- **Two checkouts.** Release work happens in `/Users/kishore/git/artha` on
  `release/personal-beta-2026-11-22`. Auth0 work happens in `/Users/kishore/git/artha-auth0` on
  `feat/auth0-integration`, and that worktree has no `node_modules` of its own.
- **Owner files.** Leave `.claude/settings.json` (modified) and `AGENTS.md` (untracked) alone. They
  are not part of this work.
- **Personal data.** Never copy the real workbook (`/private/tmp/finance-nov17/input`) into the repo,
  a build context, CI or a screenshot.
- **Disposable environments** that may still be running:
  - E2E stack: Compose project `artha-weekend-e2e`, app on `http://localhost:3001` (use `localhost`;
    `127.0.0.1` hangs on "Loading Artha"), loopback override at
    `/private/tmp/artha-beta-synthetic-evidence/compose.loopback.yml`.
  - Integration DB: container `artha-beta-itest-pg` on `localhost:55433`, database `artha_test`, user
    `artha_test`, password `itest_disposable` (throwaway).
  - Recovery stacks `artha-beta-b` (3201, `RLS_MODE=enforce`) and `artha-beta-r` (3301). Project
    `artha-beta-a` is stopped. Their env files and credentials are in `/private/tmp/artha-beta-b/`
    (mode 600; never print them); mounts are in `~/.local/share/artha-beta-rehearsal/`.
  - `/private/tmp` does not survive a reboot. If those files are gone, rebuild from the procedure in
    `backup-restore-rehearsal.md` with fresh secrets.
- **Backend lint fixes files.** `npm run lint` in `backend` runs `eslint --fix`, so check `git status`
  after it.
- **Commits go through lint-staged.** Do not `git add -N` and then commit.
- **Do not deploy or post real data.** Live deployment and the first real posting need explicit owner
  approval (runbook section D).
