import {
  computeBucketSummaries,
  ORDERED_BUDGET_BUCKETS,
  CategoryBreakdownLike,
} from "./utils/budget-bucket-summary.util";
import { BudgetBucket } from "../categories/entities/category.entity";
import { BudgetToleranceStatus } from "./constants/budget-tolerance.enum";

describe("computeBucketSummaries", () => {
  it("aggregates categories into the four canonical buckets plus UNCLASSIFIED", () => {
    const categories: CategoryBreakdownLike[] = [
      {
        budgetCategoryId: "bc-1",
        budgeted: 1000,
        spent: 950,
        isIncome: false,
        budgetBucket: BudgetBucket.NEEDS,
      },
      {
        budgetCategoryId: "bc-2",
        budgeted: 500,
        spent: 520, // +4% within tolerance
        isIncome: false,
        budgetBucket: BudgetBucket.WANTS,
      },
      {
        budgetCategoryId: "bc-3",
        budgeted: 800,
        spent: 800,
        isIncome: false,
        budgetBucket: BudgetBucket.SAVINGS_INVESTMENTS,
      },
      {
        budgetCategoryId: "bc-4",
        budgeted: 1200,
        spent: 1300, // +8.33% over tolerance
        isIncome: false,
        budgetBucket: BudgetBucket.DEBT_SERVICING,
      },
      {
        budgetCategoryId: "bc-5",
        budgeted: 300,
        spent: 150,
        isIncome: false,
        budgetBucket: null, // Unclassified
      },
    ];

    const summaries = computeBucketSummaries(categories);

    expect(summaries).toHaveLength(5);
    expect(summaries.map((s) => s.bucket)).toEqual(ORDERED_BUDGET_BUCKETS);

    // NEEDS
    const needs = summaries.find((s) => s.bucket === BudgetBucket.NEEDS)!;
    expect(needs.budgeted).toBe(1000);
    expect(needs.spent).toBe(950);
    expect(needs.remaining).toBe(50);
    expect(needs.percentUsed).toBe(95);
    expect(needs.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);
    expect(needs.categoryCount).toBe(1);

    // WANTS: 500 budgeted, 520 spent (4% over)
    const wants = summaries.find((s) => s.bucket === BudgetBucket.WANTS)!;
    expect(wants.budgeted).toBe(500);
    expect(wants.spent).toBe(520);
    expect(wants.remaining).toBe(-20);
    expect(wants.percentUsed).toBe(104);
    expect(wants.toleranceStatus).toBe(BudgetToleranceStatus.WITHIN_TOLERANCE);
    expect(wants.categoryCount).toBe(1);

    // SAVINGS_INVESTMENTS: 800 budgeted, 800 spent (0% variance)
    const savings = summaries.find(
      (s) => s.bucket === BudgetBucket.SAVINGS_INVESTMENTS,
    )!;
    expect(savings.budgeted).toBe(800);
    expect(savings.spent).toBe(800);
    expect(savings.remaining).toBe(0);
    expect(savings.percentUsed).toBe(100);
    expect(savings.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);
    expect(savings.categoryCount).toBe(1);

    // DEBT_SERVICING: 1200 budgeted, 1300 spent (8.33% over)
    const debt = summaries.find(
      (s) => s.bucket === BudgetBucket.DEBT_SERVICING,
    )!;
    expect(debt.budgeted).toBe(1200);
    expect(debt.spent).toBe(1300);
    expect(debt.remaining).toBe(-100);
    expect(debt.percentUsed).toBe(108.33);
    expect(debt.toleranceStatus).toBe(BudgetToleranceStatus.OVER_TOLERANCE);
    expect(debt.categoryCount).toBe(1);

    // UNCLASSIFIED: 300 budgeted, 150 spent (50% used)
    const unclassified = summaries.find((s) => s.bucket === "UNCLASSIFIED")!;
    expect(unclassified.budgeted).toBe(300);
    expect(unclassified.spent).toBe(150);
    expect(unclassified.remaining).toBe(150);
    expect(unclassified.percentUsed).toBe(50);
    expect(unclassified.toleranceStatus).toBe(
      BudgetToleranceStatus.UNDER_BUDGET,
    );
    expect(unclassified.categoryCount).toBe(1);
  });

  it("strictly excludes income categories from spending buckets", () => {
    const categories: CategoryBreakdownLike[] = [
      {
        budgetCategoryId: "bc-inc",
        budgeted: 5000,
        spent: 5200,
        isIncome: true,
        budgetBucket: BudgetBucket.SAVINGS_INVESTMENTS, // should be ignored because isIncome=true
      },
      {
        budgetCategoryId: "bc-exp",
        budgeted: 1000,
        spent: 800,
        isIncome: false,
        budgetBucket: BudgetBucket.NEEDS,
      },
    ];

    const summaries = computeBucketSummaries(categories);
    const savings = summaries.find(
      (s) => s.bucket === BudgetBucket.SAVINGS_INVESTMENTS,
    )!;
    expect(savings.budgeted).toBe(0);
    expect(savings.spent).toBe(0);
    expect(savings.categoryCount).toBe(0);
    expect(savings.toleranceStatus).toBe(BudgetToleranceStatus.NOT_APPLICABLE);

    const needs = summaries.find((s) => s.bucket === BudgetBucket.NEEDS)!;
    expect(needs.budgeted).toBe(1000);
    expect(needs.spent).toBe(800);
    expect(needs.categoryCount).toBe(1);
  });

  it("handles empty buckets gracefully with zero values and NOT_APPLICABLE tolerance", () => {
    const summaries = computeBucketSummaries([]);

    expect(summaries).toHaveLength(5);
    for (const s of summaries) {
      expect(s.budgeted).toBe(0);
      expect(s.spent).toBe(0);
      expect(s.remaining).toBe(0);
      expect(s.percentUsed).toBe(0);
      expect(s.categoryCount).toBe(0);
      expect(s.toleranceStatus).toBe(BudgetToleranceStatus.NOT_APPLICABLE);
      expect(s.varianceRatio).toBeNull();
    }
  });

  it("aggregates multiple categories in the same bucket with exact decimal money sums", () => {
    const categories: CategoryBreakdownLike[] = [
      {
        budgetCategoryId: "bc-groceries",
        budgeted: 450.25,
        spent: 420.1,
        isIncome: false,
        budgetBucket: BudgetBucket.NEEDS,
      },
      {
        budgetCategoryId: "bc-utilities",
        budgeted: 150.75,
        spent: 160.4,
        isIncome: false,
        budgetBucket: BudgetBucket.NEEDS,
      },
    ];

    const summaries = computeBucketSummaries(categories);
    const needs = summaries.find((s) => s.bucket === BudgetBucket.NEEDS)!;

    // 450.25 + 150.75 = 601.00
    expect(needs.budgeted).toBe(601);
    // 420.10 + 160.40 = 580.50
    expect(needs.spent).toBe(580.5);
    // 601.00 - 580.50 = 20.50
    expect(needs.remaining).toBe(20.5);
    expect(needs.categoryCount).toBe(2);
    expect(needs.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);
  });
});
