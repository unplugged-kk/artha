import { describe, it, expect } from 'vitest';
import {
  isArthaHref,
  resolveEntityHref,
  stripLinkMarkup,
} from './ai-entity-links';

const uuid = '123e4567-e89b-42d3-a456-426614174000';

describe('stripLinkMarkup', () => {
  it('collapses a markdown link to its label text', () => {
    expect(
      stripLinkMarkup(`Spending on [Dining](artha://category/${uuid}) is up.`),
    ).toBe('Spending on Dining is up.');
  });

  it('collapses multiple links in one string', () => {
    expect(
      stripLinkMarkup(
        `[Netflix](artha://payee/${uuid}) in [Streaming](artha://category/${uuid})`,
      ),
    ).toBe('Netflix in Streaming');
  });

  it('leaves plain text without links unchanged', () => {
    expect(stripLinkMarkup('No links here')).toBe('No links here');
  });
});

describe('resolveEntityHref', () => {
  it('maps an account link to the transactions page with accountStatus=all', () => {
    expect(resolveEntityHref(`artha://account/${uuid}`)).toBe(
      `/transactions?accountId=${uuid}&accountStatus=all`,
    );
  });

  it('maps a payee link to a payee filter', () => {
    expect(resolveEntityHref(`artha://payee/${uuid}`)).toBe(
      `/transactions?payeeId=${uuid}`,
    );
  });

  it('maps a category link to a category filter', () => {
    expect(resolveEntityHref(`artha://category/${uuid}`)).toBe(
      `/transactions?categoryId=${uuid}`,
    );
  });

  it('maps a transaction link to the highlight deep link', () => {
    expect(resolveEntityHref(`artha://transaction/${uuid}`)).toBe(
      `/transactions?targetTransactionId=${uuid}`,
    );
  });

  it('maps a security link to the securities page highlight', () => {
    expect(resolveEntityHref(`artha://security/${uuid}`)).toBe(
      `/securities?highlight=${uuid}`,
    );
  });

  it('maps a scheduled link to the bills page highlight', () => {
    expect(resolveEntityHref(`artha://scheduled/${uuid}`)).toBe(
      `/bills?highlight=${uuid}`,
    );
  });

  it('accepts an uppercase UUID and scheme', () => {
    expect(
      resolveEntityHref(`ARTHA://payee/${uuid.toUpperCase()}`),
    ).toBe(`/transactions?payeeId=${uuid.toUpperCase()}`);
  });

  it('rejects unknown entity types (including MCP resource URIs and out-of-scope entities)', () => {
    // budget/report were intentionally left out of Phase 2.
    expect(resolveEntityHref(`artha://budget/${uuid}`)).toBeNull();
    expect(resolveEntityHref(`artha://report/${uuid}`)).toBeNull();
    expect(resolveEntityHref('artha://accounts')).toBeNull();
    expect(resolveEntityHref('artha://financial-summary')).toBeNull();
  });

  it('rejects malformed ids', () => {
    expect(resolveEntityHref('artha://payee/not-a-uuid')).toBeNull();
    expect(resolveEntityHref(`artha://payee/${uuid.slice(0, -1)}`)).toBeNull();
    expect(resolveEntityHref(`artha://payee/${uuid}0`)).toBeNull();
  });

  it('rejects trailing junk and query smuggling', () => {
    expect(resolveEntityHref(`artha://payee/${uuid}?x=1`)).toBeNull();
    expect(resolveEntityHref(`artha://payee/${uuid}/extra`)).toBeNull();
    expect(resolveEntityHref(`artha://payee/${uuid}#frag`)).toBeNull();
  });

  it('rejects non-artha and empty hrefs', () => {
    expect(resolveEntityHref('https://example.com')).toBeNull();
    expect(resolveEntityHref('/transactions?payeeId=x')).toBeNull();
    expect(resolveEntityHref('')).toBeNull();
    expect(resolveEntityHref(undefined)).toBeNull();
  });
});

describe('isArthaHref', () => {
  it('detects the artha scheme case-insensitively', () => {
    expect(isArthaHref(`artha://payee/${uuid}`)).toBe(true);
    expect(isArthaHref('ArThA://anything')).toBe(true);
  });

  it('returns false for other schemes and missing hrefs', () => {
    expect(isArthaHref('https://example.com')).toBe(false);
    expect(isArthaHref('/transactions')).toBe(false);
    expect(isArthaHref(undefined)).toBe(false);
  });
});
