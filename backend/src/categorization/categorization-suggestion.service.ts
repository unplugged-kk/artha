import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { Category } from "../categories/entities/category.entity";
import { Transaction } from "../transactions/entities/transaction.entity";
import {
  qualifiedNamesById,
  resolveCategoryNamePaths,
} from "../categories/category-name.util";
import { matchMerchantReference } from "../payees/merchant-matcher.util";
import { RulesService } from "../rules/rules.service";
import {
  CategorizationDecision,
  decideCategory,
  normalizeMerchant,
} from "./categorization-pipeline";

export interface CategorizationSuggestion {
  readonly payee: string;
  readonly decision: CategorizationDecision;
  /** Qualified name ("Parent: Child") of the suggested category, when decided. */
  readonly categoryName: string | null;
}

const HISTORY_SAMPLE = 50;

/**
 * Tiers 1-3 of the categorization pipeline over the user's own data. Tier 4 (AI)
 * is only *reported* as `needs_ai`: the AI Assistant's confirmed-action flow is
 * what may act on it, never this service.
 */
@Injectable()
export class CategorizationSuggestionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rules: RulesService,
  ) {}

  async suggest(
    userId: string,
    input: {
      payee: string;
      amount?: number;
      memo?: string;
      accountId?: string;
    },
  ): Promise<CategorizationSuggestion> {
    const rule = await this.rules.evaluateForTransaction(userId, {
      payee: input.payee,
      memo: input.memo ?? null,
      amount: input.amount ?? null,
      accountId: input.accountId ?? null,
    });

    const { categories, historyCategoryIds } = await withScopedDb(
      this.dataSource,
      async (m) => {
        const cats = await m.getRepository(Category).find({
          where: { userId },
          select: ["id", "name", "parentId"],
        });
        const rows = await m
          .getRepository(Transaction)
          .createQueryBuilder("t")
          .leftJoin("t.payee", "p")
          .select("t.categoryId", "categoryId")
          .where("t.userId = :userId", { userId })
          .andWhere("t.categoryId IS NOT NULL")
          .andWhere("t.status != 'VOID'")
          .andWhere("t.isTransfer = false")
          .andWhere("t.parentTransactionId IS NULL")
          .andWhere("LOWER(COALESCE(p.name, t.payeeName)) = LOWER(:payee)", {
            payee: input.payee.trim(),
          })
          .orderBy("t.transactionDate", "DESC")
          .limit(HISTORY_SAMPLE)
          .getRawMany<{ categoryId: string }>();
        return {
          categories: cats,
          historyCategoryIds: rows.map((r) => r.categoryId),
        };
      },
    );

    // A merchant's suggested category is a NAME. It only counts when it names
    // exactly one of this user's categories; an unknown or ambiguous name is a
    // tier that stays silent, never a guess.
    const suggestion = matchMerchantReference(input.payee)?.categorySuggestion;
    const resolved = suggestion
      ? resolveCategoryNamePaths(categories, [suggestion])[0]
      : null;
    const merchantKey = normalizeMerchant(input.payee);
    const merchantDefaults: Record<string, string> =
      resolved?.id && merchantKey ? { [merchantKey]: resolved.id } : {};

    const decision = decideCategory({
      payee: input.payee,
      ruleCategoryId: rule?.actions.setCategoryId ?? null,
      merchantDefaults,
      historyCategoryIds,
    });

    const names = qualifiedNamesById(categories);
    return {
      payee: input.payee,
      decision,
      categoryName:
        decision.status === "categorized"
          ? (names.get(decision.categoryId) ?? null)
          : null,
    };
  }
}
