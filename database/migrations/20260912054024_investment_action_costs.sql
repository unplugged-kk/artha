-- BONUS, FEE and TAX_WITHHELD: the three investment actions the India
-- foundation needs, added to the existing `investment_action` enum.
--
-- Purely additive -- an enum value is added, no column, constraint or row is
-- touched, and every existing action keeps its meaning. `ADD VALUE IF NOT
-- EXISTS` is idempotent and safe on PostgreSQL 16, and none of the new values
-- is used in this migration, so it is safe inside the runner's transaction
-- (the pattern migration 158 established).
--
-- Why each one exists:
--
--   * BONUS -- a bonus issue adds shares at no cost. Without it the only
--     representation was ADD_SHARES, whose cost is *unknown*, which poisons the
--     cost basis of every position that has ever received a bonus. A bonus's
--     cost is known to be nil, so it keeps the basis known.
--   * FEE -- standalone investment costs (DP charges, AMC, stamp duty). Without
--     it they scatter into ordinary expenses and disappear from any cash-flow
--     return, because they never reach the investment ledger.
--   * TAX_WITHHELD -- TDS on dividends, interest and capital gains. It is an
--     outflow that must be attributable to the income it was withheld from, so
--     the net return and a later tax report can reconcile.
--
-- The action's behaviour is defined in `investment-replay.util.ts` (base
-- action), `cash-impact.util.ts` (signed cash) and `calculateTotalAmount`
-- (stored magnitude), not by this migration.

ALTER TYPE investment_action ADD VALUE IF NOT EXISTS 'BONUS';
ALTER TYPE investment_action ADD VALUE IF NOT EXISTS 'FEE';
ALTER TYPE investment_action ADD VALUE IF NOT EXISTS 'TAX_WITHHELD';
