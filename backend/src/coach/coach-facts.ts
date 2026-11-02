/**
 * Weekly coach: deterministic metrics, a prompt that may only quote them, and a
 * verifier that rejects a narrative containing a number the metrics did not
 * supply. The model explains; it never computes.
 */

export interface CoachMetricInput {
  readonly income: number;
  readonly spending: number;
  readonly budgeted: number | null;
  readonly netWorthStart: number | null;
  readonly netWorthEnd: number | null;
  readonly currency: string;
}

export interface CoachMetric {
  readonly id: string;
  readonly label: string;
  /** Null means unknown; it is never replaced by 0. */
  readonly value: number | null;
  readonly unit: "percent" | "currency";
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function computeCoachMetrics(i: CoachMetricInput): CoachMetric[] {
  const savingsRate =
    i.income > 0 ? r2(((i.income - i.spending) / i.income) * 100) : null;
  const budgetAdherence =
    i.budgeted !== null && i.budgeted > 0
      ? r2((i.spending / i.budgeted) * 100)
      : null;
  const netWorthChange =
    i.netWorthStart !== null && i.netWorthEnd !== null
      ? r2(i.netWorthEnd - i.netWorthStart)
      : null;
  return [
    {
      id: "savings_rate",
      label: "Savings rate",
      value: savingsRate,
      unit: "percent",
    },
    {
      id: "budget_used",
      label: "Share of budget spent",
      value: budgetAdherence,
      unit: "percent",
    },
    {
      id: "net_worth_change",
      label: `Net worth change (${i.currency})`,
      value: netWorthChange,
      unit: "currency",
    },
    {
      id: "spending",
      label: `Spending (${i.currency})`,
      value: r2(i.spending),
      unit: "currency",
    },
    {
      id: "income",
      label: `Income (${i.currency})`,
      value: r2(i.income),
      unit: "currency",
    },
  ];
}

export function buildCoachPrompt(metrics: readonly CoachMetric[]): string {
  const lines = metrics.map(
    (m) => `- [${m.id}] ${m.label}: ${m.value === null ? "unknown" : m.value}`,
  );
  return [
    "Write a short, friendly weekly money check-in with 2-3 concrete suggestions.",
    "Use ONLY the numbers listed below, exactly as written, and cite each by its [id].",
    "Do not calculate, estimate or introduce any other number. If a metric is unknown, say it is unknown.",
    "",
    ...lines,
  ].join("\n");
}

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/g;

function canon(n: string): string {
  const v = Number(n.replace(/,/g, ""));
  return Number.isFinite(v) ? String(Math.abs(v)) : n;
}

export interface NarrativeCheck {
  readonly ok: boolean;
  /** Numbers in the text that are not among the metrics. */
  readonly unsupportedNumbers: readonly string[];
}

/**
 * Every number in the narrative must be one of the metric values (sign and
 * thousands separators ignored). Numbers inside a [metric_id] citation, such as
 * ids with digits, are stripped first. List markers ("1.") are tolerated.
 */
export function verifyNarrative(
  narrative: string,
  metrics: readonly CoachMetric[],
): NarrativeCheck {
  const allowed = new Set(
    metrics
      .filter((m) => m.value !== null)
      .map((m) => String(Math.abs(m.value as number))),
  );
  const text = narrative
    .replace(/\[[a-z0-9_]+\]/gi, " ")
    .replace(/^\s*\d+[.)]\s/gm, " ");
  const found = text.match(NUMBER) ?? [];
  const unsupported = found.filter((n) => !allowed.has(canon(n)));
  return { ok: unsupported.length === 0, unsupportedNumbers: unsupported };
}
