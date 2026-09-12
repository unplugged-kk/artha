-- Phase 2 of the India-first platform: the additive data-model extension.
--
-- Every object here is NEW. No existing table, column, constraint, index or
-- policy is altered, so the rollback for this migration is a DROP of exactly
-- these objects and nothing else (data/fin-audit-01/report.md §9, Phase 2).
--
-- The five shapes come from §8's layer map: a FY-versioned tax rule catalogue,
-- an Account Aggregator consent ledger carrying its receipt fields, an SMS
-- sender registry, an extension table for India instrument attributes on a
-- holding, and a broker import layout registry. Phases 3-7 (market data,
-- import pack, instruments, tax engine, AA) are what populate them; this
-- migration only creates the shapes they will write.
--
-- Ownership follows the same four-bucket rule as every other table
-- (database/CLAUDE.md, docs/row-level-security-contract.md):
--
--   * tax_rules and broker_import_layouts are global reference data with no
--     owner column -- statutory rules and shipped layout definitions, shared by
--     every user, exactly like currencies and market_index_prices. They are
--     RLS-exempt, and carry the `rls-exempt:` markers at the foot of
--     database/schema.sql.
--   * aa_consents and sms_sender_registry carry their own user_id, so they take
--     the Group A direct predicate from 112_rls_policies_direct.sql.
--   * india_holdings_ext has no owner column of its own; it resolves through
--     holdings -> accounts -> user_id, the indirect shape from 113.
--
-- The three policied tables ship their own ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY. This migration runs after 123_rls_enable.sql, which derived its
-- target list from pg_policies at the moment it ran and is already recorded in
-- schema_migrations on a deployed database -- a policy added later without its
-- own enable would leave that table the single unprotected one under
-- enforcement (database/CLAUDE.md, docs/future-plans/row-level-security.md).
--
-- Precision follows §8: money is NUMERIC(20,4), rates NUMERIC(20,10). No float.

-- ---------------------------------------------------------------------------
-- tax_rules -- the FY-versioned rule catalogue the tax engine cites
-- ---------------------------------------------------------------------------
-- A computation cites (fy, rule_id, version) rather than reading "the current
-- rate", which is what makes a past estimate reproducible after a Budget
-- changes a slab. A changed rule is therefore a NEW row, never an edit: the
-- unique index is the identity, and `version` is part of it.
CREATE TABLE IF NOT EXISTS tax_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Indian financial year as 'YYYY-YYYY' (April-March), e.g. '2025-2026'.
    fy VARCHAR(9) NOT NULL,
    -- 'old' | 'new' (the 115BAC regimes). Kept as text, not an enum, because a
    -- regime is a per-FY legal construct and an enum value cannot be removed.
    regime VARCHAR(10) NOT NULL,
    -- Stable identifier for one rule within a (fy, regime), e.g. 'slab.0_300000'
    -- or 'deduction.80c'. Deliberately not a human-facing label: renaming a
    -- label must not orphan the estimates that cite it.
    rule_id VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    -- The rule body (slabs, rates, caps, and the citation it came from). JSONB
    -- so a new rule kind needs no migration; shape is owned by the tax engine.
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rules_identity
    ON tax_rules(fy, regime, rule_id, version);

DROP TRIGGER IF EXISTS update_tax_rules_updated_at ON tax_rules;
CREATE TRIGGER update_tax_rules_updated_at
    BEFORE UPDATE ON tax_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- aa_consents -- Account Aggregator consent ledger + receipt fields
