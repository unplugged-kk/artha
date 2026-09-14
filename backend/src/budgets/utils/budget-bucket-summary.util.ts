import { BudgetBucket } from "../../categories/entities/category.entity";
import { BudgetToleranceStatus } from "../constants/budget-tolerance.enum";
import { calculateBudgetTolerance } from "./budget-tolerance.util";
import { roundMoney, sumMoney } from "../../common/round.util";

export interface BudgetBucketSummaryItem {
  bucket: BudgetBucket | "UNCLASSIFIED";
  budgeted: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  varianceRatio: number | null;
  toleranceStatus: BudgetToleranceStatus;
  categoryCount: number;
}

export interface CategoryBreakdownLike {
  budgetCategoryId: string;
  budgeted: number;
  spent: number;
  isIncome: boolean;
  budgetBucket?: BudgetBucket | null;
}

export const ORDERED_BUDGET_BUCKETS: Array<BudgetBucket | "UNCLASSIFIED"> = [
  BudgetBucket.NEEDS,
  BudgetBucket.WANTS,
  BudgetBucket.SAVINGS_INVESTMENTS,
  BudgetBucket.DEBT_SERVICING,
  "UNCLASSIFIED",
];

export function computeBucketSummaries(
  categories: CategoryBreakdownLike[],
): BudgetBucketSummaryItem[] {
  // Only expense categories are grouped into spending buckets.
  // Transfers mapped to a budget category (such as debt servicing or savings) with isIncome = false are included.
  const expenseCategories = categories.filter((c) => !c.isIncome);

  const groups = new Map<
    BudgetBucket | "UNCLASSIFIED",
    { budgetedList: number[]; spentList: number[]; count: number }
  >();

  for (const b of ORDERED_BUDGET_BUCKETS) {
    groups.set(b, { budgetedList: [], spentList: [], count: 0 });
  }

  for (const cat of expenseCategories) {
    const bucketKey: BudgetBucket | "UNCLASSIFIED" =
      cat.budgetBucket ?? "UNCLASSIFIED";
    const group = groups.get(bucketKey);
    if (group) {
      group.budgetedList.push(cat.budgeted);
      group.spentList.push(cat.spent);
      group.count += 1;
    }
  }

  return ORDERED_BUDGET_BUCKETS.map((bucket) => {
    const data = groups.get(bucket)!;
    const budgeted = sumMoney(data.budgetedList);
    const spent = sumMoney(data.spentList);
    const remaining = roundMoney(budgeted - spent);
    const percentUsed =
      budgeted > 0 ? Math.round((spent / budgeted) * 10000) / 100 : 0;
    const { varianceRatio, toleranceStatus } = calculateBudgetTolerance(
      budgeted,
      spent,
      false,
      bucket === "UNCLASSIFIED" ? null : bucket,
    );

    return {
      bucket,
      budgeted,
      spent,
      remaining,
      percentUsed,
      varianceRatio,
      toleranceStatus,
      categoryCount: data.count,
    };
  });
}
