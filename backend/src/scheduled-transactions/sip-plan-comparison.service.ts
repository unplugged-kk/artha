import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { roundMoney } from "../common/round.util";
import { ScheduledOccurrenceService } from "./scheduled-occurrence.service";

/**
 * Two amounts are the same contribution when they differ by less than this.
 *
 * Money is stored `NUMERIC(20,4)`, so a difference below the fourth decimal is
 * not a difference in the amount -- it is the representation. Anything at or
 * above it is a real variance and is reported as partial or extra.
 */
export const SIP_MATCH_TOLERANCE = 0.0001;

export type SipOccurrenceStatus =
  /** The occurrence was posted and the money matches the plan. */
  | "matched"
  /** Posted, but less was invested than planned. */
  | "partial"
  /** Posted, and more was invested than planned. */
  | "extra"
  /** Due, with no posting: nothing was invested. */
  | "missed"
  /**
   * Posted, but the amount is not knowable: either the link predates the
   * column, or the posting created no investment row we can point at. The
   * actual is `null` here and is **never** the planned amount restated.
   */
  | "unknown"
  /** Posted and then reversed: the linked investment transaction is VOID. */
  | "voided";

export interface SipOccurrenceComparison {
  /** The occurrence's identity -- the schedule's due date when it was posted. */
  dueDate: string;
  /** The date the money was actually booked on, when it was posted. */
  postedDate: string | null;
  status: SipOccurrenceStatus;
  /** What the schedule said to invest, in the schedule's currency. */
  plannedAmount: number | null;
  /**
   * What was actually invested, taken from the investment transaction the
   * posting created -- never from `plannedAmount`. Null when it is not knowable.
   */
  actualAmount: number | null;
  /** `actualAmount - plannedAmount`, or null when either side is unknown. */
  variance: number | null;
  /**
   * The investment row the occurrence produced, so a caller can verify the
   * actual amount against its source rather than trusting this figure.
   */
  investmentTransactionId: string | null;
}

export interface SipPlanComparison {
  scheduledTransactionId: string;
  name: string;
  securityId: string | null;
  fundingAccountId: string;
  currencyCode: string;
  frequency: string;
  nextDueDate: string;
  /** The plan as the schedule states it, per occurrence. */
  plannedPerOccurrence: number | null;
  occurrences: SipOccurrenceComparison[];
  plannedCount: number;
  postedCount: number;
  matchedCount: number;
  partialCount: number;
  extraCount: number;
  missedCount: number;
  unknownCount: number;
  voidedCount: number;
  /** Null when any included occurrence's planned amount is unknown. */
  plannedTotal: number | null;
  /** Null when any posted occurrence's actual amount is unknown. */
  actualTotal: number | null;
}

/** One posting, with whatever its linked investment row can tell us. */
interface PostingRow {
  scheduled_transaction_id: string;
  due_date: string;
  posted_date: string;
  investment_transaction_id: string | null;
  total_amount: string | null;
  exchange_rate: string | null;
  investment_status: string | null;
}

/**
 * SIP plan versus actual, over the scheduled-investment mechanism that already
 * exists.
 *
 * There is no second scheduler here and no second ledger: the plan comes from
 * the schedule's own resolved occurrences (through `ScheduledOccurrenceService`,
 * which owns cadence, overrides and moving due dates), and the actual comes from
 * the investment transaction the posting created. This service only compares the
 * two.
 *
 * The distinction that makes it trustworthy: a posted occurrence whose actual
 * amount cannot be established reports `actualAmount: null` and status
 * `unknown`. Substituting the planned amount there would produce a perfect
 * plan-vs-actual report for every portfolio, which is the defect this feature
 * exists to expose.
 */
