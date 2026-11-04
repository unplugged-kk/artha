/**
 * Debt payoff simulator (snowball vs avalanche). Pure. Works in paise so the
 * month-by-month balance never drifts. Interest accrues monthly at apr/12 on the
 * balance at the start of the month; the whole budget (sum of minimums plus
 * `extraMonthly`) is applied every month, with freed-up minimums rolling to the
 * target debt.
 */

export interface Debt {
  readonly name: string;
  readonly balance: number;
  readonly aprPct: number;
  readonly minPayment: number;
}

export type PayoffStrategy = "snowball" | "avalanche";

export type PayoffResult =
  | {
      readonly status: "paid_off";
      readonly months: number;
      readonly totalInterest: number;
      readonly payoffOrder: readonly string[];
    }
  | { readonly status: "never_paid_off"; readonly reason: string };

const MAX_MONTHS = 1200;
const p = (n: number): number => Math.round(n * 100);

interface State {
  name: string;
  balance: number;
  apr: number;
  min: number;
}

function order(a: State, b: State, strategy: PayoffStrategy): number {
  return strategy === "snowball" ? a.balance - b.balance : b.apr - a.apr;
}

export function simulateDebtPayoff(
  debts: readonly Debt[],
  extraMonthly: number,
  strategy: PayoffStrategy,
): PayoffResult {
  if (debts.some((d) => d.balance < 0 || d.minPayment < 0 || d.aprPct < 0)) {
    return { status: "never_paid_off", reason: "negative_input" };
  }
  const state: State[] = debts
    .filter((d) => p(d.balance) > 0)
    .map((d) => ({
      name: d.name,
      balance: p(d.balance),
      apr: d.aprPct,
      min: p(d.minPayment),
    }));
  if (state.length === 0) {
    return { status: "paid_off", months: 0, totalInterest: 0, payoffOrder: [] };
  }
  const budget = state.reduce((s, d) => s + d.min, 0) + p(extraMonthly);
  let totalInterest = 0;
  const payoffOrder: string[] = [];

  for (let month = 1; month <= MAX_MONTHS; month += 1) {
    // 1. accrue interest
    for (const d of state) {
      if (d.balance > 0) {
        const interest = Math.round((d.balance * d.apr) / 100 / 12);
        d.balance += interest;
        totalInterest += interest;
      }
    }
    // 2. pay minimums, then the remainder to the strategy's target
    let remaining = budget;
    const live = state.filter((d) => d.balance > 0);
    for (const d of live) {
      const pay = Math.min(d.min, d.balance, remaining);
      d.balance -= pay;
      remaining -= pay;
    }
    for (const d of [...live].sort((a, b) => order(a, b, strategy))) {
      if (remaining <= 0) break;
      const pay = Math.min(d.balance, remaining);
      d.balance -= pay;
      remaining -= pay;
    }
    for (const d of live) {
      if (d.balance === 0 && !payoffOrder.includes(d.name))
        payoffOrder.push(d.name);
    }
    if (state.every((d) => d.balance === 0)) {
      return {
        status: "paid_off",
        months: month,
        totalInterest: totalInterest / 100,
        payoffOrder,
      };
    }
  }
  return { status: "never_paid_off", reason: "budget_does_not_cover_interest" };
}
