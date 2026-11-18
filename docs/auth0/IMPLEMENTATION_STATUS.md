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

## Phases 3-6

| Phase | Status |
|-------|--------|
| 3: `user_identities`, (issuer, subject) resolution, refuse-and-link, link/unlink | NOT TESTED |
| 4: logout revokes Artha refresh token, optional Auth0 logout | NOT TESTED |
| 5: per-connection login buttons, localized errors | NOT TESTED |
| 6: `.env.example`, compose, Helm | NOT TESTED |

## Live verification

NOT TESTED.
