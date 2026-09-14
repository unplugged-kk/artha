/**
 * Common regex and extraction helpers for SMS parsers.
 */

const ACCOUNT_MASK_REGEXES = [
  /(?:a\/c|ac|account|card|credit card)\s*(?:no\.?|ending(?:\s+with)?|linked to|linked)?\s*[*Xx]*(\d{3,6})\b/i,
  /\b(?:[*Xx]{2,6})(\d{3,6})\b/,
];

const UPI_VPA_REGEX =
  /(?:vpa|to|from|by)\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)\b|([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)\b/i;

const UPI_REF_REGEXES = [
  /(?:upi\s+ref(?:erence)?(?:\s+no\.?|\s+num)?|rrn)[\s:]*([0-9]{12})\b/i,
  /upi\/([0-9]{12})\//i,
  /\b([0-9]{12})\b/, // 12-digit fallback if in UPI context
];

/**
 * Checks whether an SMS message is non-transactional (e.g. OTP, promotional, auto-debit reminder).
 */
export function isNonTransactionalMessage(message: string): {
  nonTransactional: boolean;
  reason?: string;
} {
  if (!message) {
    return { nonTransactional: true, reason: "empty_message" };
  }

  const upper = message.toUpperCase();

  // 1. OTP / Security codes
  if (
    upper.includes("OTP") ||
    upper.includes("VERIFICATION CODE") ||
    upper.includes("ONE TIME PASSWORD") ||
    upper.includes("DO NOT SHARE")
  ) {
    return { nonTransactional: true, reason: "otp_or_auth_message" };
  }

  // 2. Promotional / Offers / Pre-approved
  if (
    upper.includes("PRE-APPROVED") ||
    upper.includes("CONGRATULATIONS") ||
    upper.includes("APPLY NOW") ||
    upper.includes("CLICK HERE") ||
    upper.includes("SPECIAL OFFER") ||
    upper.includes("LOAN OFFER")
  ) {
    return { nonTransactional: true, reason: "promotional_message" };
  }

  // 3. Reminders / Scheduled mandates
  if (
    upper.includes("IS SCHEDULED") ||
    upper.includes("WILL BE DEBITED") ||
    upper.includes("MANDATE REMINDER") ||
    upper.includes("PAYMENT DUE")
  ) {
    return { nonTransactional: true, reason: "scheduled_reminder" };
  }

  return { nonTransactional: false };
}

/**
 * Extracts account/card mask from SMS text (e.g. "**1234" -> "1234").
 */
export function extractAccountMask(message: string): string | null {
  for (const regex of ACCOUNT_MASK_REGEXES) {
    const match = message.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extracts UPI Virtual Payment Address (VPA).
 */
export function extractUpiVpa(message: string): string | null {
  const match = message.match(UPI_VPA_REGEX);
  if (match) {
    return match[1] || match[2] || null;
  }
  return null;
}

/**
 * Extracts 12-digit UPI reference number / RRN.
 */
export function extractUpiReference(message: string): string | null {
  for (const regex of UPI_REF_REGEXES) {
    const match = message.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Cleans extracted payee string by trimming and removing noise prefixes/suffixes.
 */
export function cleanPayeeString(raw: string): string {
  if (!raw) return "";

  let cleaned = raw
    .trim()
    .replace(/^(?:at|to|from|for|towards|by|info:)\s+/i, "")
    .replace(/\s+(?:on|via|ref|bal|avl|using).*$/i, "")
    .replace(/[.,:;]+$/, "")
    .trim();

  // If ends with date-like string or reference number, strip
  cleaned = cleaned.replace(/\s+\d{2}-\d{2}-\d{2,4}$/, "");

  return cleaned.trim();
}
