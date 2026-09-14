export type GoalType = 'REGULAR' | 'EMERGENCY_FUND';

export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type GoalTargetMode = 'FIXED_AMOUNT' | 'MONTHS_OF_EXPENSES';

export type GoalContributionStatus =
  | 'ON_TRACK'
  | 'COMPLETED'
  | 'DUE_NOW'
  | 'EXPIRED'
  | 'UNAVAILABLE';

export interface GoalProgress {
  currentAmount: number | null;
  targetAmount: number | null;
  percentage: number | null;
  remainingAmount: number | null;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  contributionStatus: GoalContributionStatus;
  isFxUnavailable?: boolean;
  baselineMonthlyExpense?: number | null;
  linkedAccount?: {
    id: string;
    name: string;
    currency: string;
    balance: number;
  } | null;
  linkedTransactionCount?: number;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  targetMode: GoalTargetMode;
  targetAmount: number | null;
  targetMonths: number | null;
  currency: string;
  targetDate: string | null;
  accountId: string | null;
  account?: {
    id: string;
    name: string;
    currencyCode: string;
    currentBalance: number;
  } | null;
  createdAt: string;
  updatedAt: string;
  progress: GoalProgress;
}

export interface CreateGoalInput {
  name: string;
  description?: string;
  type?: GoalType;
  targetMode?: GoalTargetMode;
  targetAmount?: number;
  targetMonths?: number;
  currency: string;
  targetDate?: string;
  accountId?: string;
}

export interface UpdateGoalInput {
  name?: string;
  description?: string | null;
  type?: GoalType;
  status?: GoalStatus;
  targetMode?: GoalTargetMode;
  targetAmount?: number | null;
  targetMonths?: number | null;
  currency?: string;
  targetDate?: string | null;
  accountId?: string | null;
}

export interface GoalsSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  emergencyFundsCount: number;
}
