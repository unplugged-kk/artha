/**
 * Utility for extracting exact transaction amount and balance from Indian bank SMS text.
 */

// Pattern matching available balance or credit limit to exclude from transaction amount
const BALANCE_REGEX =
  /(?:avl(?:[\s.]*bal(?:ance)?)?|bal(?:ance)?|avl[\s.]*limit|available[\s.]*balance)[\s:]*(?:is\s*)?(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,4})?)/i;

/**
 * Normalizes an amount string like "1,450.50" to numeric value 1450.5.
 */
export function normalizeAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const num = Number(cleaned);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return null;
  }
  // Max 4 decimal places
  return Math.round(num * 10000) / 10000;
}

/**
 * Extracts the available balance if present in the SMS.
 */
export function extractAvailableBalance(message: string): number | null {
  const match = message.match(BALANCE_REGEX);
  if (match && match[1]) {
    return normalizeAmount(match[1]);
  }
  return null;
}

/**
 * Extracts the transaction amount from an SMS message.
 * Ensures the balance figure is not accidentally extracted as the transaction amount.
 */
export function extractTransactionAmount(message: string): number | null {
  if (!message) return null;

  // Remove the balance portion temporarily so we don't accidentally match it
  const messageWithoutBalance = message.replace(BALANCE_REGEX, "");

  // High-confidence patterns with transaction intent words or explicit currency prefix
  const patterns: RegExp[] = [
    // 1. Explicit transaction context keywords
    /(?:debited(?:\s+for|\s+with|\s+by)?|credited(?:\s+for|\s+with|\s+by)?|spent|sent|withdrawn|paid|received|refund(?:ed)?|transfer(?:red)?|transaction(?:\s+of)?|used\s+for(?:\s+a)?\s+transaction\s+of)\s+(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,4})?)/i,

    // 2. Explicit currency prefix followed by amount and transaction action
    /(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,4})?)\s*(?:debited|credited|spent|sent|withdrawn|paid|received|refunded|transferred)/i,

    // 3. Leading amount with currency prefix: "Rs.500.00 debited" / "INR 1,450.00 on ..."
    /(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,4})?)/i,

    // 4. Standalone amount preceded by "for": "for Rs.1,200.00" or "for 450.00"
    /(?:for|sum\s+of)\s+(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,4})?)/i,
  ];

  for (const pattern of patterns) {
    const match = messageWithoutBalance.match(pattern);
    if (match && match[1]) {
      const amount = normalizeAmount(match[1]);
      if (amount !== null && amount > 0) {
        return amount;
      }
    }
  }

  return null;
}
