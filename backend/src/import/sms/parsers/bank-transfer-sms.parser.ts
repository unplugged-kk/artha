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
  cleanPayeeString,
  isNonTransactionalMessage,
} from "./sms-cleaner.util";
import {
  identifyBankFromSender,
  identifyBankFromMessage,
} from "./bank-sender-registry.data";

export class BankTransferSmsParser implements ISmsParser {
  readonly name = "BankTransferSmsParser";

  canParse(message: string, _sender?: string): boolean {
    if (!message) return false;
    const upper = message.toUpperCase();
    return (
      (upper.includes("NEFT") ||
        upper.includes("IMPS") ||
        upper.includes("RTGS") ||
        upper.includes("TRANSFER") ||
        upper.includes("DEBITED") ||
        upper.includes("CREDITED")) &&
      !upper.includes("UPI") &&
      !upper.includes("ATM") &&
      !upper.includes("CARD")
    );
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

    // 1. Determine direction
    let type: SmsTransactionType | null = null;
    const isDebit =
      upper.includes("DEBITED") || upper.includes("TRANSFERRED TO");
    const isCredit =
      upper.includes("CREDITED") ||
      upper.includes("TRANSFER FROM") ||
      upper.includes("TRANSFERRED FROM");

    if (isDebit && !isCredit) {
      type = "debit";
    } else if (isCredit && !isDebit) {
      type = "credit";
    } else if (isDebit && isCredit) {
      return {
        success: false,
        status: "ambiguous",
        reason:
          "bank transfer message contains conflicting debit and credit terms",
      };
    } else {
      return {
        success: false,
        status: "ambiguous",
        reason:
          "cannot determine debit or credit direction in bank transfer message",
      };
    }

    // 2. Extract amount
    const amount = extractTransactionAmount(message);
    if (!amount) {
      return {
        success: false,
        status: "invalid",
        reason:
          "missing or invalid transaction amount in bank transfer message",
      };
    }

    // 3. Extract date
    const date = extractDateOrDefaultToday(message);

    // 4. Determine rail: IMPS, NEFT, RTGS or OTHER
    let paymentMethod = PaymentMethod.OTHER;
    if (upper.includes("IMPS")) {
      paymentMethod = PaymentMethod.IMPS;
    } else if (upper.includes("NEFT")) {
      paymentMethod = PaymentMethod.NEFT;
    } else if (upper.includes("RTGS")) {
      paymentMethod = PaymentMethod.RTGS;
    }

    // 5. Extract reference number
    let referenceNumber: string | undefined;
    const refMatch = message.match(
      /(?:ref(?:\s+no\.?|\s+num)?|rrn|neft-|imps-|rtgs-)[\s:]*([a-zA-Z0-9]+)\b/i,
    );
    if (refMatch && refMatch[1]) {
      referenceNumber = refMatch[1];
    }

    // 6. Extract counterparty / Payee
    let payee = "";
    // e.g. "by NEFT-ACME CORP-N123456789"
    const hyphenatedMatch = message.match(
      /(?:NEFT|IMPS|RTGS)-([a-zA-Z0-9 ._]+?)-[a-zA-Z0-9]+/i,
    );
    if (hyphenatedMatch && hyphenatedMatch[1]) {
      payee = hyphenatedMatch[1].trim();
    }

    // If not found: "to <Payee>" or "from <Payee>"
    if (!payee) {
      const dirMatch =
        type === "debit"
          ? message.match(
              /\b(?:to|transfer\s+to)\s+([a-zA-Z0-9._ -]+?)(?:\s+(?:on|via|ref|bal|avl)|\.|$)/i,
            )
          : message.match(
              /\b(?:from|by|transfer\s+from)\s+([a-zA-Z0-9._ -]+?)(?:\s+(?:on|via|ref|bal|avl)|\.|$)/i,
            );

      if (dirMatch && dirMatch[1]) {
        payee = cleanPayeeString(dirMatch[1]);
      }
    }

    if (!payee) {
      payee = type === "debit" ? "Bank Transfer Out" : "Bank Transfer In";
    }

    // 7. Context metadata
    const accountMask = extractAccountMask(message) || undefined;
    const balance = extractAvailableBalance(message) || undefined;
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
        paymentMethod,
        referenceNumber,
        accountMask,
        bankName: bankMeta?.name,
        balance,
      },
    };
  }
}
