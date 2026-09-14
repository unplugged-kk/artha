import { RulesController } from "./rules.controller";
import { RulesService } from "./rules.service";
import { RuleMatchMode } from "./constants/rule.enums";

describe("RulesController", () => {
  let controller: RulesController;
  let mockService: Partial<RulesService>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: "rule-1" }),
      create: jest.fn().mockResolvedValue({ id: "rule-1" }),
      update: jest.fn().mockResolvedValue({ id: "rule-1" }),
      remove: jest.fn().mockResolvedValue(undefined),
      reorder: jest.fn().mockResolvedValue([]),
      testRule: jest.fn().mockResolvedValue({ matched: true }),
      applyRules: jest
        .fn()
        .mockResolvedValue({ matchedCount: 5, updatedCount: 5 }),
    };

    controller = new RulesController(mockService as RulesService);
  });

  it("calls findAll with req.user.id", async () => {
    const req = { user: { id: "user-123" } };
    await controller.findAll(req);
    expect(mockService.findAll).toHaveBeenCalledWith("user-123");
  });

  it("calls findOne with req.user.id and id", async () => {
    const req = { user: { id: "user-123" } };
    await controller.findOne(req, "rule-1");
    expect(mockService.findOne).toHaveBeenCalledWith("user-123", "rule-1");
  });

  it("calls create with req.user.id and dto", async () => {
    const req = { user: { id: "user-123" } };
    const dto = {
      name: "Test",
      matchMode: RuleMatchMode.ALL,
      conditions: [],
      actions: {},
    };
    await controller.create(req, dto);
    expect(mockService.create).toHaveBeenCalledWith("user-123", dto);
  });

  it("calls reorder with req.user.id and dto", async () => {
    const req = { user: { id: "user-123" } };
    const dto = { ruleIds: ["rule-2", "rule-1"] };
    await controller.reorder(req, dto);
    expect(mockService.reorder).toHaveBeenCalledWith("user-123", dto);
  });

  it("calls test with req.user.id and dto", async () => {
    const req = { user: { id: "user-123" } };
    const dto = { ruleId: "rule-1" };
    await controller.test(req, dto);
    expect(mockService.testRule).toHaveBeenCalledWith("user-123", dto);
  });

  it("calls apply with req.user.id and dto", async () => {
    const req = { user: { id: "user-123" } };
    const dto = { onlyUncategorized: true };
    await controller.apply(req, dto);
    expect(mockService.applyRules).toHaveBeenCalledWith("user-123", dto);
  });

  it("calls remove with req.user.id and id", async () => {
    const req = { user: { id: "user-123" } };
    await controller.remove(req, "rule-1");
    expect(mockService.remove).toHaveBeenCalledWith("user-123", "rule-1");
  });
});
