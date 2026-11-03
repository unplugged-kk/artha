import { describe, it, expect } from 'vitest';
import { assertedClientAddress } from './client-address';

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('assertedClientAddress', () => {
  it('prefers X-Real-IP, the single-address convention', () => {
    expect(
      assertedClientAddress(
        headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.9' }),
      ),
    ).toBe('203.0.113.7');
  });

  /**
   * The regression. The predecessor read X-Real-IP and nothing else, so every
   * deployment behind an edge that sets only X-Forwarded-For -- Traefik, most
   * cloud load balancers -- fell through to a hardcoded `127.0.0.1`.
   */
  it('falls back to X-Forwarded-For when no X-Real-IP was set', () => {
    expect(
      assertedClientAddress(headers({ 'x-forwarded-for': '198.51.100.9' })),
    ).toBe('198.51.100.9');
  });

  // Each hop appends the peer it heard from, so the originating client is the
  // head of the list, not the tail.
  it('reads the first entry of a forwarded chain, not the last', () => {
    expect(
      assertedClientAddress(
        headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.2, 10.0.0.3' }),
      ),
    ).toBe('198.51.100.9');
  });

  it('trims the entry, since the chain is written with spaces', () => {
    expect(
      assertedClientAddress(headers({ 'x-forwarded-for': ' 198.51.100.9 ,10.0.0.2' })),
    ).toBe('198.51.100.9');
  });

  it('keeps an IPv6 address whole rather than splitting on its colons', () => {
    expect(assertedClientAddress(headers({ 'x-real-ip': '2001:db8::1' }))).toBe(
      '2001:db8::1',
    );
  });

  /**
   * Unknown is a state, and it is the whole reason this returns `null`: the
   * caller forwards no `X-Forwarded-For` at all rather than a placeholder, so
   * the backend records "we could not determine one" instead of an address
   * nobody was at.
   */
  it.each([
    ['no headers at all', {}],
    ['an empty X-Real-IP', { 'x-real-ip': '' }],
    ['a whitespace X-Forwarded-For', { 'x-forwarded-for': '   ' }],
    ['an empty leading entry', { 'x-forwarded-for': ', 10.0.0.2' }],
  ])('answers null for %s', (_name, entries) => {
    expect(assertedClientAddress(headers(entries))).toBeNull();
  });

  // An empty X-Real-IP must not shadow a usable chain: the header being present
  // is not the same as it carrying an address.
  it('falls through an empty X-Real-IP to the forwarded chain', () => {
    expect(
      assertedClientAddress(
        headers({ 'x-real-ip': '', 'x-forwarded-for': '198.51.100.9' }),
      ),
    ).toBe('198.51.100.9');
  });
});

describe('assertedClientAddress with an operator-named header', () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it('prefers the named header over X-Real-IP and X-Forwarded-For', () => {
    expect(
      assertedClientAddress(
        h({ 'cf-connecting-ip': '203.0.113.9', 'x-real-ip': '172.70.0.1', 'x-forwarded-for': '198.51.100.7' }),
        'cf-connecting-ip',
      ),
    ).toBe('203.0.113.9');
  });

  it('is case-insensitive about the configured name', () => {
    expect(assertedClientAddress(h({ 'cf-connecting-ip': '203.0.113.9' }), 'CF-Connecting-IP')).toBe('203.0.113.9');
  });

  it('falls back to the usual headers when the named one is absent or empty', () => {
    expect(assertedClientAddress(h({ 'x-real-ip': '198.51.100.7' }), 'cf-connecting-ip')).toBe('198.51.100.7');
    expect(assertedClientAddress(h({ 'cf-connecting-ip': ' ', 'x-real-ip': '198.51.100.7' }), 'cf-connecting-ip')).toBe('198.51.100.7');
  });

  it('is unchanged when nothing is configured', () => {
    expect(assertedClientAddress(h({ 'x-real-ip': '198.51.100.7', 'cf-connecting-ip': '203.0.113.9' }))).toBe('198.51.100.7');
    expect(assertedClientAddress(h({}), undefined)).toBeNull();
  });

  it('ignores a configured name that is not a plain header token', () => {
    for (const bad of ['x real ip', 'a:b', 'x\r\nhost', '../etc', 'a'.repeat(65)]) {
      expect(assertedClientAddress(h({ 'x-real-ip': '198.51.100.7' }), bad)).toBe('198.51.100.7');
    }
  });

  it('reads only the first entry of a list, as for the other headers', () => {
    expect(assertedClientAddress(h({ 'cf-connecting-ip': '203.0.113.9, 10.0.0.1' }), 'cf-connecting-ip')).toBe('203.0.113.9');
  });
});
