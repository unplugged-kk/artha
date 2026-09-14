export enum BudgetBucket {
  NEEDS = "NEEDS",
  WANTS = "WANTS",
  SAVINGS_INVESTMENTS = "SAVINGS_INVESTMENTS",
  DEBT_SERVICING = "DEBT_SERVICING",
}

export const VALID_BUDGET_BUCKETS = Object.values(BudgetBucket);
