-- Four-Bucket Budget Taxonomy (Priority 12)
--
-- Additive. Adds nullable budget_bucket classification column to `categories`
-- and `budget_categories` to support the four-bucket budgeting model:
--   NEEDS, WANTS, SAVINGS_INVESTMENTS, DEBT_SERVICING
--
-- Preserves user category ownership: nullable until explicitly assigned,
-- with deterministic fallback to UNCLASSIFIED in analytics and visual indicators.

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS budget_bucket VARCHAR(32);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_categories_budget_bucket'
    ) THEN
        ALTER TABLE categories
            ADD CONSTRAINT chk_categories_budget_bucket
            CHECK (budget_bucket IS NULL OR budget_bucket IN ('NEEDS', 'WANTS', 'SAVINGS_INVESTMENTS', 'DEBT_SERVICING'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_budget_bucket
    ON categories(budget_bucket)
    WHERE budget_bucket IS NOT NULL;

-- Budget categories allocation can also carry an explicit budget_bucket
-- (useful for transfer budget lines like debt servicing or savings, or overriding category default)
ALTER TABLE budget_categories
    ADD COLUMN IF NOT EXISTS budget_bucket VARCHAR(32);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_budget_categories_budget_bucket'
    ) THEN
        ALTER TABLE budget_categories
            ADD CONSTRAINT chk_budget_categories_budget_bucket
            CHECK (budget_bucket IS NULL OR budget_bucket IN ('NEEDS', 'WANTS', 'SAVINGS_INVESTMENTS', 'DEBT_SERVICING'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budget_categories_budget_bucket
    ON budget_categories(budget_bucket)
    WHERE budget_bucket IS NOT NULL;
