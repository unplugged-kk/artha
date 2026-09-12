import { InvestmentAction } from "./entities/investment-transaction.entity";
import {
  CASH_COST_ACTIONS,
  SHARE_MOVING_ACTIONS,
  applyActionToQuantity,
  baseInvestmentAction,
  isQuantityOnlyAction,
} from "./investment-replay.util";
import { computeInvestmentCashImpact } from "./cash-impact.util";

/**
 * The three India actions (migration 20260912054024), asserted as one contract.
 *
 * Each is defined in several places -- the base-action map, the share replay,
 * the cash impact, the stored total -- and the point of these tests is that the
 * definitions agree. A bonus that moved cash, or a fee that moved shares, would
 * each be a silent corrupting of the ledger rather than a visible error.
 */
describe("India investment actions", () => {
  describe("BONUS", () => {
    it("reuses the ADD_SHARES share movement", () => {
      expect(baseInvestmentAction(InvestmentAction.BONUS)).toBe(
        InvestmentAction.ADD_SHARES,
      );
      expect(applyActionToQuantity(100, InvestmentAction.BONUS, 20)).toBe(120);
    });

    it("is a share-moving action", () => {
      expect(SHARE_MOVING_ACTIONS).toContain(InvestmentAction.BONUS);
    });

    it("keeps the basis known, unlike the ADD_SHARES it borrows its movement from", () => {
      // The distinction the action exists for: a bonus's cost is genuinely nil,
      // so the total basis stands; ADD_SHARES means the cost is unrecorded,
      // which must make the basis unknown rather than treat shares as free.
      expect(isQuantityOnlyAction(InvestmentAction.BONUS)).toBe(false);
      expect(isQuantityOnlyAction(InvestmentAction.ADD_SHARES)).toBe(true);
    });

    it("moves no cash, so it cannot be mistaken for a purchase", () => {
      expect(
        computeInvestmentCashImpact(InvestmentAction.BONUS, 20, 500, 0),
      ).toBe(0);
    });

    it("is not an income action", () => {
      expect(CASH_COST_ACTIONS).not.toContain(InvestmentAction.BONUS);
    });
  });

  describe.each([InvestmentAction.FEE, InvestmentAction.TAX_WITHHELD])(
    "%s",
    (action) => {
      it("leaves the share count alone", () => {
        expect(applyActionToQuantity(100, action, 50)).toBe(100);
        expect(SHARE_MOVING_ACTIONS).not.toContain(action);
      });

      it("takes the amount from `price`, ignoring any quantity", () => {
        // A fee is not a per-unit figure, so a stray quantity must not multiply
        // it -- the failure mode this ignores.
        expect(computeInvestmentCashImpact(action, 0, 118.5, 0)).toBe(-118.5);
        expect(computeInvestmentCashImpact(action, 7, 118.5, 0)).toBe(-118.5);
      });

      it("is a cost action, so a cash-flow calculation can find it", () => {
        expect(CASH_COST_ACTIONS).toContain(action);
      });

      it("is not a share-moving or income action", () => {
        expect(SHARE_MOVING_ACTIONS).not.toContain(action);
        expect(isQuantityOnlyAction(action)).toBe(false);
      });
    },
  );

  it("keeps the cost actions out of the income set", () => {
    // Income and cost are opposite directions; a report that swept one into the
    // other would invert the sign of every return.
    for (const action of CASH_COST_ACTIONS) {
      expect(computeInvestmentCashImpact(action, 0, 100, 0)).toBeLessThan(0);
    }
  });
});
