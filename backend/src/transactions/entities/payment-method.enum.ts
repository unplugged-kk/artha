/**
 * Payment rail / method enumeration for financial transactions (Priority 9).
 *
 * Stored as a stable, controlled machine representation in `transactions.payment_method`
 * (VARCHAR(20) validated by check constraint chk_transactions_payment_method).
 *
 * Candidate values:
 * - UPI: Unified Payments Interface (India)
 * - IMPS: Immediate Payment Service (India)
 * - NEFT: National Electronic Funds Transfer (India)
 * - RTGS: Real Time Gross Settlement (India)
 * - CARD: Credit or debit card payment / Point of Sale (POS)
 * - CASH: Physical cash or ATM withdrawal
 * - CHEQUE: Paper cheque / check
 * - OTHER: Other payment rails or mechanisms
 */
export enum PaymentMethod {
  UPI = "UPI",
  IMPS = "IMPS",
  NEFT = "NEFT",
  RTGS = "RTGS",
  CARD = "CARD",
  CASH = "CASH",
  CHEQUE = "CHEQUE",
  OTHER = "OTHER",
}