-- ---------------------------------------------------------------------------
-- Read-only by construction: AA grants data access, never payment initiation,
-- and the consent's terms are recorded as granted rather than re-derived, so a
-- dispute can be answered from the row instead of from the provider's copy.
--
-- The receipt fields ride on this row rather than a separate append-only table:
-- a consent has exactly one receipt at grant time, nothing rewrites it, and the
-- pair is only ever read together -- so a second table would add a join and a
-- cardinality to defend, not isolation. Nothing here deletes a consent: revoking
-- sets `revoked_at`, it does not remove the audit trail.
CREATE TABLE IF NOT EXISTS aa_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The licensed AA that will serve this consent once a gateway provider is
    -- wired (Phase 7). 'manual' is v1's staged-file provider, which presents the
    -- same shapes behind the AAProvider interface.
    provider VARCHAR(50) NOT NULL DEFAULT 'manual',
    -- 'pending' | 'active' | 'expired' | 'revoked' | 'rejected'
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- The consent's purpose code, as granted.
    purpose VARCHAR(100),
    -- The AA-issued handle that identifies this consent to the provider. This
    -- is the only provider-round-tripped value stored; access tokens are never
    -- persisted and never logged (§6).
    consent_handle VARCHAR(255),
    -- The data window the consent covers. A fetch outside it is refused rather
    -- than clamped, so PII minimisation is a property of the range.
    date_range_start DATE,
    date_range_end DATE,
    -- The accounts the consent exposes. Empty means every account the FIP
    -- reports under it, which is distinct from NULL ("not yet known").
    account_ids UUID[],
    granted_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    -- Receipt: the signed artifact the user approved at grant time.
    receipt_id VARCHAR(255),
    receipt_payload JSONB,
    receipt_issued_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aa_consents_user ON aa_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_aa_consents_status ON aa_consents(status);

DROP TRIGGER IF EXISTS update_aa_consents_updated_at ON aa_consents;
CREATE TRIGGER update_aa_consents_updated_at
    BEFORE UPDATE ON aa_consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- sms_sender_registry -- which sender a bank SMS came from, and what it is
-- ---------------------------------------------------------------------------
-- Rebuilt from Fintrack's `Account.smsSenderIds` concept but not its shape: the
-- mappings live in their own table with a user_id, rather than a string array on
-- the account, so a sender can be registered before the account that will
-- receive it exists and an unassigned sender is representable at all.
CREATE TABLE IF NOT EXISTS sms_sender_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The account a message from this sender books against. NULL is a known
    -- sender with no destination yet -- the import review screen surfaces those
    -- instead of silently dropping the message.
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    -- The sender id as the operator sees it, e.g. 'VM-HDFCBK'. Matched
    -- case-insensitively by the Phase 4 parser; stored as registered.
    sender_pattern VARCHAR(255) NOT NULL,
    -- Human label for the settings screen, e.g. 'HDFC Bank'.
    display_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One registration per (user, sender). A second row for the same sender would
-- leave the parser two answers and no rule to choose between them.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_sender_registry_user_sender
    ON sms_sender_registry(user_id, sender_pattern);
CREATE INDEX IF NOT EXISTS idx_sms_sender_registry_account
    ON sms_sender_registry(account_id);

DROP TRIGGER IF EXISTS update_sms_sender_registry_updated_at ON sms_sender_registry;
CREATE TRIGGER update_sms_sender_registry_updated_at
    BEFORE UPDATE ON sms_sender_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- india_holdings_ext -- India instrument attributes hanging off a holding
