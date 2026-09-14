-- Transaction Categorization Rules Engine (Priority 13)
--
-- Additive. Introduces user-scoped transaction categorization and tagging rules.
-- Evaluated deterministically in priority order during transaction creation,
-- import processing, and manual batch application.
--
-- Direct user ownership with RLS policy matching Artha standard convention.

CREATE TABLE IF NOT EXISTS transaction_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    match_mode VARCHAR(16) NOT NULL DEFAULT 'ALL' CHECK (match_mode IN ('ALL', 'ANY')),
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_user_priority
    ON transaction_rules(user_id, priority ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_active
    ON transaction_rules(user_id)
    WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS transaction_rules_isolation ON transaction_rules;
CREATE POLICY transaction_rules_isolation ON transaction_rules
    USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
    WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));

ALTER TABLE transaction_rules ENABLE ROW LEVEL SECURITY;
