import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { UserPreference } from "../users/entities/user-preference.entity";
import { preferredCurrency } from "../common/default-currency.util";
import { TransactionAnalyticsService } from "../transactions/transaction-analytics.service";
import { BudgetReportsService } from "../budgets/budget-reports.service";
import { NetWorthService } from "../net-worth/net-worth.service";
import { AiService } from "../ai/ai.service";
import { aiLanguageInstruction } from "../ai/context/language-directive";
import {
  buildCoachPrompt,
  CoachMetric,
  computeCoachMetrics,
  verifyNarrative,
} from "./coach-facts";

export interface WeeklyCoachMetrics {
  readonly asOf: string;
  readonly period: { readonly start: string; readonly end: string };
  readonly currency: string;
  readonly metrics: readonly CoachMetric[];
  /** Currencies with activity this week that the figures above leave out. */
  readonly excludedCurrencies: readonly string[];
}

export type NarrativeOutcome =
  | { readonly status: "ok"; readonly text: string }
  | {
      readonly status: "unavailable";
      readonly reason: "no_ai_provider" | "ai_failed" | "unsupported_numbers";
      readonly unsupportedNumbers?: readonly string[];
    };

export interface WeeklyCoachReport extends WeeklyCoachMetrics {
  readonly narrative: NarrativeOutcome;
}

const COACH_SYSTEM_PROMPT =
  "You are a careful personal-finance coach. You explain numbers that were " +
  "already computed; you never calculate. Be brief and concrete.";

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function monthKey(iso: string, offset: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + offset;
  const year = y + Math.floor(m / 12);
  return `${year}-${String((((m % 12) + 12) % 12) + 1).padStart(2, "0")}`;
}

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly analytics: TransactionAnalyticsService,
    private readonly budgetReports: BudgetReportsService,
    private readonly netWorth: NetWorthService,
    private readonly ai: AiService,
  ) {}

  /** Deterministic figures only: no provider call, no cost. */
  async weeklyMetrics(
    userId: string,
    asOf: string,
  ): Promise<WeeklyCoachMetrics> {
    const start = addDays(asOf, -6);
    const prefs = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(UserPreference).findOne({ where: { userId } }),
    );
    const currency = preferredCurrency(prefs);

    const summary = await this.analytics.getSummary(
      userId,
      undefined,
      start,
      asOf,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      true,
    );
    const mine = summary.byCurrency[currency];
    const excludedCurrencies = Object.entries(summary.byCurrency)
      .filter(
        ([code, v]) =>
          code !== currency && (v.totalIncome > 0 || v.totalExpenses > 0),
      )
      .map(([code]) => code)
      .sort();

    // The budget's own period, so spent and budgeted describe the same days.
    const budget = await this.budgetReports.getLlmBudgetStatus(userId);
    const budgeted = "error" in budget ? null : budget.totalBudgeted;
    const budgetSpent = "error" in budget ? null : budget.totalSpent;

    // Net worth: this month against last month, and only when both months are
    // fully converted -- a partial month is a subtotal, not a trend.
    const months = await this.netWorth.getMonthlyNetWorth(
      userId,
      `${monthKey(asOf, -1)}-01`,
      asOf,
    );
    const cur = months.find((x) => x.month.startsWith(monthKey(asOf, 0)));
    const prev = months.find((x) => x.month.startsWith(monthKey(asOf, -1)));
    const complete = cur?.fxComplete === true && prev?.fxComplete === true;

    return {
      asOf,
      period: { start, end: asOf },
      currency,
      metrics: computeCoachMetrics({
        income: mine?.totalIncome ?? 0,
        spending: mine?.totalExpenses ?? 0,
        budgeted,
        budgetSpent,
        netWorthStart: complete && prev ? prev.netWorth : null,
        netWorthEnd: complete && cur ? cur.netWorth : null,
        currency,
      }),
      excludedCurrencies,
    };
  }

  /** Metrics plus a narrative that is rejected if it quotes any other number. */
  async weeklyReport(userId: string, asOf: string): Promise<WeeklyCoachReport> {
    const base = await this.weeklyMetrics(userId, asOf);
    const prefs = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(UserPreference).findOne({ where: { userId } }),
    );
    const prompt = buildCoachPrompt(base.metrics);
    const system = COACH_SYSTEM_PROMPT + aiLanguageInstruction(prefs?.language);

    let lastUnsupported: readonly string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryNote =
        attempt === 0
          ? ""
          : `\n\nYour previous answer used numbers that are not listed (${lastUnsupported.join(", ")}). Rewrite it using only the listed numbers.`;
      let text: string;
      try {
        const response = await this.ai.complete(
          userId,
          {
            systemPrompt: system,
            messages: [{ role: "user", content: prompt + retryNote }],
            maxTokens: 600,
            temperature: 0.3,
          },
          "coach",
        );
        text = response.content.trim();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Coach narrative failed user=${userId}: ${message}`);
        return {
          ...base,
          narrative: {
            status: "unavailable",
            // The message is translated per request, so classify by type: the
            // "no provider configured" refusal is a BadRequest, a provider
            // failure is not.
            reason:
              error instanceof BadRequestException
                ? "no_ai_provider"
                : "ai_failed",
          },
        };
      }
      const check = verifyNarrative(text, base.metrics);
      if (check.ok) return { ...base, narrative: { status: "ok", text } };
      lastUnsupported = check.unsupportedNumbers;
    }
    return {
      ...base,
      narrative: {
        status: "unavailable",
        reason: "unsupported_numbers",
        unsupportedNumbers: lastUnsupported,
      },
    };
  }
}
