import { PaymentMethod } from "../../../transactions/entities/payment-method.enum";

export type SmsTransactionType = "debit" | "credit";

export type SmsParserStatus =
  | "parsed"
  | "ambiguous"
  | "unsupported"
  | "invalid";

export interface ParsedSmsTransaction {
  /** Transaction date in YYYY-MM-DD format */
  date: string;
  /** Absolute transaction amount (positive number) */
  amount: number;
  /** Direction: debit (expense/outflow) or credit (income/inflow) */
  type: SmsTransactionType;
  /** Counterparty / Merchant / Payee name */
  payee: string;
  /** Controlled payment rail metadata */
  paymentMethod: PaymentMethod;
  /** UPI Virtual Payment Address handle if detected */
  upiVpa?: string;
  /** UPI Reference Number / RRN (12-digit) if detected */
  upiReference?: string;
  /** Bank / Cheque / Card transaction reference ID if detected */
  referenceNumber?: string;
  /** Last digits of bank account or card (e.g. "1234") */
  accountMask?: string;
  /** Known bank or financial institution name */
  bankName?: string;
  /** Available balance reported in SMS if present (advisory metadata) */
  balance?: number;
}

export interface SmsParserResult {
  success: boolean;
  status: SmsParserStatus;
  transaction?: ParsedSmsTransaction;
  reason?: string;
}

export interface ISmsParser {
  readonly name: string;
  canParse(message: string, sender?: string): boolean;
  parse(message: string, sender?: string): SmsParserResult;
}
