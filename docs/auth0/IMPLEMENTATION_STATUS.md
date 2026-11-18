# Auth0 implementation status

Tracks the phases in [01-architecture-and-decisions.md](01-architecture-and-decisions.md).
Status values: PASS, FAIL, BLOCKED, NOT TESTED.

## Tenant (dev)

| Item | Status | Notes |
|------|--------|-------|
| Regular Web Application "Artha" | PASS | Client id `yc6rXXNuPNGRPZacJdD2adu1lS3R9Kuk`. The older Native app of the same name is unused. |
| Callback, logout, origin URLs (localhost:3001) | PASS | Verified with `auth0 apps show`. |
| Grant types | PASS | `authorization_code`, `refresh_token` only. |
| Connections | PASS | Only `google-oauth2` enabled for the app (checked via `connections/<id>/clients`; `auth0 connections list` omits enabled clients). Uses Auth0 dev keys: replace with the owner's Google keys before production. |
| OIDC discovery | PASS | Issuer reachable, PKCE S256 advertised. |

## Phase 2: PKCE, inactive users, config validation

| Check | Status | Evidence |
|-------|--------|----------|
| PKCE S256 on login and re-auth; verifier cookie cleared on callback | PASS | `oidc.service.spec.ts`, `auth.controller.spec.ts`, `test/integration/oidc-callback.integration.spec.ts` |
| Callback without verifier rejected before code exchange | PASS | integration spec (HTTP + PostgreSQL) |
| Inactive user rejected before token issuance | PASS | integration spec (HTTP + PostgreSQL) |
| Partial OIDC config fails startup; issuer must be HTTPS; HTTP callback only on loopback; failed rediscovery disables the client | PASS | `oidc.service.spec.ts` |
| Auth unit suite (626), backend lint, typecheck | PASS | |
| Live Auth0 login | NOT TESTED | Provider is stubbed in tests; see live verification below. |

## Phase 3: identities, refuse-and-link, link/unlink

Migration `20261118085649_user_identities.sql` (+ `schema.sql`, entity `UserIdentity`).

| Check | Status | Evidence |
|-------|--------|----------|
| `user_identities` with `UNIQUE (issuer, subject)`, RLS policy, backfill from `users.oidc_subject` as issuer `legacy` | PASS | `scripts/verify-schema.sh` (migrations replay as no-ops on `schema.sql`), `migration:lint` |
| Login resolves by (issuer, subject); same subject from another issuer is another identity | PASS | `test/integration/oidc-identities.integration.spec.ts` |
| `legacy` rows upgraded to the real issuer on first login; `users.oidc_subject`-only accounts still found (rolling deploy) | PASS | integration spec |
| Unknown identity with an existing account's email refused (`error=account_exists`), for password and SSO-only accounts, with no change to the account (D3) | PASS | integration + controller specs |
| `OIDC_REQUIRE_VERIFIED_EMAIL=false` only lets an unverified email be stored on a new account; never merges | PASS | integration spec |
| Emailed link confirmation (`/auth/oidc/confirm-link`, template, strings) removed | PASS | |
| `POST /auth/identities/link` (step-up `manage-identities`), state-bound signed `oidc_link` marker, callback attaches without issuing a session | PASS | controller + reauth specs |
| Identity owned by another account refused (`link=identity_in_use`) | PASS | integration spec |
| `DELETE /auth/identities/:id` (step-up); last sign-in method refused; clears `users.oidc_subject` so it cannot sign back in; cannot touch another user's rows | PASS | integration spec |
| Delegated sessions cannot list/link/unlink | PASS | routes are not `@AllowDelegate` (global `AccountDelegateGuard`) |
| Artha TOTP no longer wiped on OIDC login; accounts with TOTP get the 2FA page unless the IdP asserted MFA or the device is trusted (D6); `FORCE_2FA` met by either | PASS | integration + controller specs |
| Link/unlink in action history (D4) | NOT DONE (deviation) | `action_history` is the undo log: undo takes the newest entry and throws for unknown entity types, so a link entry would block undo of everything before it. Link/unlink are logged server-side instead. A security-event log is the right home if one is added. |
| Frontend for linking, `account_exists`, `twoFactor=required` | NOT TESTED | Phase 5 |

## Phase 4: logout, connections

| Check | Status | Evidence |
|-------|--------|----------|
| Logout revokes the Artha refresh-token family first; a failed revoke still fails the logout | PASS | `auth.controller.spec.ts` (order asserted) |
| `OIDC_LOGOUT_REDIRECT=true` returns `logoutUrl`: discovered `end_session_endpoint`, else Auth0 `/v2/logout`, returning to `<callback origin>/login` | PASS | `oidc.service.spec.ts` |
| `OIDC_PROVIDER` validated (`generic`/`auth0`); `OIDC_CONNECTIONS` parsed, de-duplicated, ignored unless `auth0` | PASS | `oidc.service.spec.ts` |
| `/auth/methods` returns `oidcConnections`; `/auth/oidc?connection=` accepts only configured names (400 otherwise) and forwards `connection` | PASS | controller + service specs |
| Logout URL is returned to local-password users too when enabled | KNOWN | Harmless extra hop through the provider; the logout endpoint has no user identity beyond the cookie. |

## Phases 5-6

| Phase | Status |
|-------|--------|
| 5: per-connection login buttons, Settings linking, callback states | NOT TESTED |
| 6: `.env.example`, compose, Helm | PASS (`check-env-docs`, `helm lint`, `helm template`, `docker compose config`) |

## Live verification

NOT TESTED.
