-- Priority 9: Payment Method & UPI Metadata
--
-- Add additive, nullable columns to `transactions` for payment rails identification
-- (UPI, IMPS, NEFT, RTGS, CARD, CASH, CHEQUE, OTHER) and UPI-specific metadata
-- (UPI VPA / handle, UPI transaction / reference ID).
--
-- Design:
-- 1. `payment_method VARCHAR(20)`: Controlled payment rail identifier.
--    Valid values: 'UPI', 'IMPS', 'NEFT', 'RTGS', 'CARD', 'CASH', 'CHEQUE', 'OTHER'.
--    Enforced with a CHECK constraint `chk_transactions_payment_method`.
--    Nullable: legacy transactions remain valid with NULL payment_method.
-- 2. `upi_vpa VARCHAR(255)`: Virtual Payment Address (e.g. user@okaxis, merchant@upi).
-- 3. `upi_reference VARCHAR(100)`: UPI reference / RRN / transaction reference ID.
-- 4. Partial index on `(account_id, payment_method)` WHERE payment_method IS NOT NULL
--    to optimize filtering transactions by payment rail within an account.
-- 5. Partial index on `(user_id, payment_method)` WHERE payment_method IS NOT NULL
--    to optimize filtering transactions by payment rail across all accounts.
-- 6. Partial index on `(account_id, upi_reference)` WHERE upi_reference IS NOT NULL
--    for reference lookups and audit.

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS upi_vpa VARCHAR(255),
    ADD COLUMN IF NOT EXISTS upi_reference VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_transactions_payment_method'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT chk_transactions_payment_method
            CHECK (payment_method IS NULL OR payment_method IN (
                'UPI', 'IMPS', 'NEFT', 'RTGS', 'CARD', 'CASH', 'CHEQUE', 'OTHER'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_account_payment_method
    ON transactions(account_id, payment_method)
    WHERE payment_method IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_payment_method
    ON transactions(user_id, payment_method)
    WHERE payment_method IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_upi_reference
    ON transactions(account_id, upi_reference)
    WHERE upi_reference IS NOT NULL;