@Injectable()
export class SipPlanComparisonService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly occurrences: ScheduledOccurrenceService,
  ) {}

  /**
   * Every investment schedule's occurrences inside `window`, each compared with
   * what was actually invested.
   */
  async compare(
    userId: string,
    window: { from?: string; through: string },
  ): Promise<SipPlanComparison[]> {
    const resolved = await this.occurrences.findOccurrences(userId, window);

    const investmentOccurrences = resolved.filter(
      (occurrence) => occurrence.schedule?.isInvestment,
    );
    if (investmentOccurrences.length === 0) return [];

    const scheduleIds = [
      ...new Set(investmentOccurrences.map((o) => o.scheduledTransactionId)),
    ];
    const postings = await this.loadPostings(scheduleIds);
    const postingByKey = new Map<string, PostingRow>();
    for (const posting of postings) {
      postingByKey.set(
        `${posting.scheduled_transaction_id}|${posting.due_date}`,
        posting,
      );
    }

    const bySchedule = new Map<string, SipPlanComparison>();
    for (const occurrence of investmentOccurrences) {
      const schedule = occurrence.schedule;
      const group = bySchedule.get(occurrence.scheduledTransactionId) ?? {
        scheduledTransactionId: occurrence.scheduledTransactionId,
        name: schedule.name ?? "",
        securityId: schedule.investmentSecurityId ?? null,
        fundingAccountId: occurrence.settlementAccountId,
        currencyCode: occurrence.currencyCode,
        frequency: schedule.frequency,
        nextDueDate: this.toDateString(schedule.nextDueDate),
        plannedPerOccurrence: occurrence.amount,
        occurrences: [],
        plannedCount: 0,
        postedCount: 0,
        matchedCount: 0,
        partialCount: 0,
        extraCount: 0,
        missedCount: 0,
        unknownCount: 0,
        voidedCount: 0,
        plannedTotal: 0,
        actualTotal: 0,
      };

      group.occurrences.push(
        this.compareOccurrence(
          occurrence.dueDate,
          occurrence.amount,
          postingByKey.get(
            `${occurrence.scheduledTransactionId}|${occurrence.dueDate}`,
          ),
        ),
      );
      bySchedule.set(occurrence.scheduledTransactionId, group);
    }

    for (const group of bySchedule.values()) {
      this.summarise(group);
    }

    return [...bySchedule.values()];
  }

  private compareOccurrence(
    dueDate: string,
    plannedAmount: number | null,
    posting: PostingRow | undefined,
  ): SipOccurrenceComparison {
    if (!posting) {
      // Nothing was invested on this occurrence. Zero is the fact here, not an
      // assumption: no posting means no money moved for this due date.
      return {
        dueDate,
        postedDate: null,
        status: "missed",
        plannedAmount,
        actualAmount: 0,
        variance: plannedAmount === null ? null : roundMoney(0 - plannedAmount),
        investmentTransactionId: null,
      };
    }

    if (posting.investment_status === "VOID") {
      // Posted and then reversed. The money did not stay invested, so this is
      // neither a match nor a contribution.
      return {
        dueDate,
        postedDate: posting.posted_date,
        status: "voided",
        plannedAmount,
        actualAmount: 0,
        variance: plannedAmount === null ? null : roundMoney(0 - plannedAmount),
        investmentTransactionId: posting.investment_transaction_id,
      };
    }

    const actual = this.actualAmount(posting);
    if (actual === null) {
      return {
        dueDate,
        postedDate: posting.posted_date,
        status: "unknown",
        plannedAmount,
        actualAmount: null,
        variance: null,
        investmentTransactionId: posting.investment_transaction_id,
      };
    }

    return {
      dueDate,
      postedDate: posting.posted_date,
      status: this.classify(plannedAmount, actual),
      plannedAmount,
      actualAmount: actual,
      variance:
        plannedAmount === null ? null : roundMoney(actual - plannedAmount),
      investmentTransactionId: posting.investment_transaction_id,
    };
  }

  /**
   * The actual contribution: the investment row's own amount, converted at the
   * rate that row was booked with. Null when there is no linked row at all --
   * which is a pre-migration posting, not a zero.
   */
  private actualAmount(posting: PostingRow): number | null {
    if (posting.investment_transaction_id === null) return null;
    if (posting.total_amount === null) return null;

    const total = Number(posting.total_amount);
    const rate = Number(posting.exchange_rate ?? 1);
    if (!Number.isFinite(total) || total === 0) return null;
    if (!Number.isFinite(rate) || rate <= 0) return null;

    // Absolute: a contribution is a magnitude, and the sign here is the cash
    // account's convention, not the plan's.
    return roundMoney(Math.abs(total * rate));
  }

  private classify(
    planned: number | null,
    actual: number,
  ): SipOccurrenceStatus {
    if (planned === null) return "unknown";
    const variance = actual - planned;
    if (Math.abs(variance) < SIP_MATCH_TOLERANCE) return "matched";
    return variance < 0 ? "partial" : "extra";
  }

  private summarise(group: SipPlanComparison): void {
    let plannedTotal = 0;
    let actualTotal = 0;
    let plannedUnknown = false;
    let actualUnknown = false;

    for (const occurrence of group.occurrences) {
      group.plannedCount += 1;
      if (occurrence.postedDate !== null) group.postedCount += 1;

      switch (occurrence.status) {
        case "matched":
          group.matchedCount += 1;
          break;
        case "partial":
          group.partialCount += 1;
          break;
        case "extra":
          group.extraCount += 1;
          break;
        case "missed":
          group.missedCount += 1;
          break;
        case "voided":
          group.voidedCount += 1;
          break;
        default:
          group.unknownCount += 1;
          break;
      }

      if (occurrence.plannedAmount === null) plannedUnknown = true;
      else plannedTotal += occurrence.plannedAmount;

      if (occurrence.actualAmount === null) actualUnknown = true;
      else actualTotal += occurrence.actualAmount;
    }

    group.plannedTotal = plannedUnknown ? null : roundMoney(plannedTotal);
    group.actualTotal = actualUnknown ? null : roundMoney(actualTotal);
  }

  /**
   * Every posting for these schedules, joined to the investment row it created.
   *
   * Reads rows **including VOID** on purpose: a reversed contribution is a fact
   * the comparison must report (as `voided`), not one it may filter away and
   * then mistake for a missing payment.
   */
  private async loadPostings(scheduleIds: string[]): Promise<PostingRow[]> {
    return withScopedDb(this.dataSource, (m) =>
      m.query(
        `SELECT stp.scheduled_transaction_id,
                stp.original_due_date::text AS due_date,
                stp.posted_date::text       AS posted_date,
                stp.investment_transaction_id,
                it.total_amount,
                it.exchange_rate,
                it.status                   AS investment_status
           FROM scheduled_transaction_postings stp
           LEFT JOIN investment_transactions it
                  ON it.id = stp.investment_transaction_id
          WHERE stp.scheduled_transaction_id = ANY($1)`,
        [scheduleIds],
      ),
    );
  }

  private toDateString(value: Date | string): string {
    if (typeof value === "string") return value.slice(0, 10);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
}
