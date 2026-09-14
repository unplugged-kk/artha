import { PaymentMethod } from "../transactions/entities/payment-method.enum";

/**
 * Payment rail and UPI metadata extraction utilities (Priority 9).
 *
 * Designed to map payment rails and UPI metadata ONLY when source evidence
 * unambiguously supports it. Where source data is ambiguous or absent,
 * values remain null/undefined -- never fabricated or guessed.
 */

const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,64}$/;
const UPI_RRN_REGEX = /^\d{12}$/;

/**
 * Normalizes a raw payment method / rail string from an import (e.g. CSV column or provider tag)
 * into a controlled PaymentMethod enum value.
 *
 * Returns null if the value is empty or uninformative.
 * Returns PaymentMethod.OTHER if the value is an explicit non-empty rail that doesn't match standard ones.
 */
export function normalizePaymentMethod(
  raw?: string | null,
): PaymentMethod | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;

  switch (trimmed) {
    case "UPI":
    case "UNIFIED PAYMENTS INTERFACE":
    case "BHIM":
    case "BHIM UPI":
      return PaymentMethod.UPI;

    case "IMPS":
    case "IMPS P2A":
    case "IMPS P2P":
    case "IMPS P2U":
      return PaymentMethod.IMPS;

    case "NEFT":
    case "NATIONAL ELECTRONIC FUNDS TRANSFER":
      return PaymentMethod.NEFT;

    case "RTGS":
    case "REAL TIME GROSS SETTLEMENT":
      return PaymentMethod.RTGS;

    case "CARD":
    case "DEBIT":
    case "DEBIT CARD":
    case "CREDIT":
    case "CREDIT CARD":
    case "POS":
    case "POINT OF SALE":
    case "VISA":
    case "MASTERCARD":
    case "RUPAY":
    case "AMEX":
      return PaymentMethod.CARD;

    case "CASH":
    case "ATM":
    case "ATM WITHDRAWAL":
    case "ATM-WDL":
    case "CASH DEPOSIT":
    case "CASH WITHDRAWAL":
      return PaymentMethod.CASH;

    case "CHEQUE":
    case "CHECK":
    case "CHQ":
    case "CLEARING":
    case "CHEQUE DEPOSIT":
      return PaymentMethod.CHEQUE;

    case "OTHER":
      return PaymentMethod.OTHER;

    default:
      // If an explicit value was present in a mapped payment-method column
      return PaymentMethod.OTHER;
  }
}

/**
 * Validates whether a candidate string is a well-formed UPI Virtual Payment Address (VPA).
 * e.g. `user@okhdfcbank`, `merchant.pay@upi`.
 */
export function isValidUpiVpa(candidate?: string | null): boolean {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (trimmed.length < 5 || trimmed.length > 100) return false;
  return UPI_VPA_REGEX.test(trimmed);
}

/**
 * Validates whether a candidate string is a standard 12-digit UPI Retrieval Reference Number (RRN)
 * or alphanumeric reference ID.
 */
export function isValidUpiReference(candidate?: string | null): boolean {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (trimmed.length < 6 || trimmed.length > 50) return false;
  // Standard NPCI RRN is 12 numeric digits, or standard banking transaction reference
  return UPI_RRN_REGEX.test(trimmed) || /^[A-Za-z0-9]{6,35}$/.test(trimmed);
}

export interface DetectPaymentMetadataInput {
  /** Explicit rail/type from mapped column or OFX TRNTYPE */
  explicitMethod?: string | null;
  /** Explicit UPI VPA from mapped column */
  explicitVpa?: string | null;
  /** Explicit UPI reference from mapped column */
  explicitReference?: string | null;
  /** Narration / description / memo */
  memo?: string | null;
  /** Payee or merchant name */
  payee?: string | null;
  /** Check / reference number */
  number?: string | null;
}

