-- Migration: Add sector data columns to securities table
-- These store sector classification from Yahoo Finance for sector weighting reports

ALTER TABLE securities ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS sector_weightings JSONB;
ALTER TABLE securities ADD COLUMN IF NOT EXISTS sector_data_updated_at TIMESTAMP;
