import { BudgetToleranceStatus } from "../constants/budget-tolerance.enum";
import { BudgetBucket } from "../../categories/entities/category.entity";

export interface BudgetToleranceResult {
  varianceRatio: number | null;
  toleranceStatus: BudgetToleranceStatus;
}

/**
 * Calculates budget-vs-actual variance ratio and 5% tolerance status.
 *
 * For expense budgets:
 * - budgeted <= 0: NOT_APPLICABLE (varianceRatio = null, avoids divide-by-zero)
 * - varianceRatio = (spent - budgeted) / budgeted
 * - spent <= budgeted (varianceRatio <= 0): UNDER_BUDGET
 * - varianceRatio > 0 && varianceRatio <= 0.05: WITHIN_TOLERANCE (within 5% over budget, exact 5% included)
 * - varianceRatio > 0.05: OVER_TOLERANCE (> 5% over budget)
 *
 * For income budgets:
 * - budgeted <= 0: NOT_APPLICABLE
 * - varianceRatio = (actualIncome - budgeted) / budgeted
 * - actualIncome >= budgeted (varianceRatio >= 0): UNDER_BUDGET (met or exceeded target)
 * - varianceRatio < 0 && varianceRatio >= -0.05: WITHIN_TOLERANCE (within 5% below target)
 * - varianceRatio < -0.05: OVER_TOLERANCE (more than 5% below target)
 */
export function calculateBudgetTolerance(
  budgeted: number,
  spent: number,
  isIncome = false,
  _bucket?: BudgetBucket | null,
): BudgetToleranceResult {
  if (budgeted <= 0) {
    return {
      varianceRatio: null,
      toleranceStatus: BudgetToleranceStatus.NOT_APPLICABLE,
    };
  }

  const rawRatio = (spent - budgeted) / budgeted;
  // Round ratio to 6 decimal places to prevent floating point artifacts at exact boundary (e.g. 0.050000000000000044)
  const varianceRatio = Math.round(rawRatio * 1_000_000) / 1_000_000;

  if (isIncome) {
    if (varianceRatio >= 0) {
      return {
        varianceRatio,
        toleranceStatus: BudgetToleranceStatus.UNDER_BUDGET,
      };
    }
    if (varianceRatio >= -0.05) {
      return {
        varianceRatio,
        toleranceStatus: BudgetToleranceStatus.WITHIN_TOLERANCE,
      };
    }
    return {
      varianceRatio,
      toleranceStatus: BudgetToleranceStatus.OVER_TOLERANCE,
    };
  }

  if (varianceRatio <= 0) {
    return {
      varianceRatio,
      toleranceStatus: BudgetToleranceStatus.UNDER_BUDGET,
    };
  }
  if (varianceRatio <= 0.05) {
    return {
      varianceRatio,
      toleranceStatus: BudgetToleranceStatus.WITHIN_TOLERANCE,
    };
  }
  return {
    varianceRatio,
    toleranceStatus: BudgetToleranceStatus.OVER_TOLERANCE,
  };
}
