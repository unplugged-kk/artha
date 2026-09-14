import { ISmsParser, SmsParserResult } from "./sms-parser.interface";
import { UpiSmsParser } from "./upi-sms.parser";
import { CardSmsParser } from "./card-sms.parser";
import { BankTransferSmsParser } from "./bank-transfer-sms.parser";
import { AtmSmsParser } from "./atm-sms.parser";
import { ChequeSmsParser } from "./cheque-sms.parser";
import { isNonTransactionalMessage } from "./sms-cleaner.util";

export class CompositeSmsParser {
  private readonly parsers: ISmsParser[];

  constructor(customParsers?: ISmsParser[]) {
    this.parsers = customParsers || [
      new UpiSmsParser(),
      new AtmSmsParser(),
      new CardSmsParser(),
      new ChequeSmsParser(),
      new BankTransferSmsParser(),
    ];
  }

  parse(message: string, sender?: string): SmsParserResult {
    if (!message || message.trim().length === 0) {
      return {
        success: false,
        status: "invalid",
        reason: "message cannot be empty",
      };
    }

    // 1. Fast reject non-transactional messages (OTPs, promotional, reminders)
    const nonTx = isNonTransactionalMessage(message);
    if (nonTx.nonTransactional) {
      return {
        success: false,
        status: "unsupported",
        reason: nonTx.reason,
      };
    }

    // 2. Try each parser in order of specificity
    for (const parser of this.parsers) {
      if (parser.canParse(message, sender)) {
        const result = parser.parse(message, sender);
        // If it succeeded or returned an explicit failure status (ambiguous/invalid), return it
        if (
          result.success ||
          result.status === "ambiguous" ||
          result.status === "invalid"
        ) {
          return result;
        }
      }
    }

    return {
      success: false,
      status: "unsupported",
      reason: "message format not recognized by any supported parser",
    };
  }
}