-- ---------------------------------------------------------------------------
-- Extension table, not a widening of `holdings`: the India instrument pack
-- (PPF/EPF/NPS/FD/RD/SGB/gold/ESOP/ULIP, §9 Phase 5) adds fields that only
-- Indian instruments have, and widening the shared table would put them on
-- every foreign security too. Ownership is transitive through the holding, so
-- there is no user_id here -- a second copy could disagree with the parent it
-- resolves through.
CREATE TABLE IF NOT EXISTS india_holdings_ext (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    holding_id UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
    -- 'PPF' | 'EPF' | 'NPS' | 'FD' | 'RD' | 'SGB' | 'GOLD' | 'ESOP' | 'ULIP'.
    -- Text rather than an enum: the pack grows, and a removed enum value would
    -- fail the migration on the databases that still hold it.
    instrument_type VARCHAR(40) NOT NULL,
    -- Folio / PRAN / UAN / account number as the institution states it. Free
    -- text, so it is dropped from the de-identified support backup by rule.
    folio_number VARCHAR(100),
    -- Mutual-fund plan: 'direct' | 'regular'. A direct and a regular plan share
    -- a scheme NAME but not an AMFI code, so the distinction has to be stored
    -- or the holding silently revalues against the commission-paying NAV.
    plan_type VARCHAR(20),
    -- AMFI scheme code, for a mutual-fund holding.
    scheme_code VARCHAR(20),
    maturity_date DATE,
    interest_rate NUMERIC(20,10),
    principal_amount NUMERIC(20,4),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_india_holdings_ext_holding
    ON india_holdings_ext(holding_id);

DROP TRIGGER IF EXISTS update_india_holdings_ext_updated_at ON india_holdings_ext;
CREATE TRIGGER update_india_holdings_ext_updated_at
    BEFORE UPDATE ON india_holdings_ext
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- broker_import_layouts -- the registry of known broker/bank file layouts
-- ---------------------------------------------------------------------------
-- Which parser reads which export, at which version. Statement layouts change
-- without notice (§5), so the parser is versioned and each version is proven
-- against a golden file -- this table is what binds the two together instead of
-- a comment in the parser.
CREATE TABLE IF NOT EXISTS broker_import_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Broker or bank whose export this layout reads, e.g. 'zerodha', 'hdfc'.
    broker VARCHAR(50) NOT NULL,
    -- Layout identity within the broker, e.g. 'console-tradebook'.
    layout VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    -- 'csv' | 'xlsx' | 'pdf'. A PDF layout is the one most likely to need a new
    -- version, because the source can change it without telling anyone.
    source_format VARCHAR(20) NOT NULL DEFAULT 'csv',
    -- Hook the Phase 4 parser registry resolves. Never a column map: the mapping
    -- is code, and this row records which parser+version a file matched.
    parser_key VARCHAR(100) NOT NULL,
    -- Repository-relative path of the golden fixture this layout is proven
    -- against, so the registry and the test corpus cannot drift apart.
    golden_file VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_import_layouts_identity
    ON broker_import_layouts(broker, layout, version);

DROP TRIGGER IF EXISTS update_broker_import_layouts_updated_at ON broker_import_layouts;
CREATE TRIGGER update_broker_import_layouts_updated_at
    BEFORE UPDATE ON broker_import_layouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row-Level Security
--
-- aa_consents and sms_sender_registry take the direct predicate verbatim;
-- india_holdings_ext takes the indirect EXISTS through holdings -> accounts.
-- Each of the three ships its own ENABLE, because this file runs after
-- 123_rls_enable.sql (see the header).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS aa_consents_isolation ON aa_consents;
CREATE POLICY aa_consents_isolation ON aa_consents
  USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
  WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));
ALTER TABLE aa_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sms_sender_registry_isolation ON sms_sender_registry;
CREATE POLICY sms_sender_registry_isolation ON sms_sender_registry
  USING (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()))
  WITH CHECK (user_id = (SELECT app_current_user_id()) OR (SELECT app_bypass_rls()));
ALTER TABLE sms_sender_registry ENABLE ROW LEVEL SECURITY;

-- india_holdings_ext -> holdings.account_id -> accounts.user_id
DROP POLICY IF EXISTS india_holdings_ext_isolation ON india_holdings_ext;
CREATE POLICY india_holdings_ext_isolation ON india_holdings_ext
  USING ((SELECT app_bypass_rls()) OR EXISTS (
    SELECT 1 FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    WHERE h.id = india_holdings_ext.holding_id
      AND a.user_id = (SELECT app_current_user_id())))
  WITH CHECK ((SELECT app_bypass_rls()) OR EXISTS (
    SELECT 1 FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    WHERE h.id = india_holdings_ext.holding_id
      AND a.user_id = (SELECT app_current_user_id())));
ALTER TABLE india_holdings_ext ENABLE ROW LEVEL SECURITY;
