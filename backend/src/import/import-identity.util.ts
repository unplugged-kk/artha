import { createHash } from "node:crypto";

/**
 * Priority 8: Import Identity & Idempotency
 *
 * Deterministic, canonical source-record representations and cryptographic
 * content hashes for imported financial transactions.
 *
 * Design principles:
 * 1. A deterministic canonical representation of the source record.
 * 2. SHA-256 cryptographic hash (64 hex chars), globally unique within account scope.
 * 3. Scoped to account (and user through account), preventing cross-account collisions.
 * 4. Distinguishes legitimate repeated transactions (e.g. identical payments on the same date)
 *    using stable source identifiers (FITID, reference numbers) when provided, or
 *    intra-import occurrence ordinals when source IDs are absent.
 * 5. Database-level partial unique index enforces atomic idempotency against concurrent imports.
 */

export interface CanonicalTransactionIdentityInput {
  /** Account ID receiving the transaction (scopes the identity). */
  accountId: string;
  /** ISO Date string YYYY-MM-DD. */
  date: string;
  /** Exact monetary amount (signed: positive = deposit, negative = expense). */
  amount: number;
  /** Payee name (raw from import). */
  payee?: string | null;
  /** Transaction memo/description (raw from import). */
  memo?: string | null;
  /** Upstream/source transaction identifier (e.g. OFX FITID, bank reference number, check number, MNY handle). */
  sourceId?: string | null;
  /** Whether this is a transfer. */
  isTransfer?: boolean;
  /** Transfer destination/source account ID (if known). */
  transferAccountId?: string | null;
  /** 1-based sequential occurrence count for identical content on the same date without sourceId. */
  ordinal?: number;
}

export interface CanonicalInvestmentIdentityInput {
  /** Account ID receiving the transaction. */
  accountId: string;
  /** ISO Date string YYYY-MM-DD. */
  date: string;
  /** Total transaction amount in security currency. */
  amount: number;
  /** Investment action (e.g. BUY, SELL, DIVIDEND, SPLIT). */
  action: string;
  /** Security symbol or identifier. */
  securitySymbol?: string | null;
  /** Number of shares (if applicable). */
  quantity?: number | null;
  /** Price per share (if applicable). */
  price?: number | null;
  /** Memo or description. */
  memo?: string | null;
  /** Upstream/source transaction identifier. */
  sourceId?: string | null;
  /** 1-based occurrence ordinal for identical investment trades. */
  ordinal?: number;
}

export interface TransactionImportIdentity {
  /** SHA-256 hex digest (64 characters, lowercase). */
  hash: string;
  /** Normalized source identifier (or null if absent). */
  sourceId: string | null;
  /** Canonical serialized string used to generate the hash (for audit/debugging). */
  canonicalString: string;
}

export interface ContentSignatureKeyInput {
  date: string;
  amount: number;
  payee?: string | null;
  memo?: string | null;
  sourceId?: string | null;
  isTransfer?: boolean;
  action?: string | null;
  securitySymbol?: string | null;
}

/**
 * Normalize whitespace in a string: trim leading/trailing spaces and collapse
 * internal consecutive whitespace to a single space.
 */
function normalizeWhitespace(val: string | null | undefined): string {
  if (!val) return "";
  return val.trim().replace(/\s+/g, " ");
}

/**
 * Format an amount with exact 4 decimal places, matching NUMERIC(20,4) precision.
 * Normalized so -0, 0.00, and 0 format identically.
 */
function normalizeAmount(amount: number): string {
  const normalized = Object.is(amount, -0) ? 0 : amount;
  return Number.isFinite(normalized) ? normalized.toFixed(4) : "0.0000";
}

/**
 * Format quantity with exact 8 decimal places, matching investment NUMERIC(20,8) precision.
 */
function normalizeQuantity(quantity: number | null | undefined): string {
  if (
    quantity === null ||
    quantity === undefined ||
    !Number.isFinite(quantity)
  ) {
    return "";
  }
  const normalized = Object.is(quantity, -0) ? 0 : quantity;
  return normalized.toFixed(8);
}

/**
 * Normalize a source identifier (e.g. OFX FITID, bank reference number, check number).
 * Returns trimmed non-empty string or null.
 */
