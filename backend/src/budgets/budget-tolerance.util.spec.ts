import { calculateBudgetTolerance } from "./utils/budget-tolerance.util";
import { BudgetToleranceStatus } from "./constants/budget-tolerance.enum";
import { BudgetBucket } from "../categories/entities/category.entity";

describe("calculateBudgetTolerance", () => {
  describe("expense budgets (!isIncome)", () => {
    it("handles zero or negative budget as NOT_APPLICABLE with null varianceRatio", () => {
      const zeroBudget = calculateBudgetTolerance(0, 100, false);
      expect(zeroBudget.toleranceStatus).toBe(
        BudgetToleranceStatus.NOT_APPLICABLE,
      );
      expect(zeroBudget.varianceRatio).toBeNull();

      const negBudget = calculateBudgetTolerance(-50, 20, false);
      expect(negBudget.toleranceStatus).toBe(
        BudgetToleranceStatus.NOT_APPLICABLE,
      );
      expect(negBudget.varianceRatio).toBeNull();
    });

    it("identifies under-budget status when spent is strictly less than budgeted", () => {
      const result = calculateBudgetTolerance(1000, 800, false);
      expect(result.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);
      expect(result.varianceRatio).toBe(-0.2);
    });

    it("identifies under-budget status when spent is exactly on budget (0% variance)", () => {
      const result = calculateBudgetTolerance(1000, 1000, false);
      expect(result.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);
      expect(result.varianceRatio).toBe(0);
    });

    it("identifies within-5%-tolerance when spent is slightly over budget (> 0% and <= 5%)", () => {
      // 2% over budget
      const result2pct = calculateBudgetTolerance(1000, 1020, false);
      expect(result2pct.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(result2pct.varianceRatio).toBe(0.02);

      // 4.9% over budget
      const result49pct = calculateBudgetTolerance(1000, 1049, false);
      expect(result49pct.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(result49pct.varianceRatio).toBe(0.049);
    });

    it("identifies exact 5.0% boundary as within-tolerance", () => {
      // Exactly 5% over budget (1050 on 1000)
      const resultExact5 = calculateBudgetTolerance(1000, 1050, false);
      expect(resultExact5.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(resultExact5.varianceRatio).toBe(0.05);

      // Boundary test with fractional cents: budget = 200, spent = 210 (+5.0%)
      const result200 = calculateBudgetTolerance(200, 210, false);
      expect(result200.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(result200.varianceRatio).toBe(0.05);
    });

    it("identifies over-5%-tolerance when spent exceeds 5% boundary (> 0.05)", () => {
      // 5.01% over budget (1050.10 on 1000)
      const result501 = calculateBudgetTolerance(1000, 1050.1, false);
      expect(result501.toleranceStatus).toBe(
        BudgetToleranceStatus.OVER_TOLERANCE,
      );
      expect(result501.varianceRatio).toBeGreaterThan(0.05);

      // 10% over budget
      const result10pct = calculateBudgetTolerance(1000, 1100, false);
      expect(result10pct.toleranceStatus).toBe(
        BudgetToleranceStatus.OVER_TOLERANCE,
      );
      expect(result10pct.varianceRatio).toBe(0.1);

      // 200% over budget
      const resultDouble = calculateBudgetTolerance(500, 1500, false);
      expect(resultDouble.toleranceStatus).toBe(
        BudgetToleranceStatus.OVER_TOLERANCE,
      );
      expect(resultDouble.varianceRatio).toBe(2);
    });

    it("supports passing specific bucket taxonomy classification", () => {
      const needs = calculateBudgetTolerance(
        1000,
        1040,
        false,
        BudgetBucket.NEEDS,
      );
      expect(needs.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );

      const wants = calculateBudgetTolerance(
        500,
        600,
        false,
        BudgetBucket.WANTS,
      );
      expect(wants.toleranceStatus).toBe(BudgetToleranceStatus.OVER_TOLERANCE);

      const debt = calculateBudgetTolerance(
        2000,
        1900,
        false,
        BudgetBucket.DEBT_SERVICING,
      );
      expect(debt.toleranceStatus).toBe(BudgetToleranceStatus.UNDER_BUDGET);
    });
  });

  describe("income budgets (isIncome = true)", () => {
    it("handles zero or negative budget as NOT_APPLICABLE", () => {
      const result = calculateBudgetTolerance(0, 500, true);
      expect(result.toleranceStatus).toBe(BudgetToleranceStatus.NOT_APPLICABLE);
      expect(result.varianceRatio).toBeNull();
    });

    it("identifies on/above target when actual income meets or exceeds target (variance >= 0)", () => {
      const exactTarget = calculateBudgetTolerance(5000, 5000, true);
      expect(exactTarget.toleranceStatus).toBe(
        BudgetToleranceStatus.UNDER_BUDGET,
      );
      expect(exactTarget.varianceRatio).toBe(0);

      const exceededTarget = calculateBudgetTolerance(5000, 5500, true);
      expect(exceededTarget.toleranceStatus).toBe(
        BudgetToleranceStatus.UNDER_BUDGET,
      );
      expect(exceededTarget.varianceRatio).toBe(0.1);
    });

    it("identifies within-tolerance when actual income is within 5% below target", () => {
      // 4% below target (4800 on 5000)
      const withinTol = calculateBudgetTolerance(5000, 4800, true);
      expect(withinTol.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(withinTol.varianceRatio).toBe(-0.04);

      // Exactly 5% below target (4750 on 5000)
      const exact5Below = calculateBudgetTolerance(5000, 4750, true);
      expect(exact5Below.toleranceStatus).toBe(
        BudgetToleranceStatus.WITHIN_TOLERANCE,
      );
      expect(exact5Below.varianceRatio).toBe(-0.05);
    });

    it("identifies over-tolerance (shortfall) when actual income is > 5% below target", () => {
      // 10% below target (4500 on 5000)
      const shortfall = calculateBudgetTolerance(5000, 4500, true);
      expect(shortfall.toleranceStatus).toBe(
        BudgetToleranceStatus.OVER_TOLERANCE,
      );
      expect(shortfall.varianceRatio).toBe(-0.1);
    });
  });
});
