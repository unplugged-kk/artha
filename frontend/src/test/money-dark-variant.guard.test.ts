import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// A class string that colours TEXT green-600 or red-600 and says nothing about
// dark mode renders that colour on a dark card: red-600 is 3.7:1 there. The
// register's amount cell did exactly this, and it was the most-read number in
// the app. `gainLossColor` / `balanceColor` (lib/format.ts) carry the dark pair;
// use them, or write `dark:text-<colour>-400` beside the light one.
//
// A `hover:` colour is a state, not the resting text, and a checkbox's
// `text-red-600` is its accent, not text on a background; both are out of scope
// and the scan skips the first by construction. The second is listed.
const SRC = join(process.cwd(), 'src');
const LITERAL = /(["'`])((?:(?!\1)[\s\S])*?)\1/g;

// file -> why it may carry a light-only colour
const EXEMPT: Record<string, string> = {
  'components/settings/DangerZoneSection.tsx':
    'native checkbox accent colour, not text on a background',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('money text colours carry a dark variant', () => {
  it('finds no light-only green-600 or red-600 text', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (EXEMPT[rel]) continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(LITERAL)) {
        const literal = m[2];
        for (const colour of ['red', 'green']) {
          const resting = new RegExp(`(?<![:\\w-])text-${colour}-600\\b`);
          if (resting.test(literal) && !literal.includes(`dark:text-${colour}-`)) {
            const line = text.slice(0, m.index).split('\n').length;
            offenders.push(`${rel}:${line} text-${colour}-600 with no dark:text-${colour}-*`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every exemption still names a file that exists', () => {
    for (const rel of Object.keys(EXEMPT)) {
      expect(() => readFileSync(join(SRC, rel), 'utf8')).not.toThrow();
    }
  });
});
