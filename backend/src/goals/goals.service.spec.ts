import { NotFoundException, BadRequestException } from "@nestjs/common";
import { GoalsService } from "./goals.service";
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

jest.mock("../common/db/scoped-db", () =>
  jest.requireActual("../test-helpers/scoped-db-testing").scopedDbMockModule(),
);

describe("GoalsService", () => {
  let service: GoalsService;

  let goalRepoMock: any;
  let goalTxRepoMock: any;
  let accountRepoMock: any;
  let txRepoMock: any;
  let qbMock: any;
  let mockManager: any;
  let mockDataSource: any;

  const mockBudgetsService = {
    getActiveBudgetNeedsExpenditure: jest.fn(),
  };

  const mockExchangeRateService = {
    getLatestRate: jest.fn(),
  };

  const mockActionHistoryService = {
    record: jest.fn(),
  };

  const mockGoal: Partial<Goal> = {
    id: "goal-1",
    userId: "user-1",
    name: "Vacation",
    description: "Trip to Japan",
    type: GoalType.REGULAR,
    status: GoalStatus.ACTIVE,
    targetMode: GoalTargetMode.FIXED_AMOUNT,
    targetAmount: 5000,
    targetMonths: null,
    currency: "USD",
    targetDate: "2026-12-31",
    accountId: null,
    account: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAccount: Partial<Account> = {
    id: "acc-1",
    userId: "user-1",
    name: "Savings",
    currencyCode: "USD",
    currentBalance: 3000,
  };

  const mockTransaction: Partial<Transaction> = {
    id: "tx-1",
    userId: "user-1",
    amount: 1500,
    currencyCode: "USD",
    transactionDate: "2026-09-01",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    goalRepoMock = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: "goal-1" })),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ ...entity, id: entity.id || "goal-1" }),
        ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    goalTxRepoMock = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: "gt-1" })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue({}),
    };

    accountRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    txRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Goal) return goalRepoMock;
        if (entity === GoalTransaction) return goalTxRepoMock;
        if (entity === Account) return accountRepoMock;
        if (entity === Transaction) return txRepoMock;
        return goalRepoMock;
      }),
    };

    mockDataSource = {
      transaction: jest.fn((cb) => cb(mockManager)),
    };

    service = new GoalsService(
      mockDataSource as any,
      mockBudgetsService as any,
      mockExchangeRateService as any,
      mockActionHistoryService as any,
    );
  });

  describe("create", () => {
    it("creates a regular fixed-amount goal successfully", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      goalRepoMock.create.mockReturnValue({ ...mockGoal });
      goalRepoMock.save.mockResolvedValue({ ...mockGoal });
      goalRepoMock.findOne.mockResolvedValue({ ...mockGoal });
      goalTxRepoMock.find.mockResolvedValue([]);

      const result = await service.create("user-1", {
        name: "Vacation",
        targetAmount: 5000,
        currency: "USD",
        targetDate: "2026-12-31",
      });

      expect(result.id).toBe("goal-1");
      expect(result.progress.targetAmount).toBe(5000);
      expect(mockActionHistoryService.record).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          entityType: "goal",
          action: "create",
        }),
      );
    });

    it("creates an emergency fund goal with months of expenses mode", async () => {
      const emergencyGoal: Partial<Goal> = {
        ...mockGoal,
        id: "goal-ef",
        name: "Emergency Fund",
        type: GoalType.EMERGENCY_FUND,
        targetMode: GoalTargetMode.MONTHS_OF_EXPENSES,
        targetAmount: null,
        targetMonths: 6,
      };

      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue({
        monthlyNeeds: 3000,
        currency: "USD",
      });

      goalRepoMock.create.mockReturnValue(emergencyGoal);
      goalRepoMock.save.mockResolvedValue(emergencyGoal);
      goalRepoMock.findOne.mockResolvedValue(emergencyGoal);
      goalTxRepoMock.find.mockResolvedValue([]);

      const result = await service.create("user-1", {
        name: "Emergency Fund",
        type: GoalType.EMERGENCY_FUND,
        targetMode: GoalTargetMode.MONTHS_OF_EXPENSES,
        targetMonths: 6,
        currency: "USD",
      });

      expect(result.progress.targetAmount).toBe(18000); // 3000 * 6
      expect(result.progress.baselineMonthlyExpense).toBe(3000);
    });

    it("throws BadRequestException if fixed amount goal has no targetAmount", async () => {
      await expect(
        service.create("user-1", {
          name: "Car",
          currency: "USD",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException if months of expenses emergency fund has no targetMonths", async () => {
      await expect(
        service.create("user-1", {
          name: "Rainy Day",
          type: GoalType.EMERGENCY_FUND,
          targetMode: GoalTargetMode.MONTHS_OF_EXPENSES,
          currency: "USD",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("validates account ownership and throws NotFoundException if account not found", async () => {
      accountRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.create("user-1", {
          name: "Emergency Fund",
          targetAmount: 5000,
          currency: "USD",
          accountId: "non-existent-acc",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("returns all goals for the user enriched with progress", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      qbMock.getMany.mockResolvedValue([{ ...mockGoal }]);
      goalTxRepoMock.find.mockResolvedValue([]);

      const result = await service.findAll("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Vacation");
      expect(result[0].progress.targetAmount).toBe(5000);
    });
  });

  describe("findOne", () => {
    it("returns a goal with progress", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      goalRepoMock.findOne.mockResolvedValue({ ...mockGoal });
      goalTxRepoMock.find.mockResolvedValue([]);

      const result = await service.findOne("user-1", "goal-1");

      expect(result.id).toBe("goal-1");
      expect(result.progress.targetAmount).toBe(5000);
    });

    it("throws NotFoundException when goal does not exist", async () => {
      goalRepoMock.findOne.mockResolvedValue(null);

      await expect(service.findOne("user-1", "unknown-goal")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("updates goal fields and records action history", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      goalRepoMock.findOne.mockResolvedValue({ ...mockGoal });
      goalRepoMock.save.mockImplementation(async (g: any) => g);
      goalTxRepoMock.find.mockResolvedValue([]);

      const result = await service.update("user-1", "goal-1", {
        name: "Europe Vacation",
        targetAmount: 6000,
      });

      expect(result.name).toBe("Europe Vacation");
      expect(mockActionHistoryService.record).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          entityType: "goal",
          action: "update",
        }),
      );
    });

    it("throws NotFoundException when updating non-existent goal", async () => {
      goalRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.update("user-1", "unknown-goal", { name: "New" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("deletes goal and records action history", async () => {
      goalRepoMock.findOne.mockResolvedValue({ ...mockGoal });
      goalRepoMock.remove.mockResolvedValue({ ...mockGoal });

      await service.remove("user-1", "goal-1");

      expect(goalRepoMock.remove).toHaveBeenCalled();
      expect(mockActionHistoryService.record).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          entityType: "goal",
          action: "delete",
        }),
      );
    });

    it("throws NotFoundException when deleting non-existent goal", async () => {
      goalRepoMock.findOne.mockResolvedValue(null);

      await expect(service.remove("user-1", "unknown-goal")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("linkTransaction and unlinkTransaction", () => {
    it("links transaction to goal", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      goalRepoMock.findOne.mockResolvedValue({ ...mockGoal });
      txRepoMock.findOne.mockResolvedValue(mockTransaction);
      goalTxRepoMock.findOne.mockResolvedValue(null);
      goalTxRepoMock.create.mockReturnValue({
        userId: "user-1",
        goalId: "goal-1",
        transactionId: "tx-1",
      });
      goalTxRepoMock.save.mockResolvedValue({});
      goalTxRepoMock.find.mockResolvedValue([
        {
          id: "gt-1",
          userId: "user-1",
          goalId: "goal-1",
          transactionId: "tx-1",
          transaction: mockTransaction,
        },
      ]);

      const result = await service.linkTransaction("user-1", "goal-1", "tx-1");

      expect(result.id).toBe("goal-1");
      expect(result.progress.currentAmount).toBe(1500);
      expect(result.progress.linkedTransactionCount).toBe(1);
    });

    it("unlinks transaction from goal", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      goalRepoMock.findOne.mockResolvedValue({ ...mockGoal });
      const link = {
        id: "gt-1",
        userId: "user-1",
        goalId: "goal-1",
        transactionId: "tx-1",
      };
      goalTxRepoMock.findOne.mockResolvedValue(link);
      goalTxRepoMock.remove.mockResolvedValue(link);
      goalTxRepoMock.find.mockResolvedValue([]);

      const result = await service.unlinkTransaction(
        "user-1",
        "goal-1",
        "tx-1",
      );

      expect(result.id).toBe("goal-1");
      expect(result.progress.currentAmount).toBe(0);
      expect(goalTxRepoMock.remove).toHaveBeenCalledWith(link);
    });
  });

  describe("account-linked progress derivation", () => {
    it("uses account currentBalance directly when currencies match", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      const goalWithAccount: Partial<Goal> = {
        ...mockGoal,
        accountId: "acc-1",
        account: mockAccount as Account,
      };

      goalRepoMock.findOne.mockResolvedValue(goalWithAccount);

      const result = await service.findOne("user-1", "goal-1");

      expect(result.progress.currentAmount).toBe(3000);
      expect(result.progress.percentage).toBe(60);
      expect(result.progress.linkedAccount?.balance).toBe(3000);
    });

    it("converts account currentBalance when currencies differ", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      const cadAccount: Partial<Account> = {
        ...mockAccount,
        currencyCode: "CAD",
        currentBalance: 4000,
      };
      const goalWithAccount: Partial<Goal> = {
        ...mockGoal,
        currency: "USD",
        accountId: "acc-1",
        account: cadAccount as Account,
      };

      goalRepoMock.findOne.mockResolvedValue(goalWithAccount);
      mockExchangeRateService.getLatestRate.mockResolvedValue(0.75); // 1 CAD = 0.75 USD

      const result = await service.findOne("user-1", "goal-1");

      expect(result.progress.currentAmount).toBe(3000); // 4000 * 0.75
      expect(result.progress.percentage).toBe(60);
    });

    it("sets isFxUnavailable when exchange rate is missing for foreign account", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      const cadAccount: Partial<Account> = {
        ...mockAccount,
        currencyCode: "CAD",
        currentBalance: 4000,
      };
      const goalWithAccount: Partial<Goal> = {
        ...mockGoal,
        currency: "USD",
        accountId: "acc-1",
        account: cadAccount as Account,
      };

      goalRepoMock.findOne.mockResolvedValue(goalWithAccount);
      mockExchangeRateService.getLatestRate.mockResolvedValue(null);

      const result = await service.findOne("user-1", "goal-1");

      expect(result.progress.isFxUnavailable).toBe(true);
      expect(result.progress.currentAmount).toBeNull();
      expect(result.progress.contributionStatus).toBe(
        GoalContributionStatus.UNAVAILABLE,
      );
    });
  });

  describe("getSummary", () => {
    it("aggregates summary across all goals correctly", async () => {
      mockBudgetsService.getActiveBudgetNeedsExpenditure.mockResolvedValue(
        null,
      );
      qbMock.getMany.mockResolvedValue([
        {
          ...mockGoal,
          id: "g-1",
          status: GoalStatus.ACTIVE,
          targetAmount: 5000,
        },
        {
          ...mockGoal,
          id: "g-2",
          type: GoalType.EMERGENCY_FUND,
          status: GoalStatus.COMPLETED,
          targetAmount: 10000,
        },
      ]);
      goalTxRepoMock.find.mockResolvedValue([]);

      const summary = await service.getSummary("user-1");

      expect(summary.totalGoals).toBe(2);
      expect(summary.activeGoals).toBe(1);
      expect(summary.completedGoals).toBe(1);
      expect(summary.totalTargetAmount).toBe(15000);
      expect(summary.emergencyFundsCount).toBe(1);
    });
  });
});
