-- Instrument identity: ISIN, AMFI scheme code, and the ticker-alias registry.
--
-- Additive. `securities` gains two NULLABLE identity columns and
-- `instrument_aliases` is new global reference data. Nothing existing is
-- altered, so the rollback is a DROP of these three objects.
--
-- Why identity lives on `securities` and not on `india_holdings_ext`: a quote
-- resolves per *instrument*, and the provider layer only ever sees a Security.
-- A scheme code stored on a holding could not reach the provider, and the same
-- fund held in two accounts would store its identity twice and could disagree
-- with itself. The per-position attributes (folio, PRAN/UAN, maturity, rate)
-- stay on the extension table, where they belong.
--
-- `instrument_aliases` is a fact about an exchange, identical for every user
-- (TATAMOTORS -> TMPV on NSE), so it carries no owner column and is RLS-exempt
-- like `currencies`; see docs/row-level-security-contract.md.

ALTER TABLE securities ADD COLUMN IF NOT EXISTS isin VARCHAR(12);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS amfi_scheme_code VARCHAR(10);

-- Partial unique indexes: at most one instrument per ISIN (and per AMFI scheme
-- code) in a user's book, while the common NULL case stays unconstrained. Two
-- securities claiming one identity is exactly what storing an identity is
-- meant to prevent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_securities_user_isin
    ON securities(user_id, isin)
    WHERE isin IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_securities_user_amfi_code
    ON securities(user_id, amfi_scheme_code)
    WHERE amfi_scheme_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS instrument_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange VARCHAR(50) NOT NULL,
    alias_symbol VARCHAR(20) NOT NULL,
    canonical_symbol VARCHAR(20) NOT NULL,
    note VARCHAR(255),
    effective_from DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One current ticker per retired ticker, per exchange.
CREATE UNIQUE INDEX IF NOT EXISTS idx_instrument_aliases_lookup
    ON instrument_aliases(exchange, alias_symbol);
