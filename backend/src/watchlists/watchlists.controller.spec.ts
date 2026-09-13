import { Test, TestingModule } from "@nestjs/testing";
import { WatchlistsController } from "./watchlists.controller";
import { WatchlistsService } from "./watchlists.service";

describe("WatchlistsController", () => {
  let controller: WatchlistsController;
  let service: any;

  const mockUser = { id: "user-1" };
  const mockReq = { user: mockUser };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      reorderItems: jest.fn(),
      reorderWatchlists: jest.fn(),
      refreshQuotes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatchlistsController],
      providers: [{ provide: WatchlistsService, useValue: service }],
    }).compile();

    controller = module.get<WatchlistsController>(WatchlistsController);
  });

  it("delegates findAll to service", async () => {
    service.findAll.mockResolvedValue([]);
    const res = await controller.findAll(mockReq);
    expect(service.findAll).toHaveBeenCalledWith("user-1");
    expect(res).toEqual([]);
  });

  it("delegates create to service", async () => {
    const dto = { name: "Tech" };
    service.create.mockResolvedValue({ id: "w-1", ...dto });
    const res = await controller.create(mockReq, dto);
    expect(service.create).toHaveBeenCalledWith("user-1", dto);
    expect(res.id).toBe("w-1");
  });

  it("delegates findOne to service", async () => {
    service.findOne.mockResolvedValue({ id: "w-1" });
    const res = await controller.findOne(mockReq, "w-1");
    expect(service.findOne).toHaveBeenCalledWith("user-1", "w-1");
    expect(res.id).toBe("w-1");
  });

  it("delegates update to service", async () => {
    const dto = { name: "Updated" };
    service.update.mockResolvedValue({ id: "w-1", ...dto });
    const res = await controller.update(mockReq, "w-1", dto);
    expect(service.update).toHaveBeenCalledWith("user-1", "w-1", dto);
    expect(res.name).toBe("Updated");
  });

  it("delegates remove to service", async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove(mockReq, "w-1");
    expect(service.remove).toHaveBeenCalledWith("user-1", "w-1");
  });

  it("delegates addItem to service", async () => {
    const dto = { securityId: "sec-1" };
    service.addItem.mockResolvedValue({ id: "item-1" });
    const res = await controller.addItem(mockReq, "w-1", dto);
    expect(service.addItem).toHaveBeenCalledWith("user-1", "w-1", dto);
    expect(res.id).toBe("item-1");
  });

  it("delegates removeItem to service", async () => {
    service.removeItem.mockResolvedValue(undefined);
    await controller.removeItem(mockReq, "w-1", "item-1");
    expect(service.removeItem).toHaveBeenCalledWith("user-1", "w-1", "item-1");
  });

  it("delegates reorderItems to service", async () => {
    const dto = { itemIds: ["item-2", "item-1"] };
    service.reorderItems.mockResolvedValue(undefined);
    await controller.reorderItems(mockReq, "w-1", dto);
    expect(service.reorderItems).toHaveBeenCalledWith("user-1", "w-1", dto);
  });

  it("delegates reorderWatchlists to service", async () => {
    const dto = { watchlistIds: ["w-2", "w-1"] };
    service.reorderWatchlists.mockResolvedValue(undefined);
    await controller.reorderWatchlists(mockReq, dto);
    expect(service.reorderWatchlists).toHaveBeenCalledWith("user-1", dto);
  });

  it("delegates refreshQuotes to service", async () => {
    service.refreshQuotes.mockResolvedValue({ id: "w-1" });
    const res = await controller.refreshQuotes(mockReq, "w-1");
    expect(service.refreshQuotes).toHaveBeenCalledWith("user-1", "w-1");
    expect(res.id).toBe("w-1");
  });
});
