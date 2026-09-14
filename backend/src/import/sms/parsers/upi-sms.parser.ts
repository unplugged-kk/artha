import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";
import {
  ISmsParser,
  SmsParserResult,
  SmsTransactionType,
} from "./sms-parser.interface";
import {
  extractTransactionAmount,
  extractAvailableBalance,
} from "./amount-parser.util";
import { extractDateOrDefaultToday } from "./date-parser.util";
import {
  extractAccountMask,
  extractUpiVpa,
  extractUpiReference,
  cleanPayeeString,
  isNonTransactionalMessage,
} from "./sms-cleaner.util";
import {
  identifyBankFromSender,
  identifyBankFromMessage,
} from "./bank-sender-registry.data";

export class UpiSmsParser implements ISmsParser {
  readonly name = "UpiSmsParser";

  canParse(message: string, _sender?: string): boolean {
    if (!message) return false;
    const upper = message.toUpperCase();
    return upper.includes("UPI") || upper.includes("VPA");
  }

  parse(message: string, sender?: string): SmsParserResult {
    const nonTxCheck = isNonTransactionalMessage(message);
    if (nonTxCheck.nonTransactional) {
      return {
        success: false,
        status: "unsupported",
        reason: nonTxCheck.reason,
      };
    }

    const upper = message.toUpperCase();

    // 1. Determine debit vs credit
    let type: SmsTransactionType | null = null;
    const isDebit =
      upper.includes("DEBITED") ||
      upper.includes("SENT") ||
      upper.includes("PAID") ||
      upper.includes("SPENT");
    const isCredit =
      upper.includes("CREDITED") ||
      upper.includes("RECEIVED") ||
      upper.includes("REFUND");

    if (isDebit && !isCredit) {
      type = "debit";
    } else if (isCredit && !isDebit) {
      type = "credit";
    } else if (isDebit && isCredit) {
      // Conflicting keywords in UPI context
      return {
        success: false,
        status: "ambiguous",
        reason: "message contains both debit and credit keywords",
      };
    } else {
      return {
        success: false,
        status: "ambiguous",
        reason: "cannot determine debit or credit direction in UPI message",
      };
    }

    // 2. Extract amount
    const amount = extractTransactionAmount(message);
    if (!amount) {
      return {
        success: false,
        status: "invalid",
        reason: "missing or invalid transaction amount in UPI message",
      };
    }

    // 3. Extract date
    const date = extractDateOrDefaultToday(message);

    // 4. Extract UPI details
    const upiVpa = extractUpiVpa(message) || undefined;
    const upiReference = extractUpiReference(message) || undefined;
    const accountMask = extractAccountMask(message) || undefined;
    const balance = extractAvailableBalance(message) || undefined;

    // 5. Extract Payee
    let payee = "";

    // Check ICICI/Axis pattern: "Info: UPI/<RRN>/<Payee>" or "UPI/<Payee>/<RRN>" or "UPI/<RRN>/<Payee>"
    const slashMatch = message.match(
      /UPI\/(?:[0-9]{12}\/([a-zA-Z0-9._ -]+)|([a-zA-Z0-9._ -]+)\/[0-9]{12})/i,
    );
    if (slashMatch) {
      payee = slashMatch[1] || slashMatch[2] || "";
    }

    // If no slash pattern, check "to VPA <VPA>" or "to <Payee>"
    if (!payee) {
      const toMatch = message.match(
        /(?:to\s+vpa|transfer\s+to\s+upi\/|transfer\s+to|to)\s+([a-zA-Z0-9._@ -]+?)(?:\s+(?:on|via|\(upi|ref|bal|avl)|\.|$)/i,
      );
      if (toMatch && toMatch[1]) {
        payee = toMatch[1].trim();
      }
    }

    // If credit: "from <Payee>" or "by <Payee>"
    if (!payee && type === "credit") {
      const fromMatch = message.match(
        /(?:from|by\s+a\/c\s+linked\s+to\s+upi\s+vpa|by\s+transfer\s+from|by)\s+([a-zA-Z0-9._@ -]+?)(?:\s+(?:on|via|\(upi|ref|bal|avl)|\.|$)/i,
      );
      if (fromMatch && fromMatch[1]) {
        payee = fromMatch[1].trim();
      }
    }

    // If payee is or contains a VPA handle, extract readable handle
    if (payee.includes("@")) {
      const vpaHandle = payee.split("@")[0];
      // If VPA handle is not just a phone number, use it
      if (vpaHandle && !/^\d{10}$/.test(vpaHandle)) {
        payee = vpaHandle;
      }
    } else if (!payee && upiVpa) {
      const vpaHandle = upiVpa.split("@")[0];
      if (vpaHandle && !/^\d{10}$/.test(vpaHandle)) {
        payee = vpaHandle;
      }
    }

    payee = cleanPayeeString(payee);
    if (!payee) {
      payee = type === "debit" ? "UPI Payment" : "UPI Credit";
    }

    // 6. Identify bank
    const bankMeta =
      identifyBankFromSender(sender) || identifyBankFromMessage(message);

    return {
      success: true,
      status: "parsed",
      transaction: {
        date,
        amount,
        type,
        payee,
        paymentMethod: PaymentMethod.UPI,
        upiVpa,
        upiReference,
        referenceNumber: upiReference,
        accountMask,
        bankName: bankMeta?.name,
        balance,
      },
    };
  }
}