export function normalizeSourceId(
  sourceId: string | null | undefined,
): string | null {
  if (!sourceId) return null;
  const trimmed = sourceId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Computes a deterministic key used to track the occurrence count of a transaction
 * within an import batch. When multiple identical transactions without source IDs
 * appear on the same date, this ensures they each receive sequential ordinals (1, 2, 3...)
 * rather than colliding on the first row.
 */
export function getContentSignatureKey(
  input: ContentSignatureKeyInput,
): string {
  const normDate = (input.date || "").trim();
  const normAmt = normalizeAmount(input.amount);
  const srcId = normalizeSourceId(input.sourceId);

  if (srcId) {
    return `src:${normDate}|${normAmt}|${srcId}`;
  }

  const normPayee = normalizeWhitespace(input.payee).toLowerCase();
  const normMemo = normalizeWhitespace(input.memo).toLowerCase();
  const normAction = (input.action || "").trim().toLowerCase();
  const normSec = (input.securitySymbol || "").trim().toUpperCase();
  const xfer = input.isTransfer ? "1" : "0";

  return `cnt:${normDate}|${normAmt}|${normPayee}|${normMemo}|${normAction}|${normSec}|${xfer}`;
}

/**
 * Compute the deterministic import identity for a regular banking/credit-card transaction.
 */
export function computeTransactionImportIdentity(
  input: CanonicalTransactionIdentityInput,
): TransactionImportIdentity {
  const accountId = (input.accountId || "").trim().toLowerCase();
  const date = (input.date || "").trim();
  const amountStr = normalizeAmount(input.amount);
  const normSourceId = normalizeSourceId(input.sourceId);
  const ordinal = Math.max(1, input.ordinal ?? 1);

  let canonicalString: string;

  if (normSourceId) {
    // When a stable upstream source identifier is available (OFX FITID, bank ref):
    // The source ID is the primary discriminator, scoped to the account, date, and amount.
    canonicalString = [
      "v1",
      `acc:${accountId}`,
      `dt:${date}`,
      `amt:${amountStr}`,
      `src:${normSourceId}`,
      `ord:${ordinal}`,
    ].join("|");
  } else {
    // When no source ID is available:
    // Deterministic canonical fields with exact amount and intra-batch ordinal.
    const normPayee = normalizeWhitespace(input.payee).toLowerCase();
    const normMemo = normalizeWhitespace(input.memo).toLowerCase();
    const isTransferStr = input.isTransfer ? "1" : "0";
    const xferAcct = (input.transferAccountId || "").trim().toLowerCase();

    canonicalString = [
      "v1",
      `acc:${accountId}`,
      `dt:${date}`,
      `amt:${amountStr}`,
      `pay:${normPayee}`,
      `mem:${normMemo}`,
      `xfer:${isTransferStr}`,
      `xacct:${xferAcct}`,
      `ord:${ordinal}`,
    ].join("|");
  }

  const hash = createHash("sha256")
    .update(canonicalString, "utf8")
    .digest("hex");

  return {
    hash,
    sourceId: normSourceId,
    canonicalString,
  };
}

/**
 * Compute the deterministic import identity for an investment transaction.
 */
export function computeInvestmentImportIdentity(
  input: CanonicalInvestmentIdentityInput,
): TransactionImportIdentity {
  const accountId = (input.accountId || "").trim().toLowerCase();
  const date = (input.date || "").trim();
  const amountStr = normalizeAmount(input.amount);
  const actionStr = (input.action || "").trim().toUpperCase();
  const normSecurity = (input.securitySymbol || "").trim().toUpperCase();
  const qtyStr = normalizeQuantity(input.quantity);
  const normSourceId = normalizeSourceId(input.sourceId);
  const ordinal = Math.max(1, input.ordinal ?? 1);

  let canonicalString: string;

  if (normSourceId) {
    canonicalString = [
      "v1_inv",
      `acc:${accountId}`,
      `dt:${date}`,
      `act:${actionStr}`,
      `sec:${normSecurity}`,
      `amt:${amountStr}`,
      `src:${normSourceId}`,
      `ord:${ordinal}`,
    ].join("|");
  } else {
    const normMemo = normalizeWhitespace(input.memo).toLowerCase();
    canonicalString = [
      "v1_inv",
      `acc:${accountId}`,
      `dt:${date}`,
      `act:${actionStr}`,
      `sec:${normSecurity}`,
      `qty:${qtyStr}`,
      `amt:${amountStr}`,
      `mem:${normMemo}`,
      `ord:${ordinal}`,
    ].join("|");
  }

  const hash = createHash("sha256")
    .update(canonicalString, "utf8")
    .digest("hex");

  return {
    hash,
    sourceId: normSourceId,
    canonicalString,
  };
}

/**
 * Checks if a caught error represents a unique constraint violation (PG 23505)
 * on the import_hash index.
 */
export function isDuplicateImportError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as {
    code?: string;
    driverError?: { code?: string; constraint?: string; message?: string };
    constraint?: string;
    message?: string;
  };

  const code = err.code || err.driverError?.code;
  if (code !== "23505") {
    // Fallback: check message text
    const message = (err.message || "") + (err.driverError?.message || "");
    if (
      message.includes("idx_transactions_account_import_hash") ||
      message.includes("idx_investment_transactions_account_import_hash")
    ) {
      return true;
    }
    return false;
  }

  const constraint = err.constraint || err.driverError?.constraint || "";
  if (
    constraint.includes("import_hash") ||
    constraint === "idx_transactions_account_import_hash" ||
    constraint === "idx_investment_transactions_account_import_hash"
  ) {
    return true;
  }

  // If code is 23505 and message mentions import_hash
  const msg = (err.message || "") + (err.driverError?.message || "");
  return msg.includes("import_hash");
}
