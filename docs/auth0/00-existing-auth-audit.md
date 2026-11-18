# Auth0 integration -- Phase 0: existing authentication audit

Audited at `origin/main` `1edce9d62` on 2026-11-17, by reading the source. Nothing here was run against an
identity provider. Each finding names its file so it can be re-checked.

## Summary

Artha already ships a generic, server-side OIDC login (`backend/src/auth/oidc/oidc.service.ts`,
`openid-client` 6, Authorization Code flow, state and nonce in HttpOnly cookies) that ends in Artha's own
JWT access and refresh cookies. Auth0 is a standard OIDC provider, so it can sit behind this code path
without a second framework. The existing code assumes **one external identity per user and one issuer per
installation**. Auth0 breaks the first assumption: one person signing in through Google, LinkedIn and an
Auth0 database connection arrives as three different `sub` values. Finding A1 below therefore decides
the shape of the work.

One correction to the integration plan: migration `055_oauth_provider.sql` is **not** user-identity
groundwork. It holds `oauth_payloads` for the MCP OAuth *authorization server* (Artha issuing tokens to
MCP clients). User identities live in columns on `users`.

## Current architecture

| Concern | Where | Behaviour |
|---|---|---|
| Discovery and client | `oidc/oidc.service.ts` `initialize` | `client.discovery(OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET)` at boot. A discovery failure is logged and leaves OIDC disabled; the boot continues. |
| Authorization request | `getAuthorizationUrl` | `scope=openid profile email`, `state`, `nonce`. **No PKCE.** Re-auth adds `prompt=login` and `max_age=0`. |
| Callback | `auth.controller.ts` `oidcCallback` | `authorizationCodeGrant` with `expectedState`/`expectedNonce` (openid-client checks issuer, audience = client id, signature via JWKS and expiry). It then fetches `userinfo` bound to the ID token `sub`, calls `findOrCreateOidcUser`, issues an Artha token pair and redirects to `/auth/callback`. Provider errors and exceptions redirect to a generic `error=authentication_failed`, and details are logged server-side only. Tokens and codes are not logged. |
| Identity storage | `users` (`database/schema.sql`) | `auth_provider` (`local`/`oidc`), `oidc_subject VARCHAR(255) UNIQUE`, plus pending-link columns `oidc_link_pending`, `oidc_link_token` (hashed), `oidc_link_expires_at`, `pending_oidc_subject`. No issuer column. |
| Sessions | `token.service.ts`, `jwt.strategy.ts` | Artha-issued JWT access token (15 min) and rotating refresh token rows, set as HttpOnly cookies with a CSRF double-submit cookie. The provider's tokens are used once, during the callback, and are never stored. |
| Registration gate | `findOrCreateOidcUser(userInfo, registrationEnabled)` | A new OIDC account is refused when `REGISTRATION_ENABLED=false`. The first account ever created becomes `admin`. |
| MFA | `oidcProvedMfa` in the controller | With `FORCE_2FA`, the login must carry an RFC 8176 second-factor `amr` value or a multi-factor `acr`, otherwise `error=mfa_required`. On every OIDC login, **app-level TOTP, backup codes and trusted devices are deleted** for that user: 2FA is treated as the IdP's job. |
| Step-up / destructive actions | `oidc/oidc-reauth.service.ts`, `GET auth/oidc/reauth` | State-bound signed pending marker, `prompt=login`+`max_age=0`, a freshness check on `auth_time` against the flow start (an absent `auth_time` counts as not fresh), and a one-time action-bound artifact whose `jti` is claimed in the database. Only allowed when `authProvider === "oidc"`. |
| Linking | `findOrCreateOidcUser`, `confirmOidcLink` | See A2. |
| Logout | `POST auth/logout` | Revokes the presented refresh token and clears cookies. No RP-initiated logout at the IdP. |
| Status enforcement | `jwt.strategy.ts`, `token.service.ts` refresh | An inactive user is rejected on every request and on refresh. |
| Frontend | `frontend/src/app/login/page.tsx` | Reads `GET auth/methods`, which returns `{local, oidc, registration, ...}`. One "SSO" button links to `/api/v1/auth/oidc`. When local login is off and OIDC is on, it redirects straight to OIDC. `/auth/callback` finishes the session through the existing auth store. |
| Deployment | `.env.example`, `docker-compose.prod.yml`, `helm/values.yaml` + `templates/configmap-backend.yaml` | `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_CALLBACK_URL`, `OIDC_REQUIRE_VERIFIED_EMAIL`. Helm puts the client id and secret in a Secret. |
| PAT / MCP | `pat.service.ts`, `backend/src/mcp/` | Artha-issued and independent of the login provider. Unaffected. |
| RLS | `common/db/with-context.ts` | The callback is a pre-identity path running under `withSystemContext`. Sessions carry the internal user UUID. The external `sub` never reaches an RLS GUC. |

