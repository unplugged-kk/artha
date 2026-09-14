import { BudgetBucket, Category } from "../categories/entities/category.entity";
import { BudgetToleranceStatus } from "./constants/budget-tolerance.enum";
import { calculateBudgetTolerance } from "./utils/budget-tolerance.util";
import { computeBucketSummaries } from "./utils/budget-bucket-summary.util";
import { BudgetCategory } from "./entities/budget-category.entity";

describe("Four-Bucket Budget Taxonomy & 5% Tolerance (Priority 12)", () => {
  describe("1. Canonical machine values", () => {
    it("defines exactly the four required canonical machine bucket values", () => {
      expect(BudgetBucket.NEEDS).toBe("NEEDS");
      expect(BudgetBucket.WANTS).toBe("WANTS");
      expect(BudgetBucket.SAVINGS_INVESTMENTS).toBe("SAVINGS_INVESTMENTS");
      expect(BudgetBucket.DEBT_SERVICING).toBe("DEBT_SERVICING");

      const buckets = Object.values(BudgetBucket);
      expect(buckets).toEqual([
        "NEEDS",
        "WANTS",
        "SAVINGS_INVESTMENTS",
        "DEBT_SERVICING",
      ]);
    });
  });

  describe("2. Category-to-bucket mapping & hierarchical inheritance", () => {
    it("resolves bucket directly from category when set", () => {
      const category: Partial<Category> = {
        id: "cat-1",
        name: "Rent",
        budgetBucket: BudgetBucket.NEEDS,
      };
      const bc: Partial<BudgetCategory> = {
        id: "bc-1",
        categoryId: "cat-1",
        category: category as Category,
        budgetBucket: null,
      };

      const resolved =
        bc.budgetBucket ??
        bc.category?.budgetBucket ??
        bc.category?.parent?.budgetBucket ??
        null;

      expect(resolved).toBe(BudgetBucket.NEEDS);
    });

    it("inherits bucket from parent category when child category has none", () => {
      const parent: Partial<Category> = {
        id: "cat-parent",
        name: "Food",
        budgetBucket: BudgetBucket.NEEDS,
      };
      const child: Partial<Category> = {
        id: "cat-child",
        name: "Groceries",
        parent: parent as Category,
        budgetBucket: null,
      };
      const bc: Partial<BudgetCategory> = {
        id: "bc-2",
        categoryId: "cat-child",
        category: child as Category,
        budgetBucket: null,
      };

      const resolved =
        bc.budgetBucket ??
        bc.category?.budgetBucket ??
        bc.category?.parent?.budgetBucket ??
        null;

      expect(resolved).toBe(BudgetBucket.NEEDS);
    });

    it("allows budget category allocation to override category bucket", () => {
      const category: Partial<Category> = {
        id: "cat-trans",
        name: "Vehicle Maintenance",
        budgetBucket: BudgetBucket.NEEDS,
      };
      const bc: Partial<BudgetCategory> = {
        id: "bc-3",
        categoryId: "cat-trans",
        category: category as Category,
        budgetBucket: BudgetBucket.WANTS, // Explicitly overridden for this budget
      };

      const resolved =
        bc.budgetBucket ??
        bc.category?.budgetBucket ??
        bc.category?.parent?.budgetBucket ??
        null;

      expect(resolved).toBe(BudgetBucket.WANTS);
    });

    it("defaults to null (unclassified) when neither category nor parent has a bucket", () => {
      const category: Partial<Category> = {
        id: "cat-misc",
        name: "Misc",
        budgetBucket: null,
      };
      const bc: Partial<BudgetCategory> = {
        id: "bc-4",
        categoryId: "cat-misc",
        category: category as Category,
        budgetBucket: null,
      };

      const resolved =
        bc.budgetBucket ??
        bc.category?.budgetBucket ??
        bc.category?.parent?.budgetBucket ??
        null;

      expect(resolved).toBeNull();
    });

    it("supports transfer budget lines (e.g. debt repayment or savings transfer) carrying an explicit bucket", () => {
      const bcTransfer: Partial<BudgetCategory> = {
        id: "bc-transfer-loan",
        categoryId: null,
        transferAccountId: "loan-acc-1",
        isTransfer: true,
        budgetBucket: BudgetBucket.DEBT_SERVICING,
      };

      const resolved =
        bcTransfer.budgetBucket ??
        bcTransfer.category?.budgetBucket ??
        bcTransfer.category?.parent?.budgetBucket ??
        null;

      expect(resolved).toBe(BudgetBucket.DEBT_SERVICING);
    });
  });

  describe("3. 5% Tolerance Boundary Specifications", () => {
    it("boundary test: 0% variance (exact budget) is UNDER_BUDGET", () => {
      const result = calculateBudgetTolerance(1000, 1000, false);
      expect(result.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);
      expect(result.varianceRatio).toBe(0);
    });

    it("boundary test: 4.999% variance is WITHIN_TOLERANCE", () => {
      const result = calculateBudgetTolerance(1000, 1049.99, false);
      expect(result.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(result.varianceRatio).toBe(0.04999);
    });

    it("boundary test: exact 5.000% variance is WITHIN_TOLERANCE", () => {
      const result = calculateBudgetTolerance(1000, 1050, false);
      expect(result.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(result.varianceRatio).toBe(0.05);
    });

    it("boundary test: 5.001% variance is OVER_TOLERANCE", () => {
      const result = calculateBudgetTolerance(1000, 1050.01, false);
      expect(result.toleranceStatus).toBe(BudgetToleranceStatus.OVER_TOLERANCE);
      expect(result.varianceRatio).toBeGreaterThan(0.05);
    });

    it("boundary test: zero-budget handling prevents divide-by-zero", () => {
      const result = calculateBudgetTolerance(0, 50, false);
      expect(result.toleranceStatus).toBe(BudgetToleranceStatus.NOT_APPLICABLE);
      expect(result.varianceRatio).toBeNull();
    });
  });

  describe("4. Four-Bucket Summary Aggregation", () => {
    it("aggregates all four buckets and unclassified items into a complete overview", () => {
      const items = [
        {
          budgetCategoryId: "1",
          budgeted: 2000,
          spent: 2050, // +2.5% within tolerance
          isIncome: false,
          budgetBucket: BudgetBucket.NEEDS,
        },
        {
          budgetCategoryId: "2",
          budgeted: 1000,
          spent: 1080, // +8% over tolerance
          isIncome: false,
          budgetBucket: BudgetBucket.WANTS,
        },
        {
          budgetCategoryId: "3",
          budgeted: 1500,
          spent: 1500, // on budget
          isIncome: false,
          budgetBucket: BudgetBucket.SAVINGS_INVESTMENTS,
        },
        {
          budgetCategoryId: "4",
          budgeted: 800,
          spent: 750, // under budget
          isIncome: false,
          budgetBucket: BudgetBucket.DEBT_SERVICING,
        },
        {
          budgetCategoryId: "5",
          budgeted: 200,
          spent: 100, // under budget
          isIncome: false,
          budgetBucket: null, // UNCLASSIFIED
        },
      ];

      const summaries = computeBucketSummaries(items);

      const needs = summaries.find((s) => s.bucket === BudgetBucket.NEEDS)!;
      expect(needs.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );

      const wants = summaries.find((s) => s.bucket === BudgetBucket.WANTS)!;
      expect(wants.toleranceStatus).toBe(BudgetToleranceStatus.OVER_TOLERANCE);

      const savings = summaries.find(
        (s) => s.bucket === BudgetBucket.SAVINGS_INVESTMENTS,
      )!;
      expect(savings.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);

      const debt = summaries.find(
        (s) => s.bucket === BudgetBucket.DEBT_SERVICING,
      )!;
      expect(debt.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);

      const unclassified = summaries.find((s) => s.bucket === "UNCLASSIFIED")!;
      expect(unclassified.toleranceStatus).toBe(
        BudgetToleranceStatus.UNDER_BUDGET,
      );
    });
  });
});
