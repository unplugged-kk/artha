-- Migration: 20260915100000_action_history_actor.sql
-- Description: Record who initiated each history entry (the user directly, an
-- AI Assistant action the user confirmed, or an MCP client) and the tool name.

ALTER TABLE action_history
    ADD COLUMN IF NOT EXISTS actor_type VARCHAR(16) NOT NULL DEFAULT 'user';
ALTER TABLE action_history
    ADD COLUMN IF NOT EXISTS tool_name VARCHAR(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_action_history_actor_type'
    ) THEN
        ALTER TABLE action_history
            ADD CONSTRAINT chk_action_history_actor_type
            CHECK (actor_type IN ('user', 'ai', 'mcp'));
    END IF;
END $$;
