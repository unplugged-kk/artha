import * as crypto from "crypto";

// L3: Fallback key used when no session/secret available, so tokens are
// still HMAC-bound rather than plain nonces
const FALLBACK_KEY = crypto.randomBytes(32).toString("hex");

export function generateCsrfToken(sessionId?: string, secret?: string): string {
  const nonce = crypto.randomBytes(32).toString("hex");
  // L3: Always generate HMAC-bound tokens, even without session binding.
  // Use sessionId if available; otherwise bind to the nonce itself with a fallback key.
  const bindingId = sessionId || nonce;
  const bindingSecret = secret || FALLBACK_KEY;
  const hmac = crypto
    .createHmac("sha256", bindingSecret)
    .update(`${nonce}:${bindingId}`)
    .digest("hex");
  return `${nonce}:${hmac}`;
}

export function verifyCsrfToken(
  token: string,
  sessionId?: string,
  secret?: string,
): boolean {
  const parts = token.split(":");
  if (parts.length !== 2) return false;
  const [nonce, providedHmac] = parts;

  // L3: Use the same fallback binding as generation
  const bindingId = sessionId || nonce;
  const bindingSecret = secret || FALLBACK_KEY;
  const expectedHmac = crypto
    .createHmac("sha256", bindingSecret)
    .update(`${nonce}:${bindingId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(providedHmac, "utf-8"),
    Buffer.from(expectedHmac, "utf-8"),
  );
}

export function getCsrfCookieOptions(isProduction: boolean) {
  return {
    httpOnly: false, // Must be readable by JavaScript for double-submit pattern
    secure: isProduction,
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches auth token)
    path: "/",
  };
}
