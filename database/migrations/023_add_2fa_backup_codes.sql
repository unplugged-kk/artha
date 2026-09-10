-- Add backup_codes column to users table for 2FA backup codes
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes VARCHAR(2000);
