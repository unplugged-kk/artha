import {
  RuleField,
  RuleOperator,
  RuleMatchMode,
} from "../constants/rule.enums";
import {
  RuleCondition,
  RuleEvaluationCandidate,
  RuleMatchResult,
} from "../interfaces/rule.interface";
import { TransactionRule } from "../entities/transaction-rule.entity";

/** Maximum regex pattern length to protect against ReDoS */
const MAX_REGEX_LENGTH = 250;

/**
 * Safely evaluates a single condition against a transaction candidate.
 */
export function evaluateCondition(
  condition: RuleCondition,
  candidate: RuleEvaluationCandidate,
): boolean {
  if (!condition || !condition.field || !condition.operator) {
    return false;
  }

  const { field, operator, value } = condition;

  switch (field) {
    case RuleField.PAYEE:
    case RuleField.MEMO:
    case RuleField.PAYMENT_METHOD: {
      const rawText =
        field === RuleField.PAYEE
          ? candidate.payee
          : field === RuleField.MEMO
            ? candidate.memo
            : candidate.paymentMethod;

      return evaluateStringCondition(rawText, operator, value);
    }

    case RuleField.ACCOUNT_ID: {
      const candAcc = candidate.accountId ?? "";
      const valAcc = String(value ?? "");
      if (operator === RuleOperator.EQUALS) {
        return candAcc === valAcc;
      }
      if (operator === RuleOperator.NOT_EQUALS) {
        return candAcc !== valAcc;
      }
      return false;
    }

    case RuleField.TYPE: {
      // Determine candidate transaction type: 'DEBIT' (expense) or 'CREDIT' (income)
      let candType = candidate.type ?? null;
      if (
        !candType &&
        candidate.amount !== undefined &&
        candidate.amount !== null
      ) {
        const num =
          typeof candidate.amount === "number"
            ? candidate.amount
            : parseFloat(String(candidate.amount));
        if (!isNaN(num)) {
          candType = num < 0 ? "DEBIT" : "CREDIT";
        }
      }

      const valType = String(value ?? "").toUpperCase();
      if (operator === RuleOperator.EQUALS) {
        return candType === valType;
      }
      if (operator === RuleOperator.NOT_EQUALS) {
        return candType !== valType;
      }
      return false;
    }

    case RuleField.AMOUNT: {
      if (candidate.amount === undefined || candidate.amount === null) {
        return false;
      }
      const rawNum =
        typeof candidate.amount === "number"
          ? candidate.amount
          : parseFloat(String(candidate.amount));
      if (isNaN(rawNum)) {
        return false;
      }

      return evaluateNumericCondition(rawNum, operator, value);
    }

    default:
      return false;
  }
}

/**
 * Evaluates string conditions with case-insensitivity and safe regex execution.
 */
function evaluateStringCondition(
  rawText: string | null | undefined,
  operator: RuleOperator,
  value: unknown,
): boolean {
  const text = (rawText ?? "").trim();
  const valStr = String(value ?? "").trim();

  const lowerText = text.toLowerCase();
  const lowerVal = valStr.toLowerCase();

  switch (operator) {
    case RuleOperator.CONTAINS:
      return lowerVal.length > 0 && lowerText.includes(lowerVal);

    case RuleOperator.NOT_CONTAINS:
      return lowerVal.length > 0 && !lowerText.includes(lowerVal);

    case RuleOperator.EQUALS:
      return lowerText === lowerVal;

    case RuleOperator.NOT_EQUALS:
      return lowerText !== lowerVal;

    case RuleOperator.STARTS_WITH:
      return lowerVal.length > 0 && lowerText.startsWith(lowerVal);

    case RuleOperator.ENDS_WITH:
      return lowerVal.length > 0 && lowerText.endsWith(lowerVal);

    case RuleOperator.REGEX: {
      if (!valStr || valStr.length > MAX_REGEX_LENGTH) {
        return false;
      }
      try {
        const re = new RegExp(valStr, "i");
        return re.test(text);
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Evaluates numeric/amount conditions.
 * Supports absolute magnitude comparison for positive thresholds.
 */
function evaluateNumericCondition(
  rawAmount: number,
  operator: RuleOperator,
  value: unknown,
): boolean {
  // Use absolute value when user specifies a positive threshold (e.g. expense > 500)
  const absAmount = Math.abs(rawAmount);

  if (operator === RuleOperator.BETWEEN) {
    if (Array.isArray(value) && value.length === 2) {
      const min = Number(value[0]);
      const max = Number(value[1]);
      if (!isNaN(min) && !isNaN(max)) {
        return (
          absAmount >= Math.min(min, max) && absAmount <= Math.max(min, max)
        );
      }
    }
    return false;
  }

  const target = Number(value);
  if (isNaN(target)) {
    return false;
  }

  // If target is positive, compare against magnitude; if target is negative, compare signed
  const compVal = target >= 0 ? absAmount : rawAmount;

  switch (operator) {
    case RuleOperator.EQUALS:
      return Math.abs(compVal - target) < 0.0001;

    case RuleOperator.NOT_EQUALS:
      return Math.abs(compVal - target) >= 0.0001;

    case RuleOperator.GREATER_THAN:
      return compVal > target;

    case RuleOperator.LESS_THAN:
      return compVal < target;

    default:
      return false;
  }
}

/**
 * Evaluates a single rule against a transaction candidate.
 */
export function evaluateRule(
  rule: Pick<TransactionRule, "isActive" | "conditions" | "matchMode">,
  candidate: RuleEvaluationCandidate,
): boolean {
  if (!rule.isActive) {
    return false;
  }

  if (
    !rule.conditions ||
    !Array.isArray(rule.conditions) ||
    rule.conditions.length === 0
  ) {
    return false;
  }

  if (rule.matchMode === RuleMatchMode.ANY) {
    return rule.conditions.some((cond) => evaluateCondition(cond, candidate));
  }

  // Default is ALL
  return rule.conditions.every((cond) => evaluateCondition(cond, candidate));
}

/**
 * Evaluates a prioritized list of rules against a candidate transaction.
 * Returns the match result of the first satisfying rule, or null.
 */
export function evaluateRules(
  rules: TransactionRule[],
  candidate: RuleEvaluationCandidate,
): RuleMatchResult | null {
  if (!rules || rules.length === 0) {
    return null;
  }

  // Ensure deterministic priority order
  const sorted = [...rules].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });

  for (const rule of sorted) {
    if (evaluateRule(rule, candidate)) {
      return {
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
        actions: rule.actions ?? {},
      };
    }
  }

  return null;
}
