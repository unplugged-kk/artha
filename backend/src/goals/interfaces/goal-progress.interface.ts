import { GoalContributionStatus } from "../constants/goal.enums";
import { Goal } from "../entities/goal.entity";

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

export type GoalWithProgress = Goal & {
  progress: GoalProgress;
};

export interface GoalsSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  emergencyFundsCount: number;
}
