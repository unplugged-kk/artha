import { RuleField, RuleOperator } from "../constants/rule.enums";

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string | number | [number, number];
}

export interface RuleActions {
  setCategoryId?: string | null;
  setPayeeId?: string | null;
  setPayeeName?: string | null;
  addTagIds?: string[];
  stopProcessing?: boolean;
}

export interface RuleEvaluationCandidate {
  payee?: string | null;
  memo?: string | null;
  amount?: number | string | null;
  accountId?: string | null;
  paymentMethod?: string | null;
  type?: "DEBIT" | "CREDIT" | null;
}

export interface RuleMatchResult {
  matchedRuleId: string;
  matchedRuleName: string;
  actions: RuleActions;
}
