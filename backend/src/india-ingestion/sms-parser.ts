/**
 * Deterministic parser for Indian bank transaction SMS. Pure: no I/O, no AI.
 * A message it cannot read with confidence is `unparsed` (the review queue's
 * AI fallback or the user takes it from there); it never guesses an amount
 * or a date.
 */

export type SmsBank = "hdfc" | "icici" | "sbi" | "axis" | "kotak" | "unknown";
export type SmsDirection = "debit" | "credit";

export interface ParsedSms {
  readonly status: "parsed";
  readonly bank: SmsBank;
  readonly direction: SmsDirection;
  /** Whole currency units with up to 2 decimals; always positive. */
  readonly amount: number;
  readonly currencyCode: "INR";
  readonly accountLast4: string | null;
  /** ISO date, or null when the message carries none or it is ambiguous. */
  readonly date: string | null;
  readonly counterparty: string | null;
  readonly vpa: string | null;
  readonly reference: string | null;
  readonly isUpi: boolean;
  /** high: bank recognised and every core field present. */
  readonly confidence: "high" | "low";
}

export interface UnparsedSms {
  readonly status: "unparsed";
  readonly reason: "no_amount" | "no_direction" | "not_a_transaction";
}

export type SmsParseResult = ParsedSms | UnparsedSms;

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function detectBank(t: string): SmsBank {
  // A VPA handle (swiggy@icici) names the payee's PSP, not the sender's bank.
  const s = t.toLowerCase().replace(/\S+@\S+/g, " ");
  if (s.includes("hdfc")) return "hdfc";
  if (s.includes("icici")) return "icici";
  if (s.includes("kotak")) return "kotak";
  if (s.includes("axis")) return "axis";
  if (/\bsbi\b|state bank/.test(s)) return "sbi";
  // SBI UPI alerts carry no bank name: "Dear UPI user A/C X1234 debited by".
  if (/dear upi user/.test(s)) return "sbi";
  return "unknown";
}

function parseAmount(t: string): number | null {
  const m =
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(t) ??
    /(?:debited|credited)\s+by\s+([\d,]+(?:\.\d{1,2})?)/i.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function parseDirection(t: string): SmsDirection | null {
  // ICICI: "Acct XX123 debited for Rs 1,500.00 ...; ZOMATO credited." -- the
  // trailing clause describes the receiver, not the account holder.
  const s = t.toLowerCase().replace(/;[^;]*\bcredited\b[^;]*/g, "");
  const debit = /\b(debited|sent|paid|withdrawn|spent)\b/.test(s);
  const credit = /\b(credited|received|deposited)\b/.test(s);
  if (debit === credit) return null; // neither, or contradictory
  return debit ? "debit" : "credit";
}

function isoDate(y: string, m: string, d: string): string | null {
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(t: string): string | null {
  // 12-Mar-25, 12Mar25, 12 Mar 2025
  const named = /\b(\d{1,2})[-\s/]?([A-Za-z]{3})[a-z]*[-\s/]?(\d{2,4})\b/.exec(
    t,
  );
  if (named && MONTHS[named[2].toLowerCase()]) {
    return isoDate(named[3], MONTHS[named[2].toLowerCase()], named[1]);
  }
  // 12-03-25 or 12/03/2025: India writes day first.
  const numeric = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/.exec(t);
  if (numeric) return isoDate(numeric[3], numeric[2], numeric[1]);
  return null;
}

function parseLast4(t: string): string | null {
  const m =
    /(?:a\/c|acct?|account|ac)(?:\s*no\.?)?\s*[:.]?\s*(?:\*+|x+|X+)?\s*(\d{3,4})\b/i.exec(
      t,
    );
  return m ? m[1].slice(-4) : null;
}

function parseVpa(t: string): string | null {
  const m = /\b([a-z0-9._-]{2,}@[a-z]{2,})\b/i.exec(t);
  return m ? m[1].toLowerCase() : null;
}

function parseReference(t: string): string | null {
  const m =
    /(?:ref(?:erence)?(?:\s*(?:no|num|number))?\.?|upi|refno)[\s:./-]*(\d{9,14})\b/i.exec(
      t,
    ) ?? /\/(\d{12})\//.exec(t);
  return m ? m[1] : null;
}

function parseCounterparty(t: string, vpa: string | null): string | null {
  // Axis style: UPI/P2M/123456789012/Merchant Name
  const slash = /UPI\/P2[MP]\/\d+\/([^/\n]+)/i.exec(t);
  if (slash) return slash[1].trim();
  // "to NAME on|Ref|(" ; "trf to NAME"; "; NAME credited"
  const to =
    /\b(?:to|trf to)\s+(?!VPA\b|a\/c\b)([A-Za-z][A-Za-z0-9 &.'-]{1,40}?)(?=\s+(?:on|ref|upi|\(|\.)|[.;(]|$)/i.exec(
      t,
    );
  if (to && !to[1].includes("@")) return to[1].trim();
  const semi = /;\s*([A-Za-z][A-Za-z0-9 &.'-]{1,40}?)\s+credited/i.exec(t);
  if (semi) return semi[1].trim();
  return vpa;
}

export function parseBankSms(text: string): SmsParseResult {
  const t = text.replace(/\s+/g, " ").trim();
  if (/\b(otp|one time password|do not share)\b/i.test(t)) {
    return { status: "unparsed", reason: "not_a_transaction" };
  }
  const amount = parseAmount(t);
  if (amount === null) return { status: "unparsed", reason: "no_amount" };
  const direction = parseDirection(t);
  if (direction === null) return { status: "unparsed", reason: "no_direction" };

  const bank = detectBank(t);
  const vpa = parseVpa(t);
  const reference = parseReference(t);
  const accountLast4 = parseLast4(t);
  const date = parseDate(t);
  return {
    status: "parsed",
    bank,
    direction,
    amount,
    currencyCode: "INR",
    accountLast4,
    date,
    counterparty: parseCounterparty(t, vpa),
    vpa,
    reference,
    isUpi: /\bupi\b|@[a-z]{2,}/i.test(t),
    confidence:
      bank !== "unknown" && accountLast4 !== null && date !== null
        ? "high"
        : "low",
  };
}
