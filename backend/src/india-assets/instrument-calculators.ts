/**
 * Maturity / projection calculators for Indian savings instruments.
 * Pure and deterministic; amounts in rupees rounded to paise. Rates are annual
 * percentages (7 means 7%). These are projections from stated inputs; the
 * official rate for a given quarter/year is the caller's input, never assumed.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface MaturityResult {
  readonly maturityAmount: number;
  readonly interestEarned: number;
  readonly totalInvested: number;
}

function assertFinite(label: string, v: number, min = 0): void {
  if (!Number.isFinite(v) || v < min) {
    throw new RangeError(`${label} must be a finite number >= ${min}`);
  }
}

/** Fixed deposit: compound interest, `compoundingPerYear` times a year (banks: 4). */
export function fixedDepositMaturity(
  principal: number,
  annualRatePct: number,
  years: number,
  compoundingPerYear = 4,
): MaturityResult {
  assertFinite("principal", principal);
  assertFinite("annualRatePct", annualRatePct);
  assertFinite("years", years);
  assertFinite("compoundingPerYear", compoundingPerYear, 1);
  const amount =
    principal *
    Math.pow(
      1 + annualRatePct / 100 / compoundingPerYear,
      compoundingPerYear * years,
    );
  return {
    maturityAmount: round2(amount),
    interestEarned: round2(amount - principal),
    totalInvested: round2(principal),
  };
}

/**
 * Recurring deposit with the Indian bank convention: quarterly compounding,
 * monthly instalments at the start of each month.
 * M = R * ((1+i)^n - 1) / (1 - (1+i)^(-1/3)), i = rate/400, n = quarters.
 */
export function recurringDepositMaturity(
  monthlyDeposit: number,
  annualRatePct: number,
  months: number,
): MaturityResult {
  assertFinite("monthlyDeposit", monthlyDeposit);
  assertFinite("annualRatePct", annualRatePct);
  assertFinite("months", months);
  const invested = monthlyDeposit * months;
  if (annualRatePct === 0 || months === 0) {
    return {
      maturityAmount: round2(invested),
      interestEarned: 0,
      totalInvested: round2(invested),
    };
  }
  const i = annualRatePct / 400;
  const n = months / 3;
  const maturity =
    (monthlyDeposit * (Math.pow(1 + i, n) - 1)) / (1 - Math.pow(1 + i, -1 / 3));
  return {
    maturityAmount: round2(maturity),
    interestEarned: round2(maturity - invested),
    totalInvested: round2(invested),
  };
}

/**
 * PPF: interest is computed monthly on the lowest balance between the 5th and
 * month end, and credited annually. For a yearly deposit made on or before 5 April
 * the whole year earns interest, which this models: each year's deposit is added
 * at the start and interest = balance * rate for that year.
 */
export function ppfMaturity(
  yearlyDeposit: number,
  annualRatePct: number,
  years = 15,
): MaturityResult {
  assertFinite("yearlyDeposit", yearlyDeposit);
  assertFinite("annualRatePct", annualRatePct);
  assertFinite("years", years);
  let balance = 0;
  for (let y = 0; y < years; y += 1) {
    balance = (balance + yearlyDeposit) * (1 + annualRatePct / 100);
  }
  const invested = yearlyDeposit * years;
  return {
    maturityAmount: round2(balance),
    interestEarned: round2(balance - invested),
    totalInvested: round2(invested),
  };
}

/**
 * EPF: interest accrues monthly on the running balance at rate/12 and is
 * credited at year end. Employee and employer contributions both go in monthly.
 */
export function epfProjection(
  monthlyEmployee: number,
  monthlyEmployer: number,
  annualRatePct: number,
  years: number,
  openingBalance = 0,
): MaturityResult {
  assertFinite("monthlyEmployee", monthlyEmployee);
  assertFinite("monthlyEmployer", monthlyEmployer);
  assertFinite("annualRatePct", annualRatePct);
  assertFinite("years", years);
  assertFinite("openingBalance", openingBalance);
  let balance = openingBalance;
  for (let y = 0; y < years; y += 1) {
    let accrued = 0;
    for (let m = 0; m < 12; m += 1) {
      balance += monthlyEmployee + monthlyEmployer;
      accrued += (balance * annualRatePct) / 100 / 12;
    }
    balance += accrued;
  }
  const invested =
    openingBalance + (monthlyEmployee + monthlyEmployer) * 12 * years;
  return {
    maturityAmount: round2(balance),
    interestEarned: round2(balance - invested),
    totalInvested: round2(invested),
  };
}

/** NPS-style corpus: monthly contribution at a monthly-compounded assumed return. */
export function npsCorpus(
  monthlyContribution: number,
  assumedAnnualReturnPct: number,
  years: number,
  openingBalance = 0,
): MaturityResult {
  assertFinite("monthlyContribution", monthlyContribution);
  assertFinite("assumedAnnualReturnPct", assumedAnnualReturnPct);
  assertFinite("years", years);
  assertFinite("openingBalance", openingBalance);
  const r = assumedAnnualReturnPct / 100 / 12;
  const n = years * 12;
  const growth = Math.pow(1 + r, n);
  const fv =
    r === 0
      ? monthlyContribution * n
      : monthlyContribution * ((growth - 1) / r) * (1 + r);
  const total = fv + openingBalance * growth;
  const invested = openingBalance + monthlyContribution * n;
  return {
    maturityAmount: round2(total),
    interestEarned: round2(total - invested),
    totalInvested: round2(invested),
  };
}

/** Sovereign Gold Bond: 2.5% p.a. on the issue price, paid half-yearly. */
export function sgbInterest(
  units: number,
  issuePricePerUnit: number,
  years: number,
  annualRatePct = 2.5,
): { readonly perHalfYear: number; readonly total: number } {
  assertFinite("units", units);
  assertFinite("issuePricePerUnit", issuePricePerUnit);
  assertFinite("years", years);
  const perHalfYear = (units * issuePricePerUnit * annualRatePct) / 100 / 2;
  return {
    perHalfYear: round2(perHalfYear),
    total: round2(perHalfYear * 2 * years),
  };
}
