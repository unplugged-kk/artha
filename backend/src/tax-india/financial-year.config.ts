/**
 * Versioned Indian income-tax rules, keyed by financial year (1 Apr - 31 Mar).
 * Rules are data, not branches in code: a new year adds an entry.
 * All amounts are whole rupees.
 */

export interface TaxSlab {
  /** Upper bound of the slab (inclusive); null means no upper bound. */
  readonly upTo: number | null;
  /** Rate as a fraction, e.g. 0.05. */
  readonly rate: number;
}

export interface RegimeRules {
  readonly slabs: readonly TaxSlab[];
  readonly standardDeduction: number;
  /** Section 87A: rebate applies when taxable income <= threshold. */
  readonly rebateThreshold: number;
  readonly rebateMax: number;
  /** New regime gets marginal relief just above the rebate threshold. */
  readonly marginalRelief: boolean;
}

export interface DeductionLimits {
  readonly section80C: number;
  readonly section80CCD1B: number;
  readonly section80DSelf: number;
  readonly section80DSelfSenior: number;
}

export interface CapitalGainsRules {
  /** Holding period (months) above which listed equity gains are long-term. */
  readonly equityLongTermMonths: number;
  readonly equityStcgRate: number;
  readonly equityLtcgRate: number;
  /** Annual LTCG exemption on equity, whole rupees. */
  readonly equityLtcgExemption: number;
  /** Equity bought before this date needs 31-Jan-2018 grandfathering (not modelled). */
  readonly grandfatheringCutoff: string;
}

export interface FinancialYearRules {
  readonly label: string;
  readonly capitalGains: CapitalGainsRules;
  readonly cessRate: number;
  /** Taxable income above which surcharge applies; engine refuses beyond it. */
  readonly surchargeThreshold: number;
  readonly oldRegime: RegimeRules;
  readonly newRegime: RegimeRules;
  readonly deductions: DeductionLimits;
}

const FY_2025_26: FinancialYearRules = {
  label: "FY2025-26",
  capitalGains: {
    equityLongTermMonths: 12,
    equityStcgRate: 0.2,
    equityLtcgRate: 0.125,
    equityLtcgExemption: 125_000,
    grandfatheringCutoff: "2018-02-01",
  },
  cessRate: 0.04,
  surchargeThreshold: 5_000_000,
  oldRegime: {
    slabs: [
      { upTo: 250_000, rate: 0 },
      { upTo: 500_000, rate: 0.05 },
      { upTo: 1_000_000, rate: 0.2 },
      { upTo: null, rate: 0.3 },
    ],
    standardDeduction: 50_000,
    rebateThreshold: 500_000,
    rebateMax: 12_500,
    marginalRelief: false,
  },
  newRegime: {
    slabs: [
      { upTo: 400_000, rate: 0 },
      { upTo: 800_000, rate: 0.05 },
      { upTo: 1_200_000, rate: 0.1 },
      { upTo: 1_600_000, rate: 0.15 },
      { upTo: 2_000_000, rate: 0.2 },
      { upTo: 2_400_000, rate: 0.25 },
      { upTo: null, rate: 0.3 },
    ],
    standardDeduction: 75_000,
    rebateThreshold: 1_200_000,
    rebateMax: 60_000,
    marginalRelief: true,
  },
  deductions: {
    section80C: 150_000,
    section80CCD1B: 50_000,
    section80DSelf: 25_000,
    section80DSelfSenior: 50_000,
  },
};

export const FINANCIAL_YEARS: Readonly<Record<string, FinancialYearRules>> = {
  "FY2025-26": FY_2025_26,
};

export function getFinancialYearRules(
  label: string,
): FinancialYearRules | null {
  return FINANCIAL_YEARS[label] ?? null;
}

/** Financial-year label containing an ISO date (YYYY-MM-DD). */
export function financialYearLabelFor(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const start = month >= 4 ? year : year - 1;
  return `FY${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
