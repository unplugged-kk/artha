import { Test, TestingModule } from "@nestjs/testing";
import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";
import {
  GoalType,
  GoalStatus,
  GoalTargetMode,
  GoalContributionStatus,
} from "./constants/goal.enums";

describe("GoalsController", () => {
  let controller: GoalsController;
  let service: any;

  const mockGoalWithProgress: any = {
    id: "goal-1",
    userId: "user-1",
    name: "Emergency Fund",
    type: GoalType.EMERGENCY_FUND,
    status: GoalStatus.ACTIVE,
    targetMode: GoalTargetMode.MONTHS_OF_EXPENSES,
    targetMonths: 6,
    currency: "USD",
    progress: {
      currentAmount: 12000,
      targetAmount: 18000,
      percentage: 66.67,
      remainingAmount: 6000,
      monthsRemaining: 6,
      requiredMonthlyContribution: 1000,
      contributionStatus: GoalContributionStatus.ON_TRACK,
    },
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockGoalWithProgress),
      findAll: jest.fn().mockResolvedValue([mockGoalWithProgress]),
      getSummary: jest.fn().mockResolvedValue({
        totalGoals: 1,
        activeGoals: 1,
        completedGoals: 0,
        totalTargetAmount: 18000,
        totalCurrentAmount: 12000,
        emergencyFundsCount: 1,
      }),
      findOne: jest.fn().mockResolvedValue(mockGoalWithProgress),
      update: jest.fn().mockResolvedValue(mockGoalWithProgress),
      remove: jest.fn().mockResolvedValue(undefined),
      linkTransaction: jest.fn().mockResolvedValue(mockGoalWithProgress),
      unlinkTransaction: jest.fn().mockResolvedValue(mockGoalWithProgress),
      getGoalTransactions: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [{ provide: GoalsService, useValue: service }],
    }).compile();

    controller = module.get<GoalsController>(GoalsController);
  });

  it("create calls service.create with user id and dto", async () => {
    const req = { user: { id: "user-1" } };
    const dto = {
      name: "Emergency Fund",
      type: GoalType.EMERGENCY_FUND,
      targetMonths: 6,
      currency: "USD",
    };

    const result = await controller.create(req, dto as any);

    expect(result).toBe(mockGoalWithProgress);
    expect(service.create).toHaveBeenCalledWith("user-1", dto);
  });

  it("findAll calls service.findAll with filters", async () => {
    const req = { user: { id: "user-1" } };
    const result = await controller.findAll(
      req,
      GoalStatus.ACTIVE,
      GoalType.EMERGENCY_FUND,
    );

    expect(result).toEqual([mockGoalWithProgress]);
    expect(service.findAll).toHaveBeenCalledWith("user-1", {
      status: GoalStatus.ACTIVE,
      type: GoalType.EMERGENCY_FUND,
    });
  });

  it("getSummary calls service.getSummary", async () => {
    const req = { user: { id: "user-1" } };
    const result = await controller.getSummary(req);

    expect(result.totalGoals).toBe(1);
    expect(service.getSummary).toHaveBeenCalledWith("user-1");
  });

  it("findOne calls service.findOne with id", async () => {
    const req = { user: { id: "user-1" } };
    const result = await controller.findOne(req, "goal-1");

    expect(result).toBe(mockGoalWithProgress);
    expect(service.findOne).toHaveBeenCalledWith("user-1", "goal-1");
  });

  it("update calls service.update with id and dto", async () => {
    const req = { user: { id: "user-1" } };
    const dto = { name: "Updated Fund" };
    const result = await controller.update(req, "goal-1", dto);

    expect(result).toBe(mockGoalWithProgress);
    expect(service.update).toHaveBeenCalledWith("user-1", "goal-1", dto);
  });

  it("remove calls service.remove and returns success", async () => {
    const req = { user: { id: "user-1" } };
    const result = await controller.remove(req, "goal-1");

    expect(result).toEqual({ success: true });
    expect(service.remove).toHaveBeenCalledWith("user-1", "goal-1");
  });

  it("linkTransaction calls service.linkTransaction", async () => {
    const req = { user: { id: "user-1" } };
    const dto = { transactionId: "tx-1" };
    const result = await controller.linkTransaction(req, "goal-1", dto);

    expect(result).toBe(mockGoalWithProgress);
    expect(service.linkTransaction).toHaveBeenCalledWith(
      "user-1",
      "goal-1",
      "tx-1",
    );
  });

  it("unlinkTransaction calls service.unlinkTransaction", async () => {
    const req = { user: { id: "user-1" } };
    const result = await controller.unlinkTransaction(req, "goal-1", "tx-1");

    expect(result).toBe(mockGoalWithProgress);
    expect(service.unlinkTransaction).toHaveBeenCalledWith(
      "user-1",
      "goal-1",
      "tx-1",
    );
  });

  it("getGoalTransactions calls service.getGoalTransactions", async () => {
    const req = { user: { id: "user-1" } };
    const result = await controller.getGoalTransactions(req, "goal-1");

    expect(result).toEqual([]);
    expect(service.getGoalTransactions).toHaveBeenCalledWith(
      "user-1",
      "goal-1",
    );
  });
});
