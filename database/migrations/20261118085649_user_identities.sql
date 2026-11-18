-- Migration: user_identities
-- Description: One row per external sign-in identity (Auth0 connection or other
-- OIDC provider) attached to an Artha user, keyed by (issuer, subject).
--
-- `users.oidc_subject` held a single subject with no issuer, so a person using
-- two Auth0 connections (google-oauth2|..., linkedin|...) could only be one of
-- them and was re-matched by email on every switch (docs/auth0, finding A1).
-- Linking is now explicit and happens from an authenticated session; this table
-- is what it writes.
--
-- Backfill: every existing `users.oidc_subject` becomes a row with issuer
-- 'legacy', because the issuer it came from is configuration, not data. The
-- backend matches a 'legacy' row by subject alone and rewrites its issuer on the
-- first successful login. `users.oidc_subject` is left in place and still
-- written for new SSO accounts for one release, so rolling back is code-only.
--
-- Not part of a backup: auth bookkeeping tied to one installation's identity
-- provider, listed in INTENTIONALLY_EXCLUDED_TABLES beside refresh_tokens.

CREATE TABLE IF NOT EXISTS user_identities (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer        VARCHAR(512) NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  -- Auth0 connection from the subject prefix ("google-oauth2"), NULL otherwise.
  provider      VARCHAR(100),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT uq_user_identities_issuer_subject UNIQUE (issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);
-- The 'legacy' fallback looks a subject up without its issuer.
CREATE INDEX IF NOT EXISTS idx_user_identities_subject ON user_identities(subject);

INSERT INTO user_identities (user_id, issuer, subject, provider, created_at)
SELECT u.id,
       'legacy',
       u.oidc_subject,
       CASE WHEN position('|' IN u.oidc_subject) > 1
            THEN left(split_part(u.oidc_subject, '|', 1), 100) END,
       COALESCE(u.created_at, now())
  FROM users u
 WHERE u.oidc_subject IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.subject = u.oidc_subject)
ON CONFLICT (issuer, subject) DO NOTHING;

-- RLS: read and written for the signed-in user (Settings), or under system
-- context in the pre-session OIDC callback. Delegated sessions are refused by
-- the routes, so the ordinary per-user policy applies.
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_identities_isolation ON user_identities;
CREATE POLICY user_identities_isolation ON user_identities
  USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
  WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));
