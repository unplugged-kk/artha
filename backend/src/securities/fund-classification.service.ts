import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { AmfiNavService } from "./amfi-nav.service";
import { Security } from "./entities/security.entity";

/**
 * How long a captured classification is trusted before it is read again.
 *
 * Seven days, matching the sector-metadata path: AMFI reclassifies schemes
 * rarely, and the fetch rides a payload the NAV path caches for four hours.
 */
const FUND_CLASSIFICATION_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Captures the AMFI classification (fund house, scheme type, scheme category)
 * onto the securities that carry a scheme code.
 *
 * `docs/specs/fund-categories-and-comparison.md` is the specification. Two rules
 * carry the weight:
 *
 * **A write happens only on a provider answer** (INV-FUNDCAT-002). `null` from
 * the provider means the request failed, and a failed request must neither erase
 * a known category nor stamp freshness -- otherwise a transient outage turns
 * into a fund that is permanently Unclassified and looks up to date. Only an
 * answer that actually carried a category is written.
 *
 * **The category is stored verbatim** (INV-FUNDCAT-001). Nothing here normalises
 * the string, maps it onto a taxonomy, or defaults a missing one: `null` is
 * Unclassified and is rendered as such.
 *
 * Failures are logged and swallowed, like `ensureSecuritiesHistory`: a provider
 * outage must never fail a read the user asked for.
 */
@Injectable()
export class FundClassificationService {
  private readonly logger = new Logger(FundClassificationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly amfiNavService: AmfiNavService,
  ) {}

  async ensureFundClassification(securities: Security[]): Promise<void> {
    const now = Date.now();
    const due = securities.filter((security) => this.isDue(security, now));
    if (due.length === 0) return;

    const answered = await Promise.all(
      due.map(async (security) => {
        const schemeCode = (security.amfiSchemeCode ?? "").trim();
        try {
          const classification =
            await this.amfiNavService.fetchSchemeClassification(schemeCode);
          // No answer -> no write, no stamp. An answer without a published
          // category is also nothing to store: the columns stay as they are so
          // the next sweep can try again.
          if (
            classification === null ||
            classification.schemeCategory === null
          ) {
            return null;
          }
          security.fundHouse = classification.fundHouse;
          security.fundSchemeType = classification.schemeType;
          security.fundCategory = classification.schemeCategory;
          security.fundClassificationUpdatedAt = new Date();
          return security;
        } catch (error) {
          this.logger.warn(
            `Fund classification fetch failed for ${security.symbol}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return null;
        }
      }),
    );

    const updated = answered.filter(
      (security): security is Security => security !== null,
    );
    if (updated.length === 0) return;

    await withScopedDb(this.dataSource, async (m) => {
      for (const security of updated) {
        await m.getRepository(Security).update(
          // The owner is part of the key as well as the id: every caller hands
          // over a security it loaded under one user's scope, and a write that
          // named only the id would touch another user's row if that ever
          // changed.
          { id: security.id, userId: security.userId },
          {
            fundHouse: security.fundHouse,
            fundSchemeType: security.fundSchemeType,
            fundCategory: security.fundCategory,
            fundClassificationUpdatedAt: security.fundClassificationUpdatedAt,
          },
        );
      }
    });
  }

  /**
   * Whether this security needs a fetch: it must be an AMFI fund, and its
   * captured classification must be absent or older than the staleness window.
   */
  private isDue(security: Security, now: number): boolean {
    if (!(security.amfiSchemeCode ?? "").trim()) return false;
    const stamped = security.fundClassificationUpdatedAt;
    const stampedMs =
      stamped instanceof Date
        ? stamped.getTime()
        : Date.parse(String(stamped ?? ""));
    if (!Number.isFinite(stampedMs)) return true;
    return now - stampedMs >= FUND_CLASSIFICATION_STALE_MS;
  }
}
