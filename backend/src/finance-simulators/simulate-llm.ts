import { z } from "zod";
import { numberArg } from "../common/tool-schemas";
import { simulateDebtPayoff } from "./debt-payoff";
import { compareSavingsIncrease } from "./fire";

const money = numberArg(z.number().min(0).max(1e12));

export const PLAN_SIMULATE_OPERATIONS = ["debt_payoff", "fire"] as const;

const debtSchema = z.object({
  name: z.string().min(1).max(100),
  balance: money,
  aprPct: numberArg(z.number().min(0).max(100)),
  minPayment: money,
});

/** One schema for both the AI Assistant and the MCP tool. */
export const planSimulateSchema = z.object({
  operation: z.enum(PLAN_SIMULATE_OPERATIONS),
  debts: z.array(debtSchema).max(25).optional(),
  extraMonthly: money.optional(),
  currentCorpus: money.optional(),
  monthlySavings: money.optional(),
  realAnnualReturnPct: numberArg(z.number().min(-50).max(100)).optional(),
  annualExpenses: money.optional(),
  withdrawalRatePct: numberArg(z.number().gt(0).max(100)).optional(),
  extraMonthlySavings: money.optional(),
});

export type PlanSimulateInput = z.infer<typeof planSimulateSchema>;

export type PlanSimulateResult =
  | { readonly error: string }
  | ({
      readonly operation: string;
      readonly evidence: Record<string, unknown>;
    } & Record<string, unknown>);

/**
 * The one implementation behind the AI Assistant's and MCP's `plan_simulate`.
 * Pure: every figure comes from the tested simulators, from inputs the caller
 * states. Missing required inputs are an error, never a default of zero.
 */
export function runPlanSimulation(
  input: PlanSimulateInput,
): PlanSimulateResult {
  if (input.operation === "debt_payoff") {
    if (!input.debts || input.debts.length === 0) {
      return { error: "debts is required for debt_payoff." };
    }
    const extra = input.extraMonthly ?? 0;
    return {
      operation: input.operation,
      evidence: { debts: input.debts, extraMonthly: extra },
      snowball: simulateDebtPayoff(input.debts, extra, "snowball"),
      avalanche: simulateDebtPayoff(input.debts, extra, "avalanche"),
    };
  }
  const missing = (
    [
      "currentCorpus",
      "monthlySavings",
      "realAnnualReturnPct",
      "annualExpenses",
    ] as const
  ).filter((k) => input[k] === undefined);
  if (missing.length > 0) {
    return { error: `${missing.join(", ")} required for fire.` };
  }
  const fireInput = {
    currentCorpus: input.currentCorpus as number,
    monthlySavings: input.monthlySavings as number,
    realAnnualReturnPct: input.realAnnualReturnPct as number,
    annualExpenses: input.annualExpenses as number,
    withdrawalRatePct: input.withdrawalRatePct,
  };
  const cmp = compareSavingsIncrease(fireInput, input.extraMonthlySavings ?? 0);
  return {
    operation: input.operation,
    evidence: {
      ...fireInput,
      extraMonthlySavings: input.extraMonthlySavings ?? 0,
    },
    base: cmp.base,
    withExtra: input.extraMonthlySavings ? cmp.withExtra : null,
    monthsSaved: input.extraMonthlySavings ? cmp.monthsSaved : null,
  };
}
