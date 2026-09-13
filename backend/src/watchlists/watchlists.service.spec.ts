import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { WatchlistsService } from "./watchlists.service";
import { Watchlist } from "./entities/watchlist.entity";
import { WatchlistItem } from "./entities/watchlist-item.entity";
import { Security } from "../securities/entities/security.entity";
import { SecurityPriceService } from "../securities/security-price.service";

jest.mock("../common/db/scoped-db", () =>
  jest.requireActual("../test-helpers/scoped-db-testing").scopedDbMockModule(),
);

describe("WatchlistsService", () => {
  let service: WatchlistsService;
  let mockDataSource: any;
  let mockSecurityPriceService: any;
  let mockEntityManager: any;
  let mockWatchlistRepo: any;
  let mockItemRepo: any;
  let mockSecurityRepo: any;

  beforeEach(async () => {
    mockWatchlistRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({
        ...dto,
        id: "w-new",
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn((entity) => Promise.resolve(entity)),
    };

    mockItemRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({
        ...dto,
        id: "item-new",
        createdAt: new Date(),
      })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn((entity) => Promise.resolve(entity)),
    };

    mockSecurityRepo = {
      findOne: jest.fn(),
    };

    mockEntityManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Watchlist) return mockWatchlistRepo;
        if (entity === WatchlistItem) return mockItemRepo;
        if (entity === Security) return mockSecurityRepo;
        return null;
      }),
      query: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn((cb) => cb(mockEntityManager)),
    };

    mockSecurityPriceService = {
      refreshPricesForSecurities: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchlistsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: SecurityPriceService, useValue: mockSecurityPriceService },
      ],
    }).compile();

    service = module.get<WatchlistsService>(WatchlistsService);
  });

  describe("findAll", () => {
    it("returns empty array when user has no watchlists", async () => {
      mockWatchlistRepo.find.mockResolvedValue([]);
      const result = await service.findAll("user-1");
      expect(result).toEqual([]);
    });

    it("returns watchlists with item counts", async () => {
      const w1 = {
        id: "w-1",
        userId: "user-1",
        name: "Tech",
        description: "Tech stocks",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const w2 = {
        id: "w-2",
        userId: "user-1",
        name: "Energy",
        description: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockWatchlistRepo.find.mockResolvedValue([w1, w2]);
      mockEntityManager.query.mockResolvedValue([
        { watchlist_id: "w-1", count: "3" },
        { watchlist_id: "w-2", count: "0" },
      ]);

      const result = await service.findAll("user-1");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("w-1");
      expect(result[0].itemCount).toBe(3);
      expect(result[1].id).toBe("w-2");
      expect(result[1].itemCount).toBe(0);
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException if watchlist does not exist", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne("user-1", "non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns watchlist with empty items if no items present", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
        name: "Tech",
        description: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockItemRepo.find.mockResolvedValue([]);

      const result = await service.findOne("user-1", "w-1");
      expect(result.id).toBe("w-1");
      expect(result.items).toEqual([]);
    });

    it("returns items with available quote status, correct change, and change percent", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
        name: "Tech",
        description: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockItemRepo.find.mockResolvedValue([
        {
          id: "item-1",
          watchlistId: "w-1",
          securityId: "sec-1",
          sortOrder: 0,
          createdAt: new Date(),
          security: {
            id: "sec-1",
            symbol: "TCS",
            name: "Tata Consultancy Services",
            currencyCode: "INR",
            exchange: "NSE",
            isin: "INE467B01029",
          },
        },
      ]);
      mockEntityManager.query.mockResolvedValue([
        {
          security_id: "sec-1",
          close_price: "4200.00",
          price_date: "2026-09-12",
          rn: "1",
        },
        {
          security_id: "sec-1",
          close_price: "4000.00",
          price_date: "2026-09-11",
          rn: "2",
        },
      ]);

      const result = await service.findOne("user-1", "w-1");
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.quote.status).toBe("available");
      expect(item.quote.currentPrice).toBe(4200);
      expect(item.quote.previousPrice).toBe(4000);
      expect(item.quote.dailyChange).toBe(200);
      expect(item.quote.dailyChangePercent).toBe(5);
      expect(item.quote.priceDate).toBe("2026-09-12");
    });

    it("returns explicit unavailable status with null prices when no quote rows exist (never 0)", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
        name: "Tech",
        description: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockItemRepo.find.mockResolvedValue([
        {
          id: "item-1",
          watchlistId: "w-1",
          securityId: "sec-unpriced",
          sortOrder: 0,
          createdAt: new Date(),
          security: {
            id: "sec-unpriced",
            symbol: "UNPRICED",
            name: "Unpriced Corp",
            currencyCode: "INR",
          },
        },
      ]);
      mockEntityManager.query.mockResolvedValue([]);

      const result = await service.findOne("user-1", "w-1");
      const item = result.items[0];
      expect(item.quote.status).toBe("unavailable");
      expect(item.quote.currentPrice).toBeNull();
      expect(item.quote.previousPrice).toBeNull();
      expect(item.quote.dailyChange).toBeNull();
      expect(item.quote.dailyChangePercent).toBeNull();
      expect(item.quote.priceDate).toBeNull();
    });
  });

  describe("create", () => {
    it("rejects empty name with BadRequestException", async () => {
      await expect(service.create("user-1", { name: "   " })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws ConflictException on duplicate name", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-existing",
        name: "Tech",
      });
      await expect(service.create("user-1", { name: "Tech" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("creates watchlist with auto-computed sortOrder when none provided", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      mockEntityManager.query.mockResolvedValue([{ max_sort: 2 }]);

      const result = await service.create("user-1", {
        name: "Dividend Aristocrats",
      });
      expect(mockWatchlistRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          name: "Dividend Aristocrats",
          sortOrder: 3,
        }),
      );
      expect(result.name).toBe("Dividend Aristocrats");
    });
  });

  describe("update", () => {
    it("throws NotFoundException if watchlist not found", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update("user-1", "w-1", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException if renaming to existing name", async () => {
      mockWatchlistRepo.findOne
        .mockResolvedValueOnce({
          id: "w-1",
          userId: "user-1",
          name: "Old Name",
        })
        .mockResolvedValueOnce({
          id: "w-2",
          userId: "user-1",
          name: "Existing Name",
        });

      await expect(
        service.update("user-1", "w-1", { name: "Existing Name" }),
      ).rejects.toThrow(ConflictException);
    });

    it("updates watchlist name and description", async () => {
      const watchlist = {
        id: "w-1",
        userId: "user-1",
        name: "Old Name",
        description: null,
        sortOrder: 0,
      };
      mockWatchlistRepo.findOne
        .mockResolvedValueOnce(watchlist)
        .mockResolvedValueOnce(null); // No conflict
      mockEntityManager.query.mockResolvedValue([{ count: "2" }]);

      const result = await service.update("user-1", "w-1", {
        name: "New Name",
        description: "Updated notes",
      });
      expect(result.name).toBe("New Name");
      expect(result.description).toBe("Updated notes");
      expect(result.itemCount).toBe(2);
    });
  });

  describe("remove", () => {
    it("throws NotFoundException if not found", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      await expect(service.remove("user-1", "w-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("removes the watchlist", async () => {
      const watchlist = { id: "w-1", userId: "user-1" };
      mockWatchlistRepo.findOne.mockResolvedValue(watchlist);
      await service.remove("user-1", "w-1");
      expect(mockWatchlistRepo.remove).toHaveBeenCalledWith(watchlist);
    });
  });

  describe("addItem", () => {
    it("throws NotFoundException if watchlist does not exist", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addItem("user-1", "w-1", { securityId: "sec-1" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException if security does not exist", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
      });
      mockSecurityRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addItem("user-1", "w-1", { securityId: "sec-1" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException if security already in watchlist", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
      });
      mockSecurityRepo.findOne.mockResolvedValue({
        id: "sec-1",
        userId: "user-1",
      });
      mockItemRepo.findOne.mockResolvedValue({ id: "item-1" });

      await expect(
        service.addItem("user-1", "w-1", { securityId: "sec-1" }),
      ).rejects.toThrow(ConflictException);
    });

    it("adds item and auto-computes sortOrder", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
      });
      mockSecurityRepo.findOne.mockResolvedValue({
        id: "sec-1",
        userId: "user-1",
        symbol: "INFY",
        name: "Infosys",
        currencyCode: "INR",
      });
      mockItemRepo.findOne.mockResolvedValue(null);
      mockEntityManager.query
        .mockResolvedValueOnce([{ max_sort: 1 }]) // sortOrder query
        .mockResolvedValueOnce([
          { rn: "1", close_price: "1850.50", price_date: "2026-09-12" },
        ]); // quote query

      const result = await service.addItem("user-1", "w-1", {
        securityId: "sec-1",
      });
      expect(mockItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          watchlistId: "w-1",
          securityId: "sec-1",
          sortOrder: 2,
        }),
      );
      expect(result.security.symbol).toBe("INFY");
      expect(result.quote.status).toBe("available");
      expect(result.quote.currentPrice).toBe(1850.5);
    });
  });

  describe("removeItem", () => {
    it("throws NotFoundException if watchlist does not exist", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      await expect(
        service.removeItem("user-1", "w-1", "item-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException if item does not exist in watchlist", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
      });
      mockItemRepo.findOne.mockResolvedValue(null);
      await expect(
        service.removeItem("user-1", "w-1", "item-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("removes item", async () => {
      const item = { id: "item-1", watchlistId: "w-1", userId: "user-1" };
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
      });
      mockItemRepo.findOne.mockResolvedValue(item);

      await service.removeItem("user-1", "w-1", "item-1");
      expect(mockItemRepo.remove).toHaveBeenCalledWith(item);
    });
  });

  describe("reorderItems", () => {
    it("throws BadRequestException if item does not belong to watchlist", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
      });
      mockItemRepo.find.mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);

      await expect(
        service.reorderItems("user-1", "w-1", {
          itemIds: ["item-1", "item-foreign"],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates sort_order in transaction", async () => {
      mockWatchlistRepo.findOne.mockResolvedValue({
        id: "w-1",
        userId: "user-1",
      });
      mockItemRepo.find.mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
      mockEntityManager.query.mockResolvedValue([]);

      await service.reorderItems("user-1", "w-1", {
        itemIds: ["item-2", "item-1"],
      });
      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE watchlist_items"),
        [0, "item-2", "w-1", "user-1"],
      );
      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE watchlist_items"),
        [1, "item-1", "w-1", "user-1"],
      );
    });
  });

  describe("reorderWatchlists", () => {
    it("throws BadRequestException if watchlist does not belong to user", async () => {
      mockWatchlistRepo.find.mockResolvedValue([{ id: "w-1" }]);
      await expect(
        service.reorderWatchlists("user-1", {
          watchlistIds: ["w-1", "w-foreign"],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates sort_order for watchlists", async () => {
      mockWatchlistRepo.find.mockResolvedValue([{ id: "w-1" }, { id: "w-2" }]);
      mockEntityManager.query.mockResolvedValue([]);

      await service.reorderWatchlists("user-1", {
        watchlistIds: ["w-2", "w-1"],
      });
      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE watchlists"),
        [0, "w-2", "user-1"],
      );
      expect(mockEntityManager.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE watchlists"),
        [1, "w-1", "user-1"],
      );
    });
  });

  describe("refreshQuotes", () => {
    it("delegates to securityPriceService and returns updated watchlist", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue({
        id: "w-1",
        userId: "user-1",
        name: "Tech",
        description: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: "item-1",
            watchlistId: "w-1",
            securityId: "sec-1",
            sortOrder: 0,
            createdAt: new Date(),
            security: {
              id: "sec-1",
              symbol: "TCS",
              name: "Tata",
              currencyCode: "INR",
              securityType: null,
              exchange: null,
              isin: null,
              amfiSchemeCode: null,
            },
            quote: {
              status: "available",
              currentPrice: 4200,
              previousPrice: 4000,
              dailyChange: 200,
              dailyChangePercent: 5,
              priceDate: "2026-09-12",
            },
          },
        ],
      });

      const result = await service.refreshQuotes("user-1", "w-1");
      expect(
        mockSecurityPriceService.refreshPricesForSecurities,
      ).toHaveBeenCalledWith(["sec-1"]);
      expect(result.items[0].quote.currentPrice).toBe(4200);
    });
  });
});
