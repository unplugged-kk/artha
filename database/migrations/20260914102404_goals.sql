-- Migration: 20260914102404_goals.sql
-- Description: Financial Goals and Emergency Fund Tracking System

-- 1. Create goals table
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(32) NOT NULL DEFAULT 'REGULAR',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    target_mode VARCHAR(32) NOT NULL DEFAULT 'FIXED_AMOUNT',
    target_amount DECIMAL(20, 4),
    target_months NUMERIC(5, 2),
    currency VARCHAR(3) NOT NULL,
    target_date DATE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_goals_type CHECK (type IN ('REGULAR', 'EMERGENCY_FUND')),
    CONSTRAINT chk_goals_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    CONSTRAINT chk_goals_target_mode CHECK (target_mode IN ('FIXED_AMOUNT', 'MONTHS_OF_EXPENSES')),
    CONSTRAINT chk_goals_target_amount CHECK (target_amount IS NULL OR target_amount > 0),
    CONSTRAINT chk_goals_target_months CHECK (target_months IS NULL OR target_months > 0)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_user_created ON goals(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_goals_account ON goals(account_id) WHERE account_id IS NOT NULL;

-- Enable Row-Level Security
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'goals_isolation'
    ) THEN
        CREATE POLICY goals_isolation ON goals
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Trigger to maintain updated_at on goals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_goals_updated_at'
    ) THEN
        CREATE TRIGGER update_goals_updated_at
            BEFORE UPDATE ON goals
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 2. Create goal_transactions table for linking specific transactions to goals
CREATE TABLE IF NOT EXISTS goal_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_goal_transactions_goal_tx UNIQUE (goal_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_transactions_user_goal ON goal_transactions(user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_transactions_tx ON goal_transactions(transaction_id);

-- Enable Row-Level Security for goal_transactions
ALTER TABLE goal_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'goal_transactions' AND policyname = 'goal_transactions_isolation'
    ) THEN
        CREATE POLICY goal_transactions_isolation ON goal_transactions
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;
