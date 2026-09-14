export type SmsParseStatus =
  | 'PARSED'
  | 'NON_TRANSACTIONAL'
  | 'UNSUPPORTED_FORMAT'
  | 'AMBIGUOUS'
  | 'SPAM';

export interface ParsedSmsTransaction {
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  date: string;
  merchant?: string;
  cleanPayee?: string;
  accountNumberMask?: string;
  paymentRail?: 'UPI' | 'CARD' | 'NET_BANKING' | 'ATM' | 'CHEQUE' | 'OTHER';
  upiRefNumber?: string;
  upiSenderVpa?: string;
  upiRecipientVpa?: string;
  referenceNumber?: string;
  balanceAfterTransaction?: number;
  rawPayee?: string;
}

export interface ParsedSmsResponse {
  status: SmsParseStatus;
  confidence: number;
  parserUsed?: string;
  parsedTransaction?: ParsedSmsTransaction;
  detectedBank?: string;
  rawMessage: string;
  senderHeader?: string;
  receivedAt?: string;
}

export interface ParseSmsDto {
  message: string;
  senderHeader?: string;
  receivedAt?: string;
}

export interface ImportSmsDto extends ParseSmsDto {
  accountId: string;
  categoryId?: string;
}

export interface SmsImportResult {
  status: 'IMPORTED' | 'SKIPPED_DUPLICATE' | 'NEEDS_REVIEW' | 'FAILED';
  transactionId?: string;
  message: string;
  sourceHash?: string;
  duplicateReason?: string;
  parsedData?: ParsedSmsTransaction;
}

export interface KnownBankSender {
  bankName: string;
  headerPatterns: string[];
  description: string;
}
