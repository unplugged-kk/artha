export enum GoalType {
  REGULAR = "REGULAR",
  EMERGENCY_FUND = "EMERGENCY_FUND",
}

export enum GoalStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

export enum GoalTargetMode {
  FIXED_AMOUNT = "FIXED_AMOUNT",
  MONTHS_OF_EXPENSES = "MONTHS_OF_EXPENSES",
}

export enum GoalContributionStatus {
  ON_TRACK = "ON_TRACK",
  COMPLETED = "COMPLETED",
  DUE_NOW = "DUE_NOW",
  EXPIRED = "EXPIRED",
  UNAVAILABLE = "UNAVAILABLE",
}
