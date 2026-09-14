import { roundMoney, roundToDecimals } from "../../common/round.util";
import {
  GoalType,
  GoalStatus,
  GoalTargetMode,
  GoalContributionStatus,
} from "../constants/goal.enums";
import { GoalProgress } from "../interfaces/goal-progress.interface";

export interface CalculateProgressInput {
  type: GoalType;
  status: GoalStatus;
  targetMode: GoalTargetMode;
  targetAmount: number | null;
  targetMonths: number | null;
  currency: string;
  targetDate: string | null;
  currentAmount: number | null;
  baselineMonthlyExpense: number | null;
  isFxUnavailable?: boolean;
  referenceDate?: Date;
  linkedAccount?: {
    id: string;
    name: string;
    currency: string;
    balance: number;
  } | null;
  linkedTransactionCount?: number;
}

/**
 * Calculate the number of whole months remaining until the target date.
 * Returns:
 * - null if targetDate is not specified.
 * - 0 if targetDate is in the past.
 * - 1 if targetDate is in the current month or within 1 month.
 * - >1 for future months.
 */
export function calculateMonthsRemaining(
  targetDate: string | Date | null | undefined,
  referenceDate: Date = new Date(),
): number | null {
  if (!targetDate) return null;

  const target =
    typeof targetDate === "string"
      ? new Date(targetDate + (targetDate.includes("T") ? "" : "T00:00:00"))
      : targetDate;

  if (isNaN(target.getTime())) return null;

  const refDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  if (targetDay.getTime() < refDay.getTime()) {
    return 0; // Target is in the past
  }

  const monthDiff =
    (target.getFullYear() - referenceDate.getFullYear()) * 12 +
    (target.getMonth() - referenceDate.getMonth());

  return Math.max(1, monthDiff);
}

/**
 * Derives comprehensive financial progress, pacing, and contribution requirements
 * for a goal without mutating underlying account balances or transaction records.
 */
export function calculateGoalProgress(
  input: CalculateProgressInput,
): GoalProgress {
  const {
    status,
    targetMode,
    targetAmount: rawTargetAmount,
    targetMonths,
    targetDate,
    currentAmount,
    baselineMonthlyExpense,
    isFxUnavailable = false,
    referenceDate = new Date(),
    linkedAccount = null,
    linkedTransactionCount = 0,
  } = input;

  // Resolve target amount based on mode
  let effectiveTargetAmount: number | null = null;
  if (targetMode === GoalTargetMode.FIXED_AMOUNT) {
    effectiveTargetAmount =
      rawTargetAmount !== null && rawTargetAmount !== undefined
        ? roundMoney(rawTargetAmount)
        : null;
  } else if (targetMode === GoalTargetMode.MONTHS_OF_EXPENSES) {
    if (
      baselineMonthlyExpense !== null &&
      baselineMonthlyExpense > 0 &&
      targetMonths !== null &&
      targetMonths !== undefined &&
      targetMonths > 0
    ) {
      effectiveTargetAmount = roundMoney(baselineMonthlyExpense * targetMonths);
    } else {
      effectiveTargetAmount = null;
    }
  }

  const roundedCurrentAmount =
    currentAmount !== null && currentAmount !== undefined
      ? roundMoney(currentAmount)
      : null;

  const monthsRemaining = calculateMonthsRemaining(targetDate, referenceDate);

  // Percentage
  let percentage: number | null = null;
  if (
    !isFxUnavailable &&
    roundedCurrentAmount !== null &&
    effectiveTargetAmount !== null &&
    effectiveTargetAmount > 0
  ) {
    percentage = roundToDecimals(
      Math.max(0, (roundedCurrentAmount / effectiveTargetAmount) * 100),
      2,
    );
  }

  // Remaining Amount
  let remainingAmount: number | null = null;
  if (
    !isFxUnavailable &&
    roundedCurrentAmount !== null &&
    effectiveTargetAmount !== null
  ) {
    remainingAmount = roundMoney(
      Math.max(0, effectiveTargetAmount - roundedCurrentAmount),
    );
  }

  // Determine contribution status
  let contributionStatus: GoalContributionStatus;
  if (status === GoalStatus.COMPLETED) {
    contributionStatus = GoalContributionStatus.COMPLETED;
  } else if (
    isFxUnavailable ||
    effectiveTargetAmount === null ||
    roundedCurrentAmount === null
  ) {
    contributionStatus = GoalContributionStatus.UNAVAILABLE;
  } else if (
    effectiveTargetAmount > 0 &&
    roundedCurrentAmount >= effectiveTargetAmount
  ) {
    contributionStatus = GoalContributionStatus.COMPLETED;
  } else if (targetDate && monthsRemaining === 0) {
    contributionStatus = GoalContributionStatus.EXPIRED;
  } else if (targetDate && monthsRemaining === 1) {
    contributionStatus = GoalContributionStatus.DUE_NOW;
  } else {
    contributionStatus = GoalContributionStatus.ON_TRACK;
  }

  // Required Monthly Contribution
  let requiredMonthlyContribution: number | null = null;
  if (
    status === GoalStatus.COMPLETED ||
    (effectiveTargetAmount !== null &&
      roundedCurrentAmount !== null &&
      roundedCurrentAmount >= effectiveTargetAmount)
  ) {
    requiredMonthlyContribution = 0;
  } else if (
    effectiveTargetAmount === null ||
    roundedCurrentAmount === null ||
    remainingAmount === null ||
    monthsRemaining === null ||
    monthsRemaining <= 0
  ) {
    requiredMonthlyContribution = null;
  } else {
    requiredMonthlyContribution = roundMoney(remainingAmount / monthsRemaining);
  }

  return {
    currentAmount: isFxUnavailable ? null : roundedCurrentAmount,
    targetAmount: effectiveTargetAmount,
    percentage,
    remainingAmount,
    monthsRemaining,
    requiredMonthlyContribution,
    contributionStatus,
    isFxUnavailable: isFxUnavailable ? true : undefined,
    baselineMonthlyExpense:
      baselineMonthlyExpense !== null
        ? roundMoney(baselineMonthlyExpense)
        : null,
    linkedAccount,
    linkedTransactionCount,
  };
}
