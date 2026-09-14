import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { roundMoney, sumMoney } from "../common/round.util";
import { Goal } from "./entities/goal.entity";
import { GoalTransaction } from "./entities/goal-transaction.entity";
import { Account } from "../accounts/entities/account.entity";
import { Transaction } from "../transactions/entities/transaction.entity";
import {
  GoalType,
  GoalStatus,
  GoalTargetMode,
  GoalContributionStatus,
} from "./constants/goal.enums";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";
import {
  GoalProgress,
  GoalWithProgress,
  GoalsSummary,
} from "./interfaces/goal-progress.interface";
import { calculateGoalProgress } from "./utils/goal-calculator.util";
import { BudgetsService } from "../budgets/budgets.service";
import { ExchangeRateService } from "../currencies/exchange-rate.service";
import { ActionHistoryService } from "../action-history/action-history.service";

@Injectable()
export class GoalsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly budgetsService: BudgetsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly actionHistoryService: ActionHistoryService,
  ) {}

  async create(
    userId: string,
    createGoalDto: CreateGoalDto,
  ): Promise<GoalWithProgress> {
    const type = createGoalDto.type ?? GoalType.REGULAR;
    const targetMode = createGoalDto.targetMode ?? GoalTargetMode.FIXED_AMOUNT;

    // Validate requirements per mode
    if (
      type === GoalType.REGULAR ||
      targetMode === GoalTargetMode.FIXED_AMOUNT
    ) {
      if (
        createGoalDto.targetAmount === undefined ||
        createGoalDto.targetAmount === null ||
        createGoalDto.targetAmount <= 0
      ) {
        throw new BadRequestException(
          "Target amount must be specified and greater than 0 for fixed amount goals",
        );
      }
    }

    if (
      type === GoalType.EMERGENCY_FUND &&
      targetMode === GoalTargetMode.MONTHS_OF_EXPENSES
    ) {
      if (
        createGoalDto.targetMonths === undefined ||
        createGoalDto.targetMonths === null ||
        createGoalDto.targetMonths <= 0
      ) {
        throw new BadRequestException(
          "Target months must be specified and greater than 0 for months of expenses emergency fund",
        );
      }
    }

    // Verify account ownership if accountId is provided
    if (createGoalDto.accountId) {
      await this.verifyAccountOwnership(userId, createGoalDto.accountId);
    }

    const saved = await withScopedDb(this.dataSource, (m) => {
      const repo = m.getRepository(Goal);
      const goal = repo.create({
        ...createGoalDto,
        type,
        targetMode,
        status: GoalStatus.ACTIVE,
        userId,
      });
      return repo.save(goal);
    });

    this.actionHistoryService.record(userId, {
      entityType: "goal",
      entityId: saved.id,
      action: "create",
      afterData: { ...saved },
      description: `Created goal "${saved.name}"`,
      descriptionKey: "createdGoal",
      descriptionParams: { name: saved.name },
    });

    return this.findOne(userId, saved.id);
  }

  async findAll(
    userId: string,
    filters?: { status?: GoalStatus; type?: GoalType },
  ): Promise<GoalWithProgress[]> {
    const goals = await withScopedDb(this.dataSource, (m) => {
      const qb = m
        .getRepository(Goal)
        .createQueryBuilder("goal")
        .leftJoinAndSelect("goal.account", "account")
        .where("goal.userId = :userId", { userId });

      if (filters?.status) {
        qb.andWhere("goal.status = :status", { status: filters.status });
      }

      if (filters?.type) {
        qb.andWhere("goal.type = :type", { type: filters.type });
      }

      qb.orderBy("goal.createdAt", "DESC");
      return qb.getMany();
    });

    // Resolve active budget needs baseline once for user's goals
    const activeNeeds =
      await this.budgetsService.getActiveBudgetNeedsExpenditure(userId);

    const results: GoalWithProgress[] = [];
    for (const goal of goals) {
      const withProgress = await this.enrichGoalWithProgress(
        userId,
        goal,
        activeNeeds,
      );
      results.push(withProgress);
    }

    return results;
  }

  async findOne(userId: string, id: string): Promise<GoalWithProgress> {
    const goal = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).findOne({
        where: { id, userId },
        relations: ["account"],
      }),
    );

    if (!goal) {
      throw new NotFoundException(`Goal with ID "${id}" not found`);
    }

    const activeNeeds =
      await this.budgetsService.getActiveBudgetNeedsExpenditure(userId);
    return this.enrichGoalWithProgress(userId, goal, activeNeeds);
  }

  async update(
    userId: string,
    id: string,
    updateGoalDto: UpdateGoalDto,
  ): Promise<GoalWithProgress> {
    const goal = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).findOne({
        where: { id, userId },
      }),
    );

    if (!goal) {
      throw new NotFoundException(`Goal with ID "${id}" not found`);
    }

    if (
      updateGoalDto.accountId !== undefined &&
      updateGoalDto.accountId !== null
    ) {
      await this.verifyAccountOwnership(userId, updateGoalDto.accountId);
    }

    const beforeData = { ...goal };

    // Apply updates
    if (updateGoalDto.name !== undefined) goal.name = updateGoalDto.name;
    if (updateGoalDto.description !== undefined)
      goal.description = updateGoalDto.description;
    if (updateGoalDto.type !== undefined) goal.type = updateGoalDto.type;
    if (updateGoalDto.status !== undefined) goal.status = updateGoalDto.status;
    if (updateGoalDto.targetMode !== undefined)
      goal.targetMode = updateGoalDto.targetMode;
    if (updateGoalDto.targetAmount !== undefined)
      goal.targetAmount = updateGoalDto.targetAmount;
    if (updateGoalDto.targetMonths !== undefined)
      goal.targetMonths = updateGoalDto.targetMonths;
    if (updateGoalDto.currency !== undefined)
      goal.currency = updateGoalDto.currency;
    if (updateGoalDto.targetDate !== undefined)
      goal.targetDate = updateGoalDto.targetDate;
    if (updateGoalDto.accountId !== undefined)
      goal.accountId = updateGoalDto.accountId;

    const saved = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).save(goal),
    );

    this.actionHistoryService.record(userId, {
      entityType: "goal",
      entityId: saved.id,
      action: "update",
      beforeData,
      afterData: { ...saved },
      description: `Updated goal "${saved.name}"`,
      descriptionKey: "updatedGoal",
      descriptionParams: { name: saved.name },
    });

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const goal = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).findOne({
        where: { id, userId },
      }),
    );

    if (!goal) {
      throw new NotFoundException(`Goal with ID "${id}" not found`);
    }

    await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).remove(goal),
    );

    this.actionHistoryService.record(userId, {
      entityType: "goal",
      entityId: id,
      action: "delete",
      beforeData: { ...goal },
      description: `Deleted goal "${goal.name}"`,
      descriptionKey: "deletedGoal",
      descriptionParams: { name: goal.name },
    });
  }

  async linkTransaction(
    userId: string,
    goalId: string,
    transactionId: string,
  ): Promise<GoalWithProgress> {
    const goal = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).findOne({
        where: { id: goalId, userId },
      }),
    );

    if (!goal) {
      throw new NotFoundException(`Goal with ID "${goalId}" not found`);
    }

    // Verify transaction exists and belongs to user
    const tx = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Transaction).findOne({
        where: { id: transactionId, userId },
      }),
    );

    if (!tx) {
      throw new NotFoundException(
        `Transaction with ID "${transactionId}" not found`,
      );
    }

    await withScopedDb(this.dataSource, async (m) => {
      const repo = m.getRepository(GoalTransaction);
      const existing = await repo.findOne({
        where: { goalId, transactionId },
      });
      if (!existing) {
        await repo.save(
          repo.create({
            userId,
            goalId,
            transactionId,
          }),
        );
      }
    });

    return this.findOne(userId, goalId);
  }

  async unlinkTransaction(
    userId: string,
    goalId: string,
    transactionId: string,
  ): Promise<GoalWithProgress> {
    const goal = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).findOne({
        where: { id: goalId, userId },
      }),
    );

    if (!goal) {
      throw new NotFoundException(`Goal with ID "${goalId}" not found`);
    }

    await withScopedDb(this.dataSource, async (m) => {
      const repo = m.getRepository(GoalTransaction);
      const link = await repo.findOne({
        where: { goalId, transactionId, userId },
      });
      if (link) {
        await repo.remove(link);
      }
    });

    return this.findOne(userId, goalId);
  }

  async getGoalTransactions(
    userId: string,
    goalId: string,
  ): Promise<Transaction[]> {
    const goal = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Goal).findOne({
        where: { id: goalId, userId },
      }),
    );

    if (!goal) {
      throw new NotFoundException(`Goal with ID "${goalId}" not found`);
    }

    const links = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(GoalTransaction).find({
        where: { goalId, userId },
        relations: [
          "transaction",
          "transaction.account",
          "transaction.category",
        ],
        order: { createdAt: "DESC" },
      }),
    );

    return links.map((l) => l.transaction).filter(Boolean);
  }

  async getSummary(userId: string): Promise<GoalsSummary> {
    const allGoals = await this.findAll(userId);

    const totalGoals = allGoals.length;
    let activeGoals = 0;
    let completedGoals = 0;
    let totalTargetAmount = 0;
    let totalCurrentAmount = 0;
    let emergencyFundsCount = 0;

    for (const g of allGoals) {
      if (
        g.status === GoalStatus.COMPLETED ||
        g.progress.contributionStatus === GoalContributionStatus.COMPLETED
      ) {
        completedGoals++;
      } else if (g.status === GoalStatus.ACTIVE) {
        activeGoals++;
      }

      if (g.type === GoalType.EMERGENCY_FUND) {
        emergencyFundsCount++;
      }

      if (g.progress.targetAmount !== null) {
        totalTargetAmount = roundMoney(
          totalTargetAmount + g.progress.targetAmount,
        );
      }
      if (g.progress.currentAmount !== null) {
        totalCurrentAmount = roundMoney(
          totalCurrentAmount + g.progress.currentAmount,
        );
      }
    }

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      totalTargetAmount,
      totalCurrentAmount,
      emergencyFundsCount,
    };
  }

  private async verifyAccountOwnership(
    userId: string,
    accountId: string,
  ): Promise<Account> {
    const account = await withScopedDb(this.dataSource, (m) =>
      m.getRepository(Account).findOne({
        where: { id: accountId, userId },
      }),
    );

    if (!account) {
      throw new NotFoundException(`Account with ID "${accountId}" not found`);
    }

    return account;
  }

  private async enrichGoalWithProgress(
    userId: string,
    goal: Goal,
    activeNeeds: { monthlyNeeds: number; currency: string } | null,
  ): Promise<GoalWithProgress> {
    let currentAmount: number | null = 0;
    let isFxUnavailable = false;
    let linkedAccount: GoalProgress["linkedAccount"] = null;
    let linkedTransactionCount = 0;

    if (goal.accountId && goal.account) {
      const acc = goal.account;
      linkedAccount = {
        id: acc.id,
        name: acc.name,
        currency: acc.currencyCode,
        balance: acc.currentBalance,
      };

      if (acc.currencyCode === goal.currency) {
        currentAmount = acc.currentBalance;
      } else {
        const rate = await this.exchangeRateService.getLatestRate(
          acc.currencyCode,
          goal.currency,
          30,
        );
        if (rate !== null && rate > 0) {
          currentAmount = roundMoney(acc.currentBalance * rate);
        } else {
          isFxUnavailable = true;
          currentAmount = null;
        }
      }
    } else {
      // Aggregate positive inflows from linked transactions
      const links = await withScopedDb(this.dataSource, (m) =>
        m.getRepository(GoalTransaction).find({
          where: { goalId: goal.id, userId },
          relations: ["transaction"],
        }),
      );

      linkedTransactionCount = links.length;
      const amounts: number[] = [];

      for (const link of links) {
        if (!link.transaction) continue;
        const tx = link.transaction;
        // Positive inflow towards goal
        if (tx.amount > 0) {
          if (tx.currencyCode === goal.currency) {
            amounts.push(tx.amount);
          } else {
            const rate = await this.exchangeRateService.getLatestRate(
              tx.currencyCode,
              goal.currency,
              30,
            );
            if (rate !== null && rate > 0) {
              amounts.push(roundMoney(tx.amount * rate));
            } else {
              isFxUnavailable = true;
            }
          }
        }
      }

      if (isFxUnavailable) {
        currentAmount = null;
      } else {
        currentAmount = sumMoney(amounts);
      }
    }

    // Resolve baselineMonthlyExpense if MONTHS_OF_EXPENSES
    let baselineMonthlyExpense: number | null = null;
    if (goal.targetMode === GoalTargetMode.MONTHS_OF_EXPENSES) {
      if (activeNeeds && activeNeeds.monthlyNeeds > 0) {
        if (activeNeeds.currency === goal.currency) {
          baselineMonthlyExpense = activeNeeds.monthlyNeeds;
        } else {
          const rate = await this.exchangeRateService.getLatestRate(
            activeNeeds.currency,
            goal.currency,
            30,
          );
          if (rate !== null && rate > 0) {
            baselineMonthlyExpense = roundMoney(
              activeNeeds.monthlyNeeds * rate,
            );
          } else {
            baselineMonthlyExpense = null;
            isFxUnavailable = true;
          }
        }
      } else {
        baselineMonthlyExpense = null;
      }
    }

    const progress = calculateGoalProgress({
      type: goal.type,
      status: goal.status,
      targetMode: goal.targetMode,
      targetAmount: goal.targetAmount,
      targetMonths: goal.targetMonths,
      currency: goal.currency,
      targetDate: goal.targetDate,
      currentAmount,
      baselineMonthlyExpense,
      isFxUnavailable,
      linkedAccount,
      linkedTransactionCount,
    });

    return {
      ...goal,
      progress,
    };
  }
}
