import {
  FinancialYearRules,
  RegimeRules,
  TaxSlab,
} from "./financial-year.config";

export interface TaxInput {
  /** Gross salary / business income for the year, whole rupees. */
  readonly grossIncome: number;
  /** Old-regime deductions claimed (ignored by the new regime). */
  readonly section80C?: number;
  readonly section80CCD1B?: number;
  readonly section80D?: number;
  readonly seniorCitizen?: boolean;
}

export interface RegimeResult {
  readonly taxableIncome: number;
  readonly slabTax: number;
  readonly rebate: number;
  readonly cess: number;
  readonly totalTax: number;
}

export type RegimeComparison =
  | {
      readonly supported: true;
      readonly financialYear: string;
      readonly old: RegimeResult;
      readonly new: RegimeResult;
      readonly better: "old" | "new" | "equal";
      readonly saving: number;
    }
  | {
      readonly supported: false;
      readonly financialYear: string;
      readonly reason: string;
    };

function slabTax(taxable: number, slabs: readonly TaxSlab[]): number {
  let tax = 0;
  let lower = 0;
  for (const slab of slabs) {
    const upper = slab.upTo ?? Number.POSITIVE_INFINITY;
    if (taxable > lower) {
      tax += (Math.min(taxable, upper) - lower) * slab.rate;
    }
    lower = upper;
  }
  return Math.round(tax);
}

function computeRegime(
  taxable: number,
  regime: RegimeRules,
  cessRate: number,
): RegimeResult {
  const base = slabTax(taxable, regime.slabs);
  let rebate = 0;
  if (taxable <= regime.rebateThreshold) {
    rebate = Math.min(base, regime.rebateMax);
  } else if (regime.marginalRelief) {
    // Tax may not exceed the income above the threshold.
    rebate = Math.max(0, base - (taxable - regime.rebateThreshold));
  }
  const afterRebate = base - rebate;
  const cess = Math.round(afterRebate * cessRate);
  return {
    taxableIncome: taxable,
    slabTax: base,
    rebate,
    cess,
    totalTax: afterRebate + cess,
  };
}

function clamp(value: number | undefined, cap: number): number {
  return Math.min(Math.max(value ?? 0, 0), cap);
}

export function compareRegimes(
  input: TaxInput,
  rules: FinancialYearRules,
): RegimeComparison {
  const gross = Math.max(0, Math.round(input.grossIncome));
  const d = rules.deductions;
  const oldDeductions =
    rules.oldRegime.standardDeduction +
    clamp(input.section80C, d.section80C) +
    clamp(input.section80CCD1B, d.section80CCD1B) +
    clamp(
      input.section80D,
      input.seniorCitizen ? d.section80DSelfSenior : d.section80DSelf,
    );
  const oldTaxable = Math.max(0, gross - oldDeductions);
  const newTaxable = Math.max(0, gross - rules.newRegime.standardDeduction);

  if (
    oldTaxable > rules.surchargeThreshold ||
    newTaxable > rules.surchargeThreshold
  ) {
    return {
      supported: false,
      financialYear: rules.label,
      reason: "surcharge_not_modelled",
    };
  }

  const old = computeRegime(oldTaxable, rules.oldRegime, rules.cessRate);
  const next = computeRegime(newTaxable, rules.newRegime, rules.cessRate);
  const diff = old.totalTax - next.totalTax;
  return {
    supported: true,
    financialYear: rules.label,
    old,
    new: next,
    better: diff === 0 ? "equal" : diff > 0 ? "new" : "old",
    saving: Math.abs(diff),
  };
}

export interface DeductionHeadroom {
  readonly financialYear: string;
  readonly section80C: {
    readonly limit: number;
    readonly used: number;
    readonly headroom: number;
  };
  readonly section80CCD1B: {
    readonly limit: number;
    readonly used: number;
    readonly headroom: number;
  };
  readonly section80D: {
    readonly limit: number;
    readonly used: number;
    readonly headroom: number;
  };
}

export function deductionHeadroom(
  used: { section80C?: number; section80CCD1B?: number; section80D?: number },
  rules: FinancialYearRules,
  seniorCitizen = false,
): DeductionHeadroom {
  const line = (limit: number, raw: number | undefined) => {
    const u = Math.max(0, Math.round(raw ?? 0));
    return { limit, used: u, headroom: Math.max(0, limit - u) };
  };
  return {
    financialYear: rules.label,
    section80C: line(rules.deductions.section80C, used.section80C),
    section80CCD1B: line(rules.deductions.section80CCD1B, used.section80CCD1B),
    section80D: line(
      seniorCitizen
        ? rules.deductions.section80DSelfSenior
        : rules.deductions.section80DSelf,
      used.section80D,
    ),
  };
}