## Findings

**A1 -- one subject per user cannot represent Auth0 (blocker for Auth0).** `users.oidc_subject` is a single
unique column, and the subject lookup ignores the issuer. Under Auth0 each connection has its own `sub`
(`google-oauth2|...`, `linkedin|...`, `auth0|...`). A person who signs in with Google and later with
LinkedIn is unknown on the second login, and resolution falls through to the email path (A2). There the
LinkedIn subject *overwrites* the Google one. The next Google login flips it back. Identity therefore
flip-flops by email match, which is exactly what the plan forbids. Moving an existing installation from
another IdP to Auth0 has the same problem: every user's stored subject belongs to the old issuer. Fix:
an additive `user_identities (user_id, issuer, subject, ...)` table with `UNIQUE (issuer, subject)`,
backfilled from `users.oidc_subject` with the configured issuer.

**A2 -- automatic merge by verified email (security).** When the subject is unknown but the IdP asserts a
verified email that matches an existing account:
- If that account has **no password** (an existing OIDC-only account), the new subject is linked
  immediately, with no confirmation.
- With `OIDC_REQUIRE_VERIFIED_EMAIL=false`, even a password account is merged directly.
- A password account under the default setting gets an emailed confirmation link (good). Confirming it
  sets `authProvider="oidc"`, but the password hash stays, so the local password keeps working too.

For one fixed, trusted IdP this was a reasonable trade-off. With Auth0 social connections, the
first point lets anyone who controls a matching verified email at *any* enabled connection take over an
SSO-only account. Linking must become an explicit, authenticated, freshly re-authenticated action.

**A3 -- inactive accounts are issued tokens.** `oidcCallback` does not check `isActive` before
`generateTokenPair`. The tokens are refused on first use (JWT strategy) and on refresh, so this is not a
bypass. Still, a refresh-token row is written and the browser is told `success=true`. The check belongs in
the callback, before issuing.

**A4 -- an OIDC login deletes app-level 2FA.** That is correct when the IdP enforces MFA. Under Auth0 Free,
MFA may not be enforced, and the plan wants Artha TOTP to remain usable. As it stands, any OIDC login wipes
TOTP, backup codes and trusted devices. Deciding this is a policy matter (see the architecture document).

**A5 -- no PKCE.** This is a confidential client with state and nonce, so it is not exploitable on its
own. Auth0 recommends PKCE for regular web apps as well, and `openid-client` supports it in a few lines.

**A6 -- claims.**
- `userinfo` is fetched with the `sub` check, which is correct.
- The X connection usually supplies **no email**, so such users are created with `email = NULL`. They then
  have no email recovery route and no way to receive the link-confirmation email.
- Auth0 database-connection users report `email_verified=false` until they verify, so they are not
  email-trusted (correct).

**A7 -- callback default mismatch.** The code default is `http://localhost:3001/...`, while `.env.example`
uses `:3000`. A deployment must always set `OIDC_CALLBACK_URL` explicitly.

**A8 -- re-authentication with Auth0 (to verify live).** Auth0 honours `prompt=login` and returns
`auth_time` when `max_age` is sent. So `isFreshAuthentication` should work, but that is NOT TESTED against a
tenant.

**A9 -- logout.** Artha's session ends correctly. The Auth0 SSO session survives, so the next "Continue
with Google" may sign the user straight back in. RP-initiated logout (`/v2/logout` or OIDC
`end_session_endpoint`) is not wired.

**A10 -- account deletion.** It deletes the `users` row. Whether it should also call the Auth0 Management
API to delete the external identity is not decided. Not doing so is safe: a returning login simply finds no
subject and goes through registration policy again.

## Answers to the plan's audit questions

1. Creates new users: yes, subject to `REGISTRATION_ENABLED`. The first user becomes admin.
2. Resolves existing users: by `oidc_subject` alone (no issuer), then by verified email (A2).
3. Provider-specific identity mapping: no. One subject column on `users` (A1).
4. Safe social linking: no for SSO-only accounts (A2). Partial for password accounts (email confirmation).
5. Email already registered: see A2.
6. Respects `REGISTRATION_ENABLED`: yes.
7. User becomes inactive: tokens are issued, then rejected on use (A3).
8. OIDC logout and refresh tokens: Artha refresh token revoked; IdP session untouched (A9).
9. Re-auth with Auth0: designed for it; live verification pending (A8).
10. Deletion and external identity: local only (A10).

## Integration points

`OidcService` (config and PKCE), `AuthService.findOrCreateOidcUser` (identity resolution), the callback in
`AuthController` (active check, linking, logout redirect), the `users` table plus a new `user_identities`
table, `GET auth/methods` and the login page (provider buttons via Auth0 `connection=`), `.env.example`,
the prod Compose file and Helm (configuration).
