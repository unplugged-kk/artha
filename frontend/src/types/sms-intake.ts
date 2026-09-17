/**
 * The SMS intake contract, as the backend publishes it.
 *
 * These mirror `backend/src/import/sms/dto/parsed-sms-response.dto.ts` and the
 * status vocabularies in `sms-parser.interface.ts` / `payment-method.enum.ts`
 * verbatim. They are not a second opinion: the component reads the response
 * directly, so a rename here without the backend fails the integration test
 * rather than silently rendering nothing.
 */

/** `SmsParserStatus`. Lowercase on the wire. */
export type SmsParseStatus =
  | 'parsed'
  | 'ambiguous'
  | 'unsupported'
  | 'invalid';

/** Debit (expense) or credit (income). */
export type SmsTransactionType = 'debit' | 'credit';

/** The parsed candidate, `ParsedCandidateDto`. */
export interface SmsCandidate {
  /** YYYY-MM-DD. */
  date: string;
  /** Signed: negative for a debit, positive for a credit. */
  amount: number;
  type: SmsTransactionType;
  /** Extracted payee / merchant name. */
  payee: string;
  /** Payment rail, a `PaymentMethod` value (UPI, CARD, CASH, CHEQUE, ...). */
  paymentMethod: string;
  /** UPI Virtual Payment Address handle. */
  upiVpa?: string;
  /** UPI 12-digit reference number / RRN. */
  upiReference?: string;
  /** Reference / cheque / transaction id. */
  referenceNumber?: string;
  /** Masked bank account or card number, e.g. "1234". */
  accountMask?: string;
  /** Detected bank name, from the sender registry. */
  bankName?: string;
  /** Account balance reported in the SMS. */
  balance?: number;
}

/** `POST /import/sms/parse` response, `ParsedSmsResponseDto`. */
export interface ParsedSmsResponse {
  status: SmsParseStatus;
  candidate?: SmsCandidate;
  resolvedAccountId?: string;
  resolvedAccountName?: string;
  suggestedCategory?: string;
  canonicalMerchantName?: string;
  /** Why the parse failed, was ambiguous, or was unsupported. */
  reason?: string;
}

export interface ParseSmsDto {
  message: string;
  /**
   * Sender ID as received from the telecom operator, e.g. "VM-HDFCBK". Named
   * `sender` because that is the field `ParseSmsDto` declares -- the endpoint
   * runs with `forbidNonWhitelisted`, so any other spelling is a 400.
   */
  sender?: string;
}

export interface ImportSmsDto extends ParseSmsDto {
  accountId: string;
  categoryId?: string;
}

/** `SmsImportResultDto['status']`. Lowercase on the wire. */
export type SmsImportStatus =
  | 'imported'
  | 'skipped'
  | 'review_needed'
  | 'unsupported'
  | 'invalid'
  | 'ambiguous';

/** `POST /import/sms/import` response, `SmsImportResultDto`. */
export interface SmsImportResult {
  status: SmsImportStatus;
  transactionId?: string;
  /** SHA-256 import identity hash. */
  importHash?: string;
  accountId?: string;
  transactionDate?: string;
  /** Signed transaction amount. */
  amount?: number;
  payeeName?: string;
  paymentMethod?: string;
  upiVpa?: string;
  upiReference?: string;
  /** Reason for a failure, a skip, or a review. */
  reason?: string;
}

/** `GET /import/sms/senders/known`, `BankMetadata[]`. */
export interface KnownBankSender {
  code: string;
  name: string;
  patterns: string[];
}
