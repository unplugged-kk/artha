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

export class CardSmsParser implements ISmsParser {
  readonly name = "CardSmsParser";

  canParse(message: string, _sender?: string): boolean {
    if (!message) return false;
    const upper = message.toUpperCase();
    return (
      (upper.includes("CARD") ||
        upper.includes("CREDIT CARD") ||
        upper.includes("DEBIT CARD")) &&
      (upper.includes("SPENT") ||
        upper.includes("USED FOR") ||
        upper.includes("TRANSACTION OF") ||
        upper.includes("MADE ON") ||
        upper.includes("REFUND") ||
        upper.includes("DEBITED"))
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
    let type: SmsTransactionType = "debit";
    if (upper.includes("REFUND") || upper.includes("CREDITED")) {
      type = "credit";
    }

    // 2. Extract amount
    const amount = extractTransactionAmount(message);
    if (!amount) {
      return {
        success: false,
        status: "invalid",
        reason: "missing or invalid transaction amount in card message",
      };
    }

    // 3. Extract date
    const date = extractDateOrDefaultToday(message);

    // 4. Extract Card Account Mask
    const accountMask = extractAccountMask(message) || undefined;
    const balance = extractAvailableBalance(message) || undefined;

    // 5. Extract Payee / Merchant
    let payee = "";
    if (type === "credit") {
      const fromMatch = message.match(
        /\bfrom\s+([a-zA-Z0-9._ -]+?)(?:\s+(?:on|avl|bal|limit|ref)|\.|$)/i,
      );
      if (
        fromMatch &&
        fromMatch[1] &&
        !fromMatch[1].toLowerCase().includes("card")
      ) {
        payee = cleanPayeeString(fromMatch[1]);
      }
    }

    if (!payee) {
      // Check "at <MERCHANT>"
      const atMatch = message.match(
        /\bat\s+([a-zA-Z0-9._ -]+?)(?:\s+(?:on|avl|bal|limit|ref)|\.|$)/i,
      );
      if (atMatch && atMatch[1] && !atMatch[1].toLowerCase().includes("card")) {
        payee = cleanPayeeString(atMatch[1]);
      }
    }

    if (!payee) {
      payee = type === "debit" ? "Card Payment" : "Card Refund";
    }

    // Reference number (e.g. Auth Code or Txn ID)
    let referenceNumber: string | undefined;
    const refMatch = message.match(
      /(?:auth(?:orization)?\s+(?:code|no\.?)|txn\s+id|ref\s+no\.?)[\s:]*([a-zA-Z0-9]+)\b/i,
    );
    if (refMatch && refMatch[1]) {
      referenceNumber = refMatch[1];
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
        paymentMethod: PaymentMethod.CARD,
        referenceNumber,
        accountMask,
        bankName: bankMeta?.name,
        balance,
      },
    };
  }
}
