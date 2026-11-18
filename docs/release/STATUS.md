# Personal beta -- status

Updated 2026-11-17 21:15 IST. Target: private household installation by Sunday 22 November 2026.
The per-step evidence lives in `personal-beta-execution.md` (log) and `backup-restore-rehearsal.md`
(recovery). This page is the summary: where things stand, what is stuck, what is next.

Branches:
- `release/personal-beta-2026-11-22`: the beta. Pushed, not merged. Head is in `git log`.
- `feat/auth0-integration` (worktree `../artha-auth0`): Auth0, deliberately kept out of the beta.

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
| C Release gates on candidate | RUNNING | See "Gates" below. |
| C Physical Android / iPhone | NOT TESTED | Needs devices and private HTTPS. |
| D Cutover | NOT STARTED | Needs owner approval after C. |

### Gates (last complete run at `5849c304e`)

| Gate | Result |
|---|---|
| Backend lint, typecheck | PASS |
| Backend unit | FAIL 43 of 16,663, in 4 suites. Two were caused by this branch and are now fixed (`474b1410e`): the overlap query wrote its own ledger predicate, and a pre-existing restore read was missing from the attachment-guard record. 5 are macOS-only (`TMPDIR` symlink, CI unaffected). The rest is backend i18n parity -- see "Stuck". |
| Backend integration, builds, frontend lint/test/build | Re-running at `474b1410e` (`/private/tmp/artha-beta-synthetic-evidence/c2/`) |
| Browser: import, XLSX mixed-account, reconciliation, backup | PASS 13/13 on the development-image stack |
| Repository CI on the pushed branch | Not yet observed |

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

1. Read the `c2` gate results. Fix any failures that are not parity.
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
