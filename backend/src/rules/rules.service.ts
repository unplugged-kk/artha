import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { TransactionRule } from "./entities/transaction-rule.entity";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";
import { ReorderRulesDto } from "./dto/reorder-rules.dto";
import { TestRuleDto } from "./dto/test-rule.dto";
import { ApplyRulesDto } from "./dto/apply-rules.dto";
import { Category } from "../categories/entities/category.entity";
import { Payee } from "../payees/entities/payee.entity";
import { Transaction } from "../transactions/entities/transaction.entity";
import {
  RuleEvaluationCandidate,
  RuleMatchResult,
} from "./interfaces/rule.interface";
import { evaluateRule, evaluateRules } from "./utils/rule-matcher.util";

@Injectable()
export class RulesService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Retrieves all transaction rules for the authenticated user,
   * sorted deterministically by priority ASC, createdAt ASC.
   */
  async findAll(userId: string): Promise<TransactionRule[]> {
    return withScopedDb(this.dataSource, (manager) =>
      manager.getRepository(TransactionRule).find({
        where: { userId },
        order: { priority: "ASC", createdAt: "ASC" },
      }),
    );
  }

  /**
   * Retrieves a single transaction rule by ID.
   */
  async findOne(userId: string, id: string): Promise<TransactionRule> {
    const rule = await withScopedDb(this.dataSource, (manager) =>
      manager.getRepository(TransactionRule).findOne({
        where: { id, userId },
      }),
    );

    if (!rule) {
      throw new NotFoundException("Transaction rule not found");
    }

    return rule;
  }

  /**
   * Creates a new transaction rule.
   */
  async create(userId: string, dto: CreateRuleDto): Promise<TransactionRule> {
    return withScopedDb(this.dataSource, async (manager) => {
      // Validate category ownership if set
      if (dto.actions?.setCategoryId) {
        const cat = await manager.getRepository(Category).findOne({
          where: { id: dto.actions.setCategoryId, userId },
        });
        if (!cat) {
          throw new BadRequestException("Referenced category not found");
        }
      }

      // Validate payee ownership if set
      if (dto.actions?.setPayeeId) {
        const payee = await manager.getRepository(Payee).findOne({
          where: { id: dto.actions.setPayeeId, userId },
        });
        if (!payee) {
          throw new BadRequestException("Referenced payee not found");
        }
      }

      // Auto-assign priority to next available if not provided
      let priority = dto.priority;
      if (priority === undefined || priority === null) {
        const highest = await manager
          .getRepository(TransactionRule)
          .createQueryBuilder("r")
          .select("MAX(r.priority)", "max")
          .where("r.user_id = :userId", { userId })
          .getRawOne<{ max: number | null }>();
        priority = (highest?.max ?? -1) + 1;
      }

      const rule = manager.create(TransactionRule, {
        userId,
        name: dto.name,
        priority,
        isActive: dto.isActive ?? true,
        matchMode: dto.matchMode,
        conditions: dto.conditions ?? [],
        actions: dto.actions ?? {},
      });

      return manager.save(rule);
    });
  }

  /**
   * Updates an existing transaction rule.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateRuleDto,
  ): Promise<TransactionRule> {
    return withScopedDb(this.dataSource, async (manager) => {
      const rule = await manager.getRepository(TransactionRule).findOne({
        where: { id, userId },
      });

      if (!rule) {
        throw new NotFoundException("Transaction rule not found");
      }

      // Validate category ownership if updated
      if (dto.actions?.setCategoryId) {
        const cat = await manager.getRepository(Category).findOne({
          where: { id: dto.actions.setCategoryId, userId },
        });
        if (!cat) {
          throw new BadRequestException("Referenced category not found");
        }
      }

      // Validate payee ownership if updated
      if (dto.actions?.setPayeeId) {
        const payee = await manager.getRepository(Payee).findOne({
          where: { id: dto.actions.setPayeeId, userId },
        });
        if (!payee) {
          throw new BadRequestException("Referenced payee not found");
        }
      }

      if (dto.name !== undefined) rule.name = dto.name;
      if (dto.priority !== undefined) rule.priority = dto.priority;
      if (dto.isActive !== undefined) rule.isActive = dto.isActive;
      if (dto.matchMode !== undefined) rule.matchMode = dto.matchMode;
      if (dto.conditions !== undefined) rule.conditions = dto.conditions;
      if (dto.actions !== undefined) rule.actions = dto.actions;

      return manager.save(rule);
    });
  }

  /**
   * Deletes a transaction rule.
   */
  async remove(userId: string, id: string): Promise<void> {
    await withScopedDb(this.dataSource, async (manager) => {
      const rule = await manager.getRepository(TransactionRule).findOne({
        where: { id, userId },
      });

      if (!rule) {
        throw new NotFoundException("Transaction rule not found");
      }

      await manager.remove(rule);
    });
  }

  /**
   * Reorders rules sequentially according to provided array of rule IDs.
   */
  async reorder(
    userId: string,
    dto: ReorderRulesDto,
  ): Promise<TransactionRule[]> {
    return withScopedDb(this.dataSource, async (manager) => {
      const repo = manager.getRepository(TransactionRule);
      const existing = await repo.find({
        where: { userId, id: In(dto.ruleIds) },
      });

      const ruleMap = new Map(existing.map((r) => [r.id, r]));

      const updated: TransactionRule[] = [];
      for (let i = 0; i < dto.ruleIds.length; i++) {
        const r = ruleMap.get(dto.ruleIds[i]);
        if (r) {
          r.priority = i;
          updated.push(r);
        }
      }

      if (updated.length > 0) {
        await repo.save(updated);
      }

      return repo.find({
        where: { userId },
        order: { priority: "ASC", createdAt: "ASC" },
      });
    });
  }

  /**
   * Evaluates rules against a single transaction candidate.
   * Used during real-time transaction creation and statement import.
   */
  async evaluateForTransaction(
    userId: string,
    candidate: RuleEvaluationCandidate,
  ): Promise<RuleMatchResult | null> {
    const rules = await withScopedDb(this.dataSource, (manager) =>
      manager.getRepository(TransactionRule).find({
        where: { userId, isActive: true },
        order: { priority: "ASC", createdAt: "ASC" },
      }),
    );

    return evaluateRules(rules, candidate);
  }

  /**
   * Tests a transient or saved rule against sample data or recent transactions.
   */
  async testRule(userId: string, dto: TestRuleDto): Promise<any> {
    return withScopedDb(this.dataSource, async (manager) => {
      let ruleToTest: Pick<
        TransactionRule,
        "isActive" | "conditions" | "matchMode" | "actions" | "name"
      >;

      if (dto.ruleId) {
        const existing = await manager.getRepository(TransactionRule).findOne({
          where: { id: dto.ruleId, userId },
        });
        if (!existing) {
          throw new NotFoundException("Rule not found");
        }
        ruleToTest = existing;
      } else if (dto.rule) {
        ruleToTest = {
          name: dto.rule.name,
          isActive: dto.rule.isActive ?? true,
          matchMode: dto.rule.matchMode ?? TransactionRule.prototype.matchMode,
          conditions: dto.rule.conditions,
          actions: dto.rule.actions,
        };
      } else {
        throw new BadRequestException(
          "Must provide either ruleId or rule object to test",
        );
      }

      let candidateMatch: { matches: boolean; actions: any } | null = null;
      if (dto.candidate) {
        const matches = evaluateRule(ruleToTest, dto.candidate);
        candidateMatch = {
          matches,
          actions: matches ? ruleToTest.actions : null,
        };
      }

      const sampleMatches: Array<{
        transactionId: string;
        date: string;
        payee: string | null;
        memo: string | null;
        amount: string;
        currentCategoryId: string | null;
        proposedCategoryId: string | null;
      }> = [];

      if (dto.testAgainstRecent) {
        const limit = dto.sampleLimit ?? 20;
        const txs = await manager.getRepository(Transaction).find({
          where: { userId, isTransfer: false, isSplit: false },
          order: { transactionDate: "DESC", createdAt: "DESC" },
          take: limit,
        });

        for (const tx of txs) {
          const cand: RuleEvaluationCandidate = {
            payee: tx.payeeName,
            memo: tx.description,
            amount: tx.amount,
            accountId: tx.accountId,
            paymentMethod: tx.paymentMethod,
          };

          if (evaluateRule(ruleToTest, cand)) {
            sampleMatches.push({
              transactionId: tx.id,
              date: tx.transactionDate,
              payee: tx.payeeName,
              memo: tx.description,
              amount: String(tx.amount),
              currentCategoryId: tx.categoryId,
              proposedCategoryId: ruleToTest.actions?.setCategoryId ?? null,
            });
          }
        }
      }

      return {
        candidateMatch,
        sampleMatches,
        matchedSampleCount: sampleMatches.length,
      };
    });
  }

  /**
   * Applies active rules across existing transactions.
   * By default, only uncategorized transactions are affected (preserving manual categorizations).
   */
  async applyRules(userId: string, dto: ApplyRulesDto): Promise<any> {
    return withScopedDb(this.dataSource, async (manager) => {
      // 1. Load rules to apply
      const ruleRepo = manager.getRepository(TransactionRule);
      let rules: TransactionRule[];

      if (dto.ruleIds && dto.ruleIds.length > 0) {
        rules = await ruleRepo.find({
          where: { userId, id: In(dto.ruleIds), isActive: true },
          order: { priority: "ASC", createdAt: "ASC" },
        });
      } else {
        rules = await ruleRepo.find({
          where: { userId, isActive: true },
          order: { priority: "ASC", createdAt: "ASC" },
        });
      }

      if (rules.length === 0) {
        return {
          matchedCount: 0,
          updatedCount: 0,
          details: [],
        };
      }

      // 2. Query transactions matching the criteria
      const qb = manager
        .getRepository(Transaction)
        .createQueryBuilder("t")
        .where("t.user_id = :userId", { userId })
        .andWhere("t.is_transfer = false")
        .andWhere("t.is_split = false");

      if (dto.onlyUncategorized !== false) {
        qb.andWhere("t.category_id IS NULL");
      }

      if (dto.accountId) {
        qb.andWhere("t.account_id = :accountId", { accountId: dto.accountId });
      }

      if (dto.startDate) {
        qb.andWhere("t.transaction_date >= :startDate", {
          startDate: dto.startDate,
        });
      }

      if (dto.endDate) {
        qb.andWhere("t.transaction_date <= :endDate", { endDate: dto.endDate });
      }

      const transactions = await qb
        .orderBy("t.transaction_date", "DESC")
        .getMany();

      const matchedDetails: Array<{
        transactionId: string;
        ruleId: string;
        ruleName: string;
        payee: string | null;
        amount: string;
        appliedCategoryId: string | null;
      }> = [];

      const updates: Array<{
        id: string;
        categoryId?: string | null;
        payeeId?: string | null;
        payeeName?: string | null;
      }> = [];

      for (const tx of transactions) {
        const candidate: RuleEvaluationCandidate = {
          payee: tx.payeeName,
          memo: tx.description,
          amount: tx.amount,
          accountId: tx.accountId,
          paymentMethod: tx.paymentMethod,
        };

        const result = evaluateRules(rules, candidate);
        if (result) {
          matchedDetails.push({
            transactionId: tx.id,
            ruleId: result.matchedRuleId,
            ruleName: result.matchedRuleName,
            payee: tx.payeeName,
            amount: String(tx.amount),
            appliedCategoryId: result.actions.setCategoryId ?? null,
          });

          const updateObj: any = { id: tx.id };
          let hasChange = false;

          if (result.actions.setCategoryId !== undefined) {
            updateObj.categoryId = result.actions.setCategoryId;
            hasChange = true;
          }
          if (result.actions.setPayeeId !== undefined) {
            updateObj.payeeId = result.actions.setPayeeId;
            hasChange = true;
          }
          if (result.actions.setPayeeName !== undefined) {
            updateObj.payeeName = result.actions.setPayeeName;
            hasChange = true;
          }

          if (hasChange) {
            updates.push(updateObj);
          }
        }
      }

      let updatedCount = 0;
      if (!dto.dryRun && updates.length > 0) {
        for (const u of updates) {
          const { id, ...fields } = u;
          await manager
            .getRepository(Transaction)
            .update({ id, userId }, fields);
        }
        updatedCount = updates.length;
      }

      return {
        matchedCount: matchedDetails.length,
        updatedCount: dto.dryRun ? 0 : updatedCount,
        dryRun: dto.dryRun ?? false,
        details: matchedDetails,
      };
    });
  }
}
