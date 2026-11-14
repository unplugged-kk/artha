-- Migration: 20261111090000_fund_classification.sql
-- Description: Capture the AMFI-published classification (fund house, scheme
-- type, scheme category) on the security that carries a scheme code, and when
-- it was last read. Additive and nullable so it replays as a no-op on
-- schema.sql, which already declares these columns.
--
-- `fund_classification_updated_at` is stamped only when the provider answered;
-- a failed fetch leaves the row (and the stamp) untouched so the next read
-- retries. See docs/specs/fund-categories-and-comparison.md, INV-FUNDCAT-002.

ALTER TABLE securities ADD COLUMN IF NOT EXISTS fund_house VARCHAR(120);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS fund_scheme_type VARCHAR(80);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS fund_category VARCHAR(120);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS fund_classification_updated_at TIMESTAMP;
