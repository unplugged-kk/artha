import { SmsSenderRegistryService } from "./sms-sender-registry.service";
import { DataSource } from "typeorm";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Account } from "../../accounts/entities/account.entity";

jest.mock("../../common/db/scoped-db", () =>
  jest
    .requireActual("../../test-helpers/scoped-db-testing")
    .scopedDbMockModule(),
);

describe("SmsSenderRegistryService", () => {
  let service: SmsSenderRegistryService;
  let mockDataSource: any;
  let mockManager: any;

  const userId = "user-uuid-1";

  beforeEach(() => {
    mockManager = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((_entityClass, data) => ({
        ...data,
        id: "gen-id",
      })),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({
          ...entity,
          id: entity.id || "saved-id",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (runInTransaction: any) => {
          return runInTransaction(mockManager);
        }),
    };

    service = new SmsSenderRegistryService(
      mockDataSource as unknown as DataSource,
    );
  });

  describe("getKnownBanks", () => {
    it("returns array of known Indian banks with codes and patterns", () => {
      const banks = service.getKnownBanks();
      expect(banks.length).toBeGreaterThanOrEqual(13);
      expect(banks.some((b) => b.code === "HDFC")).toBe(true);
      expect(banks.some((b) => b.code === "ICICI")).toBe(true);
      expect(banks.some((b) => b.code === "SBI")).toBe(true);
    });
  });

  describe("listSenders", () => {
    it("returns list of registered senders for the user", async () => {
      const mockEntry = {
        id: "sender-1",
        userId,
        senderPattern: "HDFCBK",
        accountId: "acc-1",
        account: { id: "acc-1", name: "HDFC Salary" },
        displayName: "HDFC Bank",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockManager.find.mockResolvedValueOnce([mockEntry]);

      const result = await service.listSenders(userId);
      expect(result).toHaveLength(1);
      expect(result[0].senderPattern).toBe("HDFCBK");
      expect(result[0].accountName).toBe("HDFC Salary");
    });
  });

  describe("createSender", () => {
    it("normalizes sender pattern and saves registry entry", async () => {
      mockManager.findOne
        .mockResolvedValueOnce(null) // account verification: no account passed
        .mockResolvedValueOnce(null); // duplicate check

      const result = await service.createSender(userId, {
        senderPattern: "VM-HDFCBK",
        displayName: "HDFC Bank",
      });

      expect(result.senderPattern).toBe("HDFCBK");
      expect(mockManager.save).toHaveBeenCalled();
    });

    it("verifies mapped account belongs to user", async () => {
      mockManager.findOne.mockResolvedValueOnce(null); // account not found

      await expect(
        service.createSender(userId, {
          senderPattern: "HDFCBK",
          accountId: "invalid-acc",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on duplicate sender pattern", async () => {
      mockManager.findOne.mockResolvedValueOnce({ id: "existing" }); // duplicate pattern found

      await expect(
        service.createSender(userId, {
          senderPattern: "HDFCBK",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("throws BadRequestException on empty pattern", async () => {
      await expect(
        service.createSender(userId, {
          senderPattern: "   ",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateSender", () => {
    it("updates sender mapping details", async () => {
      const existing = {
        id: "entry-1",
        userId,
        senderPattern: "HDFCBK",
        accountId: null,
        account: null,
        displayName: "HDFC Bank",
        isActive: true,
      };
      mockManager.findOne.mockResolvedValueOnce(existing);

      const result = await service.updateSender(userId, "entry-1", {
        displayName: "HDFC Primary",
        isActive: false,
      });

      expect(result.displayName).toBe("HDFC Primary");
      expect(result.isActive).toBe(false);
      expect(mockManager.save).toHaveBeenCalled();
    });

    it("throws NotFoundException if entry does not exist", async () => {
      mockManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateSender(userId, "missing-id", { displayName: "New" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteSender", () => {
    it("deletes sender entry successfully", async () => {
      mockManager.delete.mockResolvedValueOnce({ affected: 1 });

      await expect(
        service.deleteSender(userId, "entry-1"),
      ).resolves.not.toThrow();
    });

    it("throws NotFoundException if sender entry does not exist", async () => {
      mockManager.delete.mockResolvedValueOnce({ affected: 0 });

      await expect(service.deleteSender(userId, "missing-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("resolveAccountForSender", () => {
    it("resolves account using normalized pattern", async () => {
      const mockAccount = { id: "acc-1", name: "HDFC Bank" } as Account;
      mockManager.findOne.mockResolvedValueOnce({
        account: mockAccount,
        isActive: true,
      });

      const result = await service.resolveAccountForSender(userId, "VM-HDFCBK");
      expect(result).toBe(mockAccount);
    });

    it("returns null if sender not mapped", async () => {
      mockManager.findOne.mockResolvedValue(null);

      const result = await service.resolveAccountForSender(userId, "UNKNOWN");
      expect(result).toBeNull();
    });
  });
});
