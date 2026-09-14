import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";
import { ISmsParser, SmsParserResult } from "./sms-parser.interface";
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

export class AtmSmsParser implements ISmsParser {
  readonly name = "AtmSmsParser";

  canParse(message: string, _sender?: string): boolean {
    if (!message) return false;
    const upper = message.toUpperCase();
    return (
      (upper.includes("ATM") ||
        upper.includes("CASH WITHDRAWAL") ||
        upper.includes("WITHDRAWN")) &&
      (upper.includes("DEBITED") ||
        upper.includes("WITHDRAWN") ||
        upper.includes("WITHDRAWAL"))
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

    // 1. Amount
    const amount = extractTransactionAmount(message);
    if (!amount) {
      return {
        success: false,
        status: "invalid",
        reason:
          "missing or invalid transaction amount in ATM withdrawal message",
      };
    }

    // 2. Date
    const date = extractDateOrDefaultToday(message);

    // 3. Payee / Location
    let payee = "Cash Withdrawal";
    const atmLocMatch = message.match(
      /\b(?:at\s+([a-zA-Z0-9._ -]+?ATM[a-zA-Z0-9._ -]*?))(?:\s+(?:on|avl|bal)|\.|$)/i,
    );
    if (atmLocMatch && atmLocMatch[1]) {
      payee = cleanPayeeString(atmLocMatch[1]);
    }

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
        type: "debit",
        payee,
        paymentMethod: PaymentMethod.CASH,
        accountMask,
        bankName: bankMeta?.name,
        balance,
      },
    };
  }
}
