-- Migration: Add backup codes and OIDC link confirmation columns to users table
-- Addresses: L5 (2FA backup codes), M6 (OIDC account linking confirmation)

-- L5: Backup codes for 2FA recovery
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT;

-- M6: OIDC account linking confirmation fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_link_pending BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_link_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_link_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_oidc_subject VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_oidc_link_token ON users(oidc_link_token) WHERE oidc_link_token IS NOT NULL;
