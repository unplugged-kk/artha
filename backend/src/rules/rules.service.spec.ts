import { NotFoundException, BadRequestException } from "@nestjs/common";
import { RulesService } from "./rules.service";
import { TransactionRule } from "./entities/transaction-rule.entity";
import { RuleField, RuleOperator, RuleMatchMode } from "./constants/rule.enums";
import { Category } from "../categories/entities/category.entity";
import { Payee } from "../payees/entities/payee.entity";
import { Transaction } from "../transactions/entities/transaction.entity";

jest.mock("../common/db/scoped-db", () =>
  jest.requireActual("../test-helpers/scoped-db-testing").scopedDbMockModule(),
);

describe("RulesService", () => {
  let service: RulesService;
  let mockDataSource: any;
  let mockManager: any;
  let mockRuleRepo: any;
  let mockCatRepo: any;
  let mockPayeeRepo: any;
  let mockTxRepo: any;

  beforeEach(() => {
    mockRuleRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((_, data) => ({ id: "rule-new", ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 2 }),
      })),
    };

    mockCatRepo = {
      findOne: jest.fn(),
    };

    mockPayeeRepo = {
      findOne: jest.fn(),
    };

    mockTxRepo = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    mockManager = {
      getRepository: jest.fn((entity) => {
        if (entity === TransactionRule) return mockRuleRepo;
        if (entity === Category) return mockCatRepo;
        if (entity === Payee) return mockPayeeRepo;
        if (entity === Transaction) return mockTxRepo;
        return mockRuleRepo;
      }),
      create: jest.fn((entity, data) => mockRuleRepo.create(entity, data)),
      save: jest.fn((entity) => mockRuleRepo.save(entity)),
      remove: jest.fn((entity) => mockRuleRepo.remove(entity)),
      find: jest.fn((entity, options) =>
        mockManager.getRepository(entity).find(options),
      ),
    };

    mockDataSource = {
      transaction: jest.fn((cb) => cb(mockManager)),
    };

    service = new RulesService(mockDataSource);
  });

  describe("findAll", () => {
    it("returns rules ordered by priority ASC", async () => {
      const rules = [
        { id: "r1", name: "Rule 1", priority: 0 },
        { id: "r2", name: "Rule 2", priority: 1 },
      ];
      mockRuleRepo.find.mockResolvedValue(rules);

      const result = await service.findAll("user-1");

      expect(mockRuleRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        order: { priority: "ASC", createdAt: "ASC" },
      });
      expect(result).toEqual(rules);
    });
  });

  describe("findOne", () => {
    it("returns the rule when found", async () => {
      const rule = { id: "r1", name: "Rule 1" };
      mockRuleRepo.findOne.mockResolvedValue(rule);

      const result = await service.findOne("user-1", "r1");
      expect(result).toEqual(rule);
    });

    it("throws NotFoundException when rule is missing", async () => {
      mockRuleRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne("user-1", "r-missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create", () => {
    it("creates a rule with auto-incremented priority", async () => {
      mockCatRepo.findOne.mockResolvedValue({ id: "cat-1", userId: "user-1" });

      const dto = {
        name: "Auto Rule",
        matchMode: RuleMatchMode.ALL,
        conditions: [
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.CONTAINS,
            value: "Uber",
          },
        ],
        actions: {
          setCategoryId: "cat-1",
        },
      };

      const result = await service.create("user-1", dto);

      expect(result.name).toBe("Auto Rule");
      expect(result.priority).toBe(3); // (max 2) + 1
      expect(mockRuleRepo.save).toHaveBeenCalled();
    });

    it("throws BadRequestException if referenced category does not belong to user", async () => {
      mockCatRepo.findOne.mockResolvedValue(null);

      const dto = {
        name: "Invalid Cat Rule",
        conditions: [],
        actions: {
          setCategoryId: "cat-other-user",
        },
      };

      await expect(service.create("user-1", dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("reorder", () => {
    it("reorders rules sequentially", async () => {
      const r1 = { id: "r1", priority: 5 };
      const r2 = { id: "r2", priority: 10 };
      mockRuleRepo.find
        .mockResolvedValueOnce([r1, r2])
        .mockResolvedValueOnce([r2, r1]);

      const result = await service.reorder("user-1", {
        ruleIds: ["r2", "r1"],
      });

      expect(r2.priority).toBe(0);
      expect(r1.priority).toBe(1);
      expect(mockRuleRepo.save).toHaveBeenCalledWith([r2, r1]);
      expect(result).toBeDefined();
    });
  });

  describe("testRule", () => {
    it("tests a transient rule against a candidate transaction", async () => {
      const dto = {
        rule: {
          name: "Test Rule",
          matchMode: RuleMatchMode.ALL,
          conditions: [
            {
              field: RuleField.PAYEE,
              operator: RuleOperator.CONTAINS,
              value: "Starbucks",
            },
          ],
          actions: {
            setCategoryId: "cat-coffee",
          },
        },
        candidate: {
          payee: "Starbucks Coffee Indiranagar",
          amount: -350,
        },
      };

      const result = await service.testRule("user-1", dto);

      expect(result.candidateMatch.matches).toBe(true);
      expect(result.candidateMatch.actions.setCategoryId).toBe("cat-coffee");
    });
  });

  describe("applyRules", () => {
    it("applies matching rules to uncategorized transactions", async () => {
      const activeRule = {
        id: "r1",
        userId: "user-1",
        name: "Zomato -> Dining",
        priority: 0,
        isActive: true,
        matchMode: RuleMatchMode.ALL,
        conditions: [
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.CONTAINS,
            value: "Zomato",
          },
        ],
        actions: {
          setCategoryId: "cat-dining",
        },
      };
      mockRuleRepo.find.mockResolvedValue([activeRule]);

      const tx = {
        id: "tx-1",
        payeeName: "Zomato Limited",
        notes: null,
        amount: -450,
        accountId: "acc-1",
        paymentMethod: "UPI",
      };

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([tx]),
      };
      mockTxRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.applyRules("user-1", {
        onlyUncategorized: true,
        dryRun: false,
      });

      expect(result.matchedCount).toBe(1);
      expect(result.updatedCount).toBe(1);
      expect(mockTxRepo.update).toHaveBeenCalledWith(
        { id: "tx-1", userId: "user-1" },
        { categoryId: "cat-dining" },
      );
    });

    it("supports dryRun mode without writing changes", async () => {
      const activeRule = {
        id: "r1",
        userId: "user-1",
        name: "Uber -> Transport",
        priority: 0,
        isActive: true,
        matchMode: RuleMatchMode.ALL,
        conditions: [
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.CONTAINS,
            value: "Uber",
          },
        ],
        actions: {
          setCategoryId: "cat-transport",
        },
      };
      mockRuleRepo.find.mockResolvedValue([activeRule]);

      const tx = {
        id: "tx-2",
        payeeName: "Uber India",
        notes: null,
        amount: -250,
        accountId: "acc-1",
        paymentMethod: "CARD",
      };

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([tx]),
      };
      mockTxRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.applyRules("user-1", {
        onlyUncategorized: true,
        dryRun: true,
      });

      expect(result.matchedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(result.dryRun).toBe(true);
      expect(mockTxRepo.update).not.toHaveBeenCalled();
    });
  });
});
