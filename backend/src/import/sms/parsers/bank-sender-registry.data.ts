export interface BankMetadata {
  code: string;
  name: string;
  patterns: string[];
}

export const KNOWN_INDIAN_BANKS: Record<string, BankMetadata> = {
  HDFC: {
    code: "HDFC",
    name: "HDFC Bank",
    patterns: ["HDFCBK", "HDFC", "HDFCPG"],
  },
  ICICI: {
    code: "ICICI",
    name: "ICICI Bank",
    patterns: ["ICICIB", "ICICI", "ICICIT"],
  },
  SBI: {
    code: "SBI",
    name: "State Bank of India",
    patterns: ["SBIINB", "SBIPSG", "SBISMS", "SBIUPI", "SBI"],
  },
  AXIS: {
    code: "AXIS",
    name: "Axis Bank",
    patterns: ["AXISBK", "AXIS", "AXISPG"],
  },
  KOTAK: {
    code: "KOTAK",
    name: "Kotak Mahindra Bank",
    patterns: ["KOTAKB", "KOTAK", "KMBANK"],
  },
  INDUSIND: {
    code: "INDUSIND",
    name: "IndusInd Bank",
    patterns: ["INDUSB", "INDUS"],
  },
  PNB: {
    code: "PNB",
    name: "Punjab National Bank",
    patterns: ["PNBSMS", "PUNBNK", "PNB"],
  },
  YES: {
    code: "YES",
    name: "Yes Bank",
    patterns: ["YESBNK", "YESBANK", "YES"],
  },
  FEDERAL: {
    code: "FEDERAL",
    name: "Federal Bank",
    patterns: ["FEDBNK", "FEDERAL"],
  },
  IDFC: {
    code: "IDFC",
    name: "IDFC FIRST Bank",
    patterns: ["IDFCFB", "IDFC"],
  },
  CANARA: {
    code: "CANARA",
    name: "Canara Bank",
    patterns: ["CANBNK", "CANARA"],
  },
  BOB: {
    code: "BOB",
    name: "Bank of Baroda",
    patterns: ["BARBKG", "BOBTXN", "BOB"],
  },
  UNION: {
    code: "UNION",
    name: "Union Bank of India",
    patterns: ["UNIONB", "UBISMS", "UNION"],
  },
  PAYTM: {
    code: "PAYTM",
    name: "Paytm Payments Bank",
    patterns: ["PAYTMB", "PAYTM"],
  },
};

/**
 * Normalizes an SMS sender string by stripping TRAI operator/circle 2-character prefixes.
 * Examples:
 *   "VM-HDFCBK" -> "HDFCBK"
 *   "AD-ICICIB" -> "ICICIB"
 *   "VK-SBIINB" -> "SBIINB"
 *   "HDFCBK"    -> "HDFCBK"
 */
export function normalizeSenderPattern(sender?: string): string {
  if (!sender) return "";
  const cleaned = sender.trim().toUpperCase();
  const match = cleaned.match(/^[A-Z]{2}-([A-Z0-9]+)$/);
  if (match) {
    return match[1];
  }
  return cleaned;
}

/**
 * Identifies a known Indian bank from an SMS sender string.
 */
export function identifyBankFromSender(sender?: string): BankMetadata | null {
  if (!sender) return null;
  const normalized = normalizeSenderPattern(sender);
  for (const bank of Object.values(KNOWN_INDIAN_BANKS)) {
    for (const pattern of bank.patterns) {
      if (normalized === pattern || normalized.includes(pattern)) {
        return bank;
      }
    }
  }
  return null;
}

/**
 * Identifies bank name mentions within message text if sender is missing or generic.
 */
export function identifyBankFromMessage(message: string): BankMetadata | null {
  if (!message) return null;
  const upper = message.toUpperCase();
  for (const bank of Object.values(KNOWN_INDIAN_BANKS)) {
    if (
      upper.includes(bank.name.toUpperCase()) ||
      bank.patterns.some((p) => upper.includes(p))
    ) {
      return bank;
    }
  }
  return null;
}
