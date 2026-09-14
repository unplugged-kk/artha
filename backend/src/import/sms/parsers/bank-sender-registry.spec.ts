import {
  normalizeSenderPattern,
  identifyBankFromSender,
  identifyBankFromMessage,
  KNOWN_INDIAN_BANKS,
} from "./bank-sender-registry.data";

describe("Bank Sender Registry", () => {
  describe("normalizeSenderPattern", () => {
    it("strips TRAI 2-character telecom and circle prefixes with hyphen", () => {
      expect(normalizeSenderPattern("VM-HDFCBK")).toBe("HDFCBK");
      expect(normalizeSenderPattern("VK-HDFCBK")).toBe("HDFCBK");
      expect(normalizeSenderPattern("AD-ICICIB")).toBe("ICICIB");
      expect(normalizeSenderPattern("CP-SBIINB")).toBe("SBIINB");
      expect(normalizeSenderPattern("BW-AXISBK")).toBe("AXISBK");
      expect(normalizeSenderPattern("JM-KOTAKB")).toBe("KOTAKB");
      expect(normalizeSenderPattern("BP-PNBSMS")).toBe("PNBSMS");
    });

    it("handles sender patterns already without prefix", () => {
      expect(normalizeSenderPattern("HDFCBK")).toBe("HDFCBK");
      expect(normalizeSenderPattern("ICICIB")).toBe("ICICIB");
      expect(normalizeSenderPattern("SBIINB")).toBe("SBIINB");
    });

    it("trims and upper-cases input", () => {
      expect(normalizeSenderPattern("  vm-hdfcbk  ")).toBe("HDFCBK");
    });

    it("returns empty string on empty/undefined input", () => {
      expect(normalizeSenderPattern("")).toBe("");
      expect(normalizeSenderPattern(undefined)).toBe("");
    });
  });

  describe("identifyBankFromSender", () => {
    it("identifies major Indian banks from TRAI sender headers", () => {
      expect(identifyBankFromSender("VM-HDFCBK")?.code).toBe("HDFC");
      expect(identifyBankFromSender("AD-ICICIB")?.code).toBe("ICICI");
      expect(identifyBankFromSender("CP-SBIINB")?.code).toBe("SBI");
      expect(identifyBankFromSender("BW-AXISBK")?.code).toBe("AXIS");
      expect(identifyBankFromSender("JM-KOTAKB")?.code).toBe("KOTAK");
      expect(identifyBankFromSender("BP-PNBSMS")?.code).toBe("PNB");
      expect(identifyBankFromSender("VK-YESBNK")?.code).toBe("YES");
      expect(identifyBankFromSender("VK-FEDBNK")?.code).toBe("FEDERAL");
      expect(identifyBankFromSender("VK-IDFCFB")?.code).toBe("IDFC");
      expect(identifyBankFromSender("VK-CANBNK")?.code).toBe("CANARA");
      expect(identifyBankFromSender("VK-BARBKG")?.code).toBe("BOB");
      expect(identifyBankFromSender("VK-UNIONB")?.code).toBe("UNION");
      expect(identifyBankFromSender("VK-PAYTM")?.code).toBe("PAYTM");
    });

    it("returns null for unknown senders or empty values", () => {
      expect(identifyBankFromSender("UNKNOWN")).toBeNull();
      expect(identifyBankFromSender(undefined)).toBeNull();
      expect(identifyBankFromSender("")).toBeNull();
    });
  });

  describe("identifyBankFromMessage", () => {
    it("identifies bank mentioned in message text", () => {
      expect(
        identifyBankFromMessage(
          "Alert: You spent on HDFC Bank Card ending 1234",
        )?.code,
      ).toBe("HDFC");
      expect(
        identifyBankFromMessage(
          "Dear Customer, your ICICI Bank A/C was debited",
        )?.code,
      ).toBe("ICICI");
      expect(
        identifyBankFromMessage("Dear SBI User, A/C 1234 debited by Rs 500")
          ?.code,
      ).toBe("SBI");
    });

    it("returns null if no known bank is mentioned", () => {
      expect(
        identifyBankFromMessage("Transaction of Rs 500 on card 1234"),
      ).toBeNull();
    });
  });

  describe("KNOWN_INDIAN_BANKS catalog", () => {
    it("contains complete metadata with unique codes and patterns", () => {
      const banks = Object.values(KNOWN_INDIAN_BANKS);
      expect(banks.length).toBeGreaterThanOrEqual(13);

      for (const bank of banks) {
        expect(bank.code).toBeTruthy();
        expect(bank.name).toBeTruthy();
        expect(bank.patterns.length).toBeGreaterThan(0);
      }
    });
  });
});
