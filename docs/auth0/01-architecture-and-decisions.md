# Auth0 integration -- Phase 1: architecture and decisions

Status: PROPOSED, awaiting owner approval. Builds on `00-existing-auth-audit.md`.

## Responsibilities

Auth0 verifies the human: Google, X, LinkedIn, the Auth0 database connection and passwordless. Artha
keeps everything after that: the internal user UUID, roles, its own JWT and refresh tokens, CSRF, TOTP and
trusted devices, delegation, PATs and MCP, and RLS. Auth0 tokens are used once, in the callback, and are
never stored or forwarded.

## Decisions

**D1. Auth0 is configured through the existing `OIDC_*` variables. There is no second implementation.**
`OIDC_ISSUER_URL=https://<tenant>.<region>.auth0.com/` is enough for discovery. The only Auth0-specific
behaviour is optional: a `connection` hint for per-provider buttons, and the Auth0 logout URL. Both hang off
one flag, `OIDC_PROVIDER=auth0` (default `generic`). `AUTH0_*` names are not introduced, because two names
for one setting is how configurations drift.

**D2. Add `user_identities` (additive).** Columns: `id`, `user_id` FK with `ON DELETE CASCADE`, `issuer`,
`subject`, `provider` (Auth0 connection, from the `sub` prefix), `created_at`, `last_login_at`, and
`UNIQUE (issuer, subject)`. The migration backfills each `users.oidc_subject` under the issuer configured at
migration time. A backfilled row is marked `issuer = 'legacy'` when no issuer is known, and is matched by
subject alone until the first successful login rewrites it. `users.oidc_subject` stays, readable, for one
release, so rolling back is code-only.

**D3. No automatic merge by email, ever.** An unknown `(issuer, subject)` either:
- creates a new account (registration policy applies), or
- if the verified email belongs to an existing account, is refused with "this email already has an
  account; sign in to it and link this provider in Settings".

The existing emailed confirmation link for password accounts is retired in favour of in-session linking.
An email link proves control of the inbox, not of the Artha session. `OIDC_REQUIRE_VERIFIED_EMAIL=false`
keeps one meaning only: whether an unverified email may be stored on a *new* account.

**D4. Linking and unlinking are explicit.** `POST /auth/identities/link` starts an OIDC round trip from an
authenticated session. It requires a fresh step-up: a password for a local account, or a fresh OIDC
re-authentication for an SSO account. The callback attaches the identity to the session user inside one
transaction. Unlinking the last remaining sign-in method is refused. Both actions write to the existing
action history.

**D5. Inactive accounts are refused in the callback, before any token is issued (A3).**

**D6. App-level TOTP survives an OIDC login.** The automatic wipe is removed. `FORCE_2FA` for an OIDC
account is satisfied by either an IdP MFA assertion (`amr`/`acr`, as today) or Artha TOTP after the
callback, through the existing 2FA challenge page. This keeps Artha MFA meaningful on Auth0 Free.

**D7. PKCE S256 is added to every authorization request.** The verifier sits in an HttpOnly cookie beside
`oidc_state`.

**D8. Logout clears the Artha session first, then optionally redirects to the Auth0 logout URL**
(`OIDC_LOGOUT_REDIRECT=true`). The Artha refresh token is revoked before the redirect is built, so a failed
Auth0 logout cannot leave an Artha session.

**D9. Provider buttons are configuration, not discovery.**
- `OIDC_CONNECTIONS=google-oauth2,linkedin,twitter,Username-Password-Authentication` lists the tested
  connections. Each button sends `connection=<name>` to Auth0.
- An empty list shows one "Continue with SSO" button that opens Universal Login.
- A connection is listed only after its live login has passed.

**D10. Accounts without an email (X) are allowed but flagged.** Settings prompts the user to add an email
for recovery. Such an account cannot receive emailed security notices until they do.

## Not in scope for the first release

- Auth0 Management API calls (deleting the Auth0 user on account deletion, reading linked identities from
  Auth0).
- Token exchange with an Auth0 API audience.
- A custom domain.

Registering an Artha API in Auth0 is not needed while Artha's own JWT remains the API credential.

## Tenants

Use separate development and production tenants, each with a Regular Web Application:
- Authorization Code grant only. Implicit grant off.
- Allowed callback `<origin>/api/v1/auth/oidc/callback`.
- Allowed logout URL `<origin>/login`.
- Web origin `<origin>`.

Credentials go only into the existing secret paths: the env file mode 600 for Compose, and the Helm Secret
for Kubernetes.
