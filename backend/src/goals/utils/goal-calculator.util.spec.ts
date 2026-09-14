import {
  calculateMonthsRemaining,
  calculateGoalProgress,
} from "./goal-calculator.util";
import {
  GoalType,
  GoalStatus,
  GoalTargetMode,
  GoalContributionStatus,
} from "../constants/goal.enums";

describe("goal-calculator.util", () => {
  describe("calculateMonthsRemaining", () => {
    it("returns null when targetDate is null or undefined", () => {
      expect(calculateMonthsRemaining(null)).toBeNull();
      expect(calculateMonthsRemaining(undefined)).toBeNull();
    });

    it("returns 0 when targetDate is in the past", () => {
      const refDate = new Date(2026, 8, 14); // 2026-09-14
      expect(calculateMonthsRemaining("2026-08-31", refDate)).toBe(0);
      expect(calculateMonthsRemaining("2025-12-31", refDate)).toBe(0);
    });

    it("returns 1 when targetDate is in the current month or 1 month away", () => {
      const refDate = new Date(2026, 8, 14); // 2026-09-14
      expect(calculateMonthsRemaining("2026-09-30", refDate)).toBe(1);
      expect(calculateMonthsRemaining("2026-10-14", refDate)).toBe(1);
    });

    it("returns exact month difference when targetDate is multiple months away", () => {
      const refDate = new Date(2026, 8, 14); // 2026-09-14
      expect(calculateMonthsRemaining("2026-12-31", refDate)).toBe(3);
      expect(calculateMonthsRemaining("2027-09-14", refDate)).toBe(12);
    });
  });

  describe("calculateGoalProgress", () => {
    const refDate = new Date(2026, 8, 14); // 2026-09-14

    it("calculates fixed amount progress correctly", () => {
      const progress = calculateGoalProgress({
        type: GoalType.REGULAR,
        status: GoalStatus.ACTIVE,
        targetMode: GoalTargetMode.FIXED_AMOUNT,
        targetAmount: 10000,
        targetMonths: null,
        currency: "USD",
        targetDate: "2026-12-31", // 3 months away
        currentAmount: 4000,
        baselineMonthlyExpense: null,
        referenceDate: refDate,
      });

      expect(progress.targetAmount).toBe(10000);
      expect(progress.currentAmount).toBe(4000);
      expect(progress.percentage).toBe(40);
      expect(progress.remainingAmount).toBe(6000);
      expect(progress.monthsRemaining).toBe(3);
      expect(progress.requiredMonthlyContribution).toBe(2000); // 6000 / 3
      expect(progress.contributionStatus).toBe(GoalContributionStatus.ON_TRACK);
    });

    it("calculates emergency fund with months of expenses mode", () => {
      const progress = calculateGoalProgress({
        type: GoalType.EMERGENCY_FUND,
        status: GoalStatus.ACTIVE,
        targetMode: GoalTargetMode.MONTHS_OF_EXPENSES,
        targetAmount: null,
        targetMonths: 6,
        currency: "USD",
        targetDate: "2027-03-31", // 6 months away
        currentAmount: 9000,
        baselineMonthlyExpense: 3000,
        referenceDate: refDate,
      });

      expect(progress.targetAmount).toBe(18000); // 3000 * 6
      expect(progress.baselineMonthlyExpense).toBe(3000);
      expect(progress.currentAmount).toBe(9000);
      expect(progress.percentage).toBe(50);
      expect(progress.remainingAmount).toBe(9000);
      expect(progress.monthsRemaining).toBe(6);
      expect(progress.requiredMonthlyContribution).toBe(1500); // 9000 / 6
      expect(progress.contributionStatus).toBe(GoalContributionStatus.ON_TRACK);
    });

    it("returns UNAVAILABLE status and null target when essential expenses baseline is missing for emergency fund", () => {
      const progress = calculateGoalProgress({
        type: GoalType.EMERGENCY_FUND,
        status: GoalStatus.ACTIVE,
        targetMode: GoalTargetMode.MONTHS_OF_EXPENSES,
        targetAmount: null,
        targetMonths: 6,
        currency: "USD",
        targetDate: "2027-03-31",
        currentAmount: 5000,
        baselineMonthlyExpense: null, // No budget data available
        referenceDate: refDate,
      });

      expect(progress.targetAmount).toBeNull();
      expect(progress.percentage).toBeNull();
      expect(progress.remainingAmount).toBeNull();
      expect(progress.requiredMonthlyContribution).toBeNull();
      expect(progress.contributionStatus).toBe(
        GoalContributionStatus.UNAVAILABLE,
      );
    });

    it("handles completed goal when currentAmount meets or exceeds target", () => {
      const progress = calculateGoalProgress({
        type: GoalType.REGULAR,
        status: GoalStatus.ACTIVE,
        targetMode: GoalTargetMode.FIXED_AMOUNT,
        targetAmount: 5000,
        targetMonths: null,
        currency: "USD",
        targetDate: "2026-12-31",
        currentAmount: 5500,
        baselineMonthlyExpense: null,
        referenceDate: refDate,
      });

      expect(progress.percentage).toBe(110);
      expect(progress.remainingAmount).toBe(0);
      expect(progress.requiredMonthlyContribution).toBe(0);
      expect(progress.contributionStatus).toBe(
        GoalContributionStatus.COMPLETED,
      );
    });

    it("handles goal with status COMPLETED explicitly", () => {
      const progress = calculateGoalProgress({
        type: GoalType.REGULAR,
        status: GoalStatus.COMPLETED,
        targetMode: GoalTargetMode.FIXED_AMOUNT,
        targetAmount: 5000,
        targetMonths: null,
        currency: "USD",
        targetDate: "2026-12-31",
        currentAmount: 3000,
        baselineMonthlyExpense: null,
        referenceDate: refDate,
      });

      expect(progress.requiredMonthlyContribution).toBe(0);
      expect(progress.contributionStatus).toBe(
        GoalContributionStatus.COMPLETED,
      );
    });

    it("handles DUE_NOW status when monthsRemaining is 1", () => {
      const progress = calculateGoalProgress({
        type: GoalType.REGULAR,
        status: GoalStatus.ACTIVE,
        targetMode: GoalTargetMode.FIXED_AMOUNT,
        targetAmount: 5000,
        targetMonths: null,
        currency: "USD",
        targetDate: "2026-10-01", // 1 month away
        currentAmount: 2000,
        baselineMonthlyExpense: null,
        referenceDate: refDate,
      });

      expect(progress.monthsRemaining).toBe(1);
      expect(progress.contributionStatus).toBe(GoalContributionStatus.DUE_NOW);
      expect(progress.requiredMonthlyContribution).toBe(3000);
    });

    it("handles EXPIRED status when target date has passed and goal is incomplete", () => {
      const progress = calculateGoalProgress({
        type: GoalType.REGULAR,
        status: GoalStatus.ACTIVE,
        targetMode: GoalTargetMode.FIXED_AMOUNT,
        targetAmount: 5000,
        targetMonths: null,
        currency: "USD",
        targetDate: "2026-08-01", // past date
        currentAmount: 2000,
        baselineMonthlyExpense: null,
        referenceDate: refDate,
      });

      expect(progress.monthsRemaining).toBe(0);
      expect(progress.contributionStatus).toBe(GoalContributionStatus.EXPIRED);
      expect(progress.requiredMonthlyContribution).toBeNull();
    });

    it("handles isFxUnavailable flag correctly", () => {
      const progress = calculateGoalProgress({
        type: GoalType.REGULAR,
        status: GoalStatus.ACTIVE,
        targetMode: GoalTargetMode.FIXED_AMOUNT,
        targetAmount: 5000,
        targetMonths: null,
        currency: "EUR",
        targetDate: "2026-12-31",
        currentAmount: 2000,
        baselineMonthlyExpense: null,
        isFxUnavailable: true,
        referenceDate: refDate,
      });

      expect(progress.isFxUnavailable).toBe(true);
      expect(progress.currentAmount).toBeNull();
      expect(progress.percentage).toBeNull();
      expect(progress.remainingAmount).toBeNull();
      expect(progress.contributionStatus).toBe(
        GoalContributionStatus.UNAVAILABLE,
      );
    });
  });
});
