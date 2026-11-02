import { Injectable } from "@nestjs/common";
import { TransactionAnalyticsService } from "../transactions/transaction-analytics.service";
import {
  detectSpendingSpike,
  detectSubscriptionIncrease,
} from "../finance-detectors/detectors";

export interface SpendingSpike {
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly currencyCode: string;
  /** Month-to-date net spending in this category. */
  readonly current: number;
  readonly mean: number;
  readonly threshold: number;
}

export interface SubscriptionIncrease {
  readonly payeeName: string;
  readonly payeeId: string | null;
  readonly previous: number;
  readonly latest: number;
  readonly increasePct: number;
}

export interface AnomalyReport {
  readonly asOf: string;
  readonly currentPeriod: { readonly start: string; readonly end: string };
  readonly historyPeriod: { readonly start: string; readonly end: string };
  readonly spendingSpikes: readonly SpendingSpike[];
  readonly subscriptionIncreases: readonly SubscriptionIncrease[];
}

/** A category needs spend in at least this many history months to be a baseline. */
const MIN_ACTIVE_HISTORY_MONTHS = 2;
const HISTORY_MONTHS = 3;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** First day of the month `offset` months from the month of `iso` (UTC, no DST). */
export function monthStart(iso: string, offset: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + offset;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${pad(month + 1)}-01`;
}

function monthEnd(iso: string, offset: number): string {
  const next = monthStart(iso, offset + 1);
  const d = new Date(`${next}T00:00:00Z`);
  d.setUTCDate(0);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

@Injectable()
export class AnomalyDetectionService {
  constructor(private readonly analytics: TransactionAnalyticsService) {}

  async detect(userId: string, asOf: string): Promise<AnomalyReport> {
    const currentStart = monthStart(asOf, 0);
    const historyMonths = Array.from({ length: HISTORY_MONTHS }, (_, i) => ({
      start: monthStart(asOf, -(HISTORY_MONTHS - i)),
      end: monthEnd(asOf, -(HISTORY_MONTHS - i)),
    }));

    const [current, ...history] = await Promise.all([
      this.categorySpend(userId, currentStart, asOf),
      ...historyMonths.map((m) => this.categorySpend(userId, m.start, m.end)),
    ]);

    const spendingSpikes: SpendingSpike[] = [];
    for (const [key, cur] of current) {
      const series = history.map((h) => h.get(key)?.spend ?? 0);
      const active = series.filter((v) => v > 0).length;
      if (active < MIN_ACTIVE_HISTORY_MONTHS) continue;
      const result = detectSpendingSpike(series, cur.spend);
      if (result.status === "ok" && result.flagged) {
        spendingSpikes.push({
          categoryId: cur.categoryId,
          categoryName: cur.categoryName,
          currencyCode: cur.currencyCode,
          current: cur.spend,
          mean: result.mean,
          threshold: result.threshold,
        });
      }
    }

    const yearAgo = monthStart(asOf, -12);
    const recurring = await this.analytics.getRecurringCharges(
      userId,
      yearAgo,
      asOf,
    );
    const subscriptionIncreases: SubscriptionIncrease[] = [];
    for (const charge of recurring) {
      const result = detectSubscriptionIncrease(
        charge.dates.map((date, i) => ({ date, amount: charge.amounts[i] })),
      );
      if (result.status === "ok" && result.flagged) {
        subscriptionIncreases.push({
          payeeName: charge.payeeName,
          payeeId: charge.payeeId,
          previous: result.previous,
          latest: result.latest,
          increasePct: result.increasePct,
        });
      }
    }

    return {
      asOf,
      currentPeriod: { start: currentStart, end: asOf },
      historyPeriod: {
        start: historyMonths[0].start,
        end: historyMonths[historyMonths.length - 1].end,
      },
      spendingSpikes: spendingSpikes.sort((a, b) => b.current - a.current),
      subscriptionIncreases: subscriptionIncreases.sort(
        (a, b) => b.increasePct - a.increasePct,
      ),
    };
  }

  /**
   * Net spending per (category, currency): a category whose signed total is
   * negative spent that much; a net-positive one (refunds exceeding spend, or
   * income) spent nothing. Currencies are never mixed.
   */
  private async categorySpend(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<
    Map<
      string,
      {
        categoryId: string | null;
        categoryName: string | null;
        currencyCode: string;
        spend: number;
      }
    >
  > {
    const rows = await this.analytics.getGroupedTotals(userId, {
      groupBy: "category",
      startDate,
      endDate,
      limit: 500,
    });
    const out = new Map<
      string,
      {
        categoryId: string | null;
        categoryName: string | null;
        currencyCode: string;
        spend: number;
      }
    >();
    for (const row of rows) {
      if (row.id === null || row.total >= 0) continue;
      out.set(`${row.id}|${row.currencyCode}`, {
        categoryId: row.id,
        categoryName: row.name,
        currencyCode: row.currencyCode,
        spend: Math.round(-row.total * 100) / 100,
      });
    }
    return out;
  }
}
