import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";
import {
  SmsParserStatus,
  SmsTransactionType,
} from "../parsers/sms-parser.interface";

export class ParsedCandidateDto {
  @ApiProperty({ description: "Transaction date in YYYY-MM-DD format" })
  date: string;

  @ApiProperty({
    description:
      "Transaction amount (signed: negative for debit, positive for credit)",
  })
  amount: number;

  @ApiProperty({
    description: "Debit (expense) or Credit (income)",
    enum: ["debit", "credit"],
  })
  type: SmsTransactionType;

  @ApiProperty({ description: "Extracted payee / merchant name" })
  payee: string;

  @ApiProperty({
    description: "Detected payment method / rail",
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: "UPI Virtual Payment Address (VPA) handle",
  })
  upiVpa?: string;

  @ApiPropertyOptional({ description: "UPI 12-digit reference number / RRN" })
  upiReference?: string;

  @ApiPropertyOptional({ description: "Reference / Cheque / Transaction ID" })
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: "Masked bank account or card number (e.g. '1234')",
  })
  accountMask?: string;

  @ApiPropertyOptional({ description: "Detected bank name" })
  bankName?: string;

  @ApiPropertyOptional({ description: "Account balance reported in SMS" })
  balance?: number;
}

export class ParsedSmsResponseDto {
  @ApiProperty({
    description: "Status of SMS parse attempt",
    enum: ["parsed", "ambiguous", "unsupported", "invalid"],
  })
  status: SmsParserStatus;

  @ApiPropertyOptional({
    description: "Parsed transaction candidate",
    type: ParsedCandidateDto,
  })
  candidate?: ParsedCandidateDto;

  @ApiPropertyOptional({
    description: "Resolved account ID if mapped or uniquely matched",
  })
  resolvedAccountId?: string;

  @ApiPropertyOptional({ description: "Account name if resolved" })
  resolvedAccountName?: string;

  @ApiPropertyOptional({
    description:
      "Suggested category from merchant reference catalog (non-binding)",
  })
  suggestedCategory?: string;

  @ApiPropertyOptional({
    description: "Canonical merchant name from reference catalog",
  })
  canonicalMerchantName?: string;

  @ApiPropertyOptional({
    description: "Reason why parsing failed, was ambiguous, or unsupported",
  })
  reason?: string;
}

export class SmsImportResultDto {
  @ApiProperty({
    description: "Status of SMS import attempt",
    enum: [
      "imported",
      "skipped",
      "review_needed",
      "unsupported",
      "invalid",
      "ambiguous",
    ],
  })
  status:
    | "imported"
    | "skipped"
    | "review_needed"
    | "unsupported"
    | "invalid"
    | "ambiguous";

  @ApiPropertyOptional({ description: "Created transaction ID" })
  transactionId?: string;

  @ApiPropertyOptional({ description: "SHA-256 import identity hash" })
  importHash?: string;

  @ApiPropertyOptional({
    description: "Account ID where transaction was imported",
  })
  accountId?: string;

  @ApiPropertyOptional({ description: "Transaction date (YYYY-MM-DD)" })
  transactionDate?: string;

  @ApiPropertyOptional({ description: "Signed transaction amount" })
  amount?: number;

  @ApiPropertyOptional({ description: "Payee name on saved transaction" })
  payeeName?: string;

  @ApiPropertyOptional({
    description: "Payment method on saved transaction",
    enum: PaymentMethod,
  })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: "UPI VPA handle" })
  upiVpa?: string;

  @ApiPropertyOptional({ description: "UPI Reference / RRN" })
  upiReference?: string;

  @ApiPropertyOptional({
    description: "Reason for failure, skip, or review needed",
  })
  reason?: string;
}
