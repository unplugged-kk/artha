import { SmsIntakeController } from "./sms-intake.controller";
import { SmsIntakeService } from "./sms-intake.service";
import { SmsSenderRegistryService } from "./sms-sender-registry.service";
import { PaymentMethod } from "../../transactions/entities/payment-method.enum";

describe("SmsIntakeController", () => {
  let controller: SmsIntakeController;
  let mockSmsIntakeService: any;
  let mockSenderRegistryService: any;

  const req = { user: { id: "user-1" } };

  beforeEach(() => {
    mockSmsIntakeService = {
      parseSms: jest.fn().mockResolvedValue({
        status: "parsed",
        candidate: {
          date: "2026-09-14",
          amount: -500,
          type: "debit",
          payee: "Swiggy",
          paymentMethod: PaymentMethod.UPI,
        },
      }),
      importSms: jest.fn().mockResolvedValue({
        status: "imported",
        transactionId: "tx-1",
        amount: -500,
      }),
    };

    mockSenderRegistryService = {
      listSenders: jest.fn().mockResolvedValue([]),
      getKnownBanks: jest
        .fn()
        .mockReturnValue([{ code: "HDFC", name: "HDFC Bank" }]),
      createSender: jest.fn().mockResolvedValue({ id: "s-1" }),
      updateSender: jest.fn().mockResolvedValue({ id: "s-1" }),
      deleteSender: jest.fn().mockResolvedValue(undefined),
    };

    controller = new SmsIntakeController(
      mockSmsIntakeService as unknown as SmsIntakeService,
      mockSenderRegistryService as unknown as SmsSenderRegistryService,
    );
  });

  describe("parseSms", () => {
    it("calls smsIntakeService.parseSms with userId and DTO", async () => {
      const dto = { message: "Rs.500 debited via UPI", sender: "VM-HDFCBK" };
      const res = await controller.parseSms(req, dto);

      expect(mockSmsIntakeService.parseSms).toHaveBeenCalledWith("user-1", dto);
      expect(res.status).toBe("parsed");
    });
  });

  describe("importSms", () => {
    it("calls smsIntakeService.importSms with userId and DTO", async () => {
      const dto = { message: "Rs.500 debited via UPI", accountId: "acc-1" };
      const res = await controller.importSms(req, dto);

      expect(mockSmsIntakeService.importSms).toHaveBeenCalledWith(
        "user-1",
        dto,
      );
      expect(res.status).toBe("imported");
    });
  });

  describe("Sender Registry routes", () => {
    it("listSenders returns user's senders", async () => {
      await controller.listSenders(req);
      expect(mockSenderRegistryService.listSenders).toHaveBeenCalledWith(
        "user-1",
      );
    });

    it("getKnownBanks returns known banks catalog", () => {
      const res = controller.getKnownBanks();
      expect(res).toHaveLength(1);
    });

    it("createSender registers a new sender", async () => {
      const dto = { senderPattern: "HDFCBK" };
      await controller.createSender(req, dto);
      expect(mockSenderRegistryService.createSender).toHaveBeenCalledWith(
        "user-1",
        dto,
      );
    });

    it("updateSender updates sender entry", async () => {
      const dto = { displayName: "HDFC" };
      await controller.updateSender(req, "s-1", dto);
      expect(mockSenderRegistryService.updateSender).toHaveBeenCalledWith(
        "user-1",
        "s-1",
        dto,
      );
    });

    it("deleteSender removes sender entry", async () => {
      await controller.deleteSender(req, "s-1");
      expect(mockSenderRegistryService.deleteSender).toHaveBeenCalledWith(
        "user-1",
        "s-1",
      );
    });
  });
});
