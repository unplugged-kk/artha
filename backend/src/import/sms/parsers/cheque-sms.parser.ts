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
  isNonTransactionalMessage,
} from "./sms-cleaner.util";
import {
  identifyBankFromSender,
  identifyBankFromMessage,
} from "./bank-sender-registry.data";

export class ChequeSmsParser implements ISmsParser {
  readonly name = "ChequeSmsParser";

  canParse(message: string, _sender?: string): boolean {
    if (!message) return false;
    const upper = message.toUpperCase();
    return upper.includes("CHEQUE") || upper.includes("CHQ");
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

    let type: SmsTransactionType = "debit";
    if (upper.includes("CREDITED") || upper.includes("DEPOSITED")) {
      type = "credit";
    }

    const amount = extractTransactionAmount(message);
    if (!amount) {
      return {
        success: false,
        status: "invalid",
        reason: "missing or invalid transaction amount in cheque message",
      };
    }

    const date = extractDateOrDefaultToday(message);

    let referenceNumber: string | undefined;
    const chqMatch = message.match(
      /(?:cheque|chq)(?:\s+no\.?|\s+num|\s+#)?[\s:]*([0-9]+)\b/i,
    );
    if (chqMatch && chqMatch[1]) {
      referenceNumber = chqMatch[1];
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
        type,
        payee: type === "debit" ? "Cheque Payment" : "Cheque Deposit",
        paymentMethod: PaymentMethod.CHEQUE,
        referenceNumber,
        accountMask,
        bankName: bankMeta?.name,
        balance,
      },
    };
  }
}
