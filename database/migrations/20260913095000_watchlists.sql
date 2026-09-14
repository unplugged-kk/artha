-- Watchlists foundation (Priority 7).
--
-- User-scoped watchlists and ordered watchlist items linked to securities.
-- Additive. No existing table or column is altered.
--
-- Direct RLS policies: both watchlists and watchlist_items carry user_id,
-- and inherit the standard direct tenant isolation.

CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_watchlists_user_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_sort
    ON watchlists(user_id, sort_order);

DROP TRIGGER IF EXISTS update_watchlists_updated_at ON watchlists;
CREATE TRIGGER update_watchlists_updated_at
    BEFORE UPDATE ON watchlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_watchlist_items_watchlist_security UNIQUE (watchlist_id, security_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_sort
    ON watchlist_items(watchlist_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_id
    ON watchlist_items(user_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_security_id
    ON watchlist_items(security_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS watchlists_isolation ON watchlists;
CREATE POLICY watchlists_isolation ON watchlists
    USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
    WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watchlist_items_isolation ON watchlist_items;
CREATE POLICY watchlist_items_isolation ON watchlist_items
    USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
    WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
