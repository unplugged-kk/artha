import { getFinancialYearRules } from "./financial-year.config";
import { compareRegimes, deductionHeadroom } from "./tax-calculator";

export const INDIA_TAX_OPERATIONS = [
  "compare_regimes",
  "deduction_headroom",
] as const;
export type IndiaTaxOperation = (typeof INDIA_TAX_OPERATIONS)[number];

export const DEFAULT_TAX_FINANCIAL_YEAR = "FY2025-26";

export interface IndiaTaxToolInput {
  readonly operation: IndiaTaxOperation;
  readonly financialYear?: string;
  readonly grossIncome?: number;
  readonly section80C?: number;
  readonly section80CCD1B?: number;
  readonly section80D?: number;
  readonly seniorCitizen?: boolean;
}

export type IndiaTaxToolResult =
  | { readonly error: string }
  | ({
      readonly operation: IndiaTaxOperation;
      readonly evidence: Record<string, unknown>;
    } & Record<string, unknown>);

/**
 * The one implementation behind the AI Assistant's and the MCP server's
 * `india_tax` tool. Pure: every number comes from tested code, the caller
 * supplies the income and deductions, and `evidence` echoes the inputs and
 * the rules version so the answer can be cited.
 */
export function runIndiaTax(input: IndiaTaxToolInput): IndiaTaxToolResult {
  const label = input.financialYear ?? DEFAULT_TAX_FINANCIAL_YEAR;
  const rules = getFinancialYearRules(label);
  if (!rules) {
    return {
      error: `No tax rules for ${label}. Supported: ${DEFAULT_TAX_FINANCIAL_YEAR}.`,
    };
  }
  const evidence = {
    financialYear: label,
    inputs: {
      grossIncome: input.grossIncome ?? null,
      section80C: input.section80C ?? null,
      section80CCD1B: input.section80CCD1B ?? null,
      section80D: input.section80D ?? null,
      seniorCitizen: input.seniorCitizen ?? false,
    },
  };
  if (input.operation === "compare_regimes") {
    if (input.grossIncome === undefined) {
      return { error: "grossIncome is required for compare_regimes." };
    }
    const result = compareRegimes(
      {
        grossIncome: input.grossIncome,
        section80C: input.section80C,
        section80CCD1B: input.section80CCD1B,
        section80D: input.section80D,
        seniorCitizen: input.seniorCitizen,
      },
      rules,
    );
    return { operation: input.operation, evidence, ...result };
  }
  const result = deductionHeadroom(
    {
      section80C: input.section80C,
      section80CCD1B: input.section80CCD1B,
      section80D: input.section80D,
    },
    rules,
    input.seniorCitizen ?? false,
  );
  return { operation: input.operation, evidence, ...result };
}