export interface DetectedPaymentMetadata {
  paymentMethod?: PaymentMethod | null;
  upiVpa?: string | null;
  upiReference?: string | null;
}

/**
 * Detects payment rail and UPI metadata from source evidence.
 *
 * Precedence:
 * 1. Explicit mapped columns (paymentMethod, upiVpa, upiReference) take highest priority.
 * 2. Unambiguous structured prefixes in narration/payee from Indian bank exports:
 *    - `UPI/<RRN>/<Payee>/<VPA>/...` or `UPI-<RRN>-...`
 *    - `NEFT-<UTR>-...` or `NEFT/...`
 *    - `IMPS/<RRN>/...` or `IMPS-...`
 *    - `RTGS/<UTR>/...` or `RTGS-...`
 *    - `POS ...`
 *    - `CHQ NO ...` or check number indicator
 * 3. If ambiguous, leaves fields null/undefined.
 */
export function detectPaymentMetadata(
  input: DetectPaymentMetadataInput,
): DetectedPaymentMetadata {
  let paymentMethod: PaymentMethod | null = null;
  let upiVpa: string | null = null;
  let upiReference: string | null = null;

  // 1. Explicit payment method if supplied
  if (input.explicitMethod) {
    paymentMethod = normalizePaymentMethod(input.explicitMethod);
  }

  // 2. Explicit VPA and reference if supplied
  if (input.explicitVpa && isValidUpiVpa(input.explicitVpa)) {
    upiVpa = input.explicitVpa.trim();
    if (!paymentMethod) {
      paymentMethod = PaymentMethod.UPI;
    }
  }

  if (input.explicitReference) {
    const trimmedRef = input.explicitReference.trim();
    if (isValidUpiReference(trimmedRef)) {
      upiReference = trimmedRef;
    }
  }

  // 3. Inspect structured narration / payee if paymentMethod is not yet resolved
  const narration = (input.memo || "").trim();
  const payee = (input.payee || "").trim();
  const fullText = `${payee} ${narration}`.trim();

  if (!paymentMethod && fullText) {
    // Standard Indian bank export prefixes
    if (/^UPI[/-]/i.test(narration) || /^UPI[/-]/i.test(payee)) {
      paymentMethod = PaymentMethod.UPI;
      // Extract structured fields from standard UPI strings:
      // e.g. "UPI/425189201928/Merchant Name/user@okaxis/..."
      // or "UPI-425189201928-MERCHANT-USER@OKAXIS"
      const delimiter = fullText.includes("/")
        ? "/"
        : fullText.includes("-")
          ? "-"
          : " ";
      const tokens = fullText.split(delimiter).map((t) => t.trim());
      for (const token of tokens) {
        if (!upiReference && UPI_RRN_REGEX.test(token)) {
          upiReference = token;
        } else if (!upiVpa && isValidUpiVpa(token)) {
          upiVpa = token;
        }
      }
    } else if (/^IMPS[/-]/i.test(narration) || /^IMPS[/-]/i.test(payee)) {
      paymentMethod = PaymentMethod.IMPS;
    } else if (/^NEFT[/\s-]/i.test(narration) || /^NEFT[/\s-]/i.test(payee)) {
      paymentMethod = PaymentMethod.NEFT;
    } else if (/^RTGS[/\s-]/i.test(narration) || /^RTGS[/\s-]/i.test(payee)) {
      paymentMethod = PaymentMethod.RTGS;
    } else if (/^POS[/\s-]/i.test(narration) || /^POS[/\s-]/i.test(payee)) {
      paymentMethod = PaymentMethod.CARD;
    } else if (
      /^(CHQ\s*NO|CHEQUE[/\s-])/i.test(narration) ||
      /^(CHQ\s*NO|CHEQUE[/\s-])/i.test(payee)
    ) {
      paymentMethod = PaymentMethod.CHEQUE;
    }
  }

  return {
    paymentMethod,
    upiVpa,
    upiReference,
  };
}
