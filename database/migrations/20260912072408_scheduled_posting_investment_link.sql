-- Link a posted occurrence to the investment transaction it created.
--
-- A SIP's plan-vs-actual comparison needs the **actual** amount, and the only
-- authoritative source for it is the investment transaction the posting wrote.
-- The posting table records that an occurrence happened and when, but not what
-- it booked -- so without this column an "actual" figure could only be the
-- planned amount restated, which is the very metric the comparison exists to
-- compute.
--
-- Additive and NULLABLE: a posting made before this column existed keeps no link
-- and reports its actual as unknown rather than as a guess. Nothing is
-- backfilled, because the link was never recorded and inventing one by matching
-- dates would be a heuristic standing in for a fact.
--
-- ON DELETE SET NULL rather than CASCADE: deleting the money does not un-happen
-- the occurrence, and an occurrence record that vanished with its transaction
-- would make a posted-but-then-voided month look like a missed one.

ALTER TABLE scheduled_transaction_postings
    ADD COLUMN IF NOT EXISTS investment_transaction_id UUID;

-- Guarded so a re-apply is a no-op (database/CLAUDE.md). The constraint is
-- named rather than inline so it is identical to the one database/schema.sql
-- declares, which adds it after investment_transactions because that file
-- applies top to bottom.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'fk_scheduled_transaction_postings_investment_transaction'
    ) THEN
        ALTER TABLE scheduled_transaction_postings
            ADD CONSTRAINT fk_scheduled_transaction_postings_investment_transaction
            FOREIGN KEY (investment_transaction_id)
            REFERENCES investment_transactions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Partial: most postings are a bill or a transfer with no investment leg, and
-- the lookups that matter ask "which occurrence produced this investment".
CREATE INDEX IF NOT EXISTS idx_stp_investment_transaction
    ON scheduled_transaction_postings(investment_transaction_id)
    WHERE investment_transaction_id IS NOT NULL;
