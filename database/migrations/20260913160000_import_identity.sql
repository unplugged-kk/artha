-- Add import content identity and source transaction identifier to transactions
-- and investment_transactions for deterministic import idempotency.
--
-- Background (Priority 8):
-- Prior to this migration, transaction import deduplication for non-transfers was
-- nonexistent, and repeated statement ingestion or retry would duplicate
-- transactions and inflate account balances.
--
-- Design:
-- 1. `import_hash` holds a cryptographic SHA-256 hex string computed from a
--    deterministic canonical representation of the source record, scoped to the
--    account.
-- 2. `source_transaction_id` stores the upstream/source transaction identifier
--    when provided by the source format (e.g. OFX FITID, bank reference / UTR,
--    or Microsoft Money htrn).
-- 3. Both columns are ADDITIVE and NULLABLE: historical rows and manually created
--    transactions retain NULL import_hash and are never fabricated with guesses.
-- 4. A partial unique index on (account_id, import_hash) WHERE import_hash IS NOT NULL
--    enforces atomic deduplication at the database level against concurrent imports,
--    while allowing unlimited NULL rows for manual and legacy entries.

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS import_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_transaction_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_account_import_hash
    ON transactions(account_id, import_hash)
    WHERE import_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_source_id
    ON transactions(account_id, source_transaction_id)
    WHERE source_transaction_id IS NOT NULL;

ALTER TABLE investment_transactions
    ADD COLUMN IF NOT EXISTS import_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_transaction_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_investment_transactions_account_import_hash
    ON investment_transactions(account_id, import_hash)
    WHERE import_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_investment_transactions_source_id
    ON investment_transactions(account_id, source_transaction_id)
    WHERE source_transaction_id IS NOT NULL;
