/**
 * How many reverse proxies sit between the internet and this process.
 *
 * Express's `trust proxy` decides which `X-Forwarded-For` entry is the client.
 * Too low and every request looks like it comes from the platform's edge, so the
 * rate limiter throttles everyone as one person; too high and a client can write
 * its own address into the header. The right number depends on where the app is
 * hosted (nginx or a bare container: 1; Railway: 1; Cloudflare in front of
 * Railway: 2), so it is configuration, not a constant. `true` is refused on
 * purpose: it trusts every hop, including the client's own header.
 */
export const DEFAULT_TRUST_PROXY_HOPS = 1;
export const MAX_TRUST_PROXY_HOPS = 10;

export function resolveTrustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TRUST_PROXY_HOPS;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `TRUST_PROXY_HOPS must be a whole number from 0 to ${MAX_TRUST_PROXY_HOPS}`,
    );
  }
  const hops = Number(value);
  if (hops > MAX_TRUST_PROXY_HOPS) {
    throw new Error(
      `TRUST_PROXY_HOPS must be a whole number from 0 to ${MAX_TRUST_PROXY_HOPS}`,
    );
  }
  return hops;
}
