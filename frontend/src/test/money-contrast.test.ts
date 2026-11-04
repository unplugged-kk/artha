import { describe, it, expect } from 'vitest';
import { COLOR_THEMES } from '@/lib/color-themes';
import { resolveHex, themeTokens } from './theme-css';

// Gains, losses and balances are the most-read text in the app, and they are
// drawn in Tailwind's green-600 / red-600 (light) and green-400 / red-400 (dark)
// at about 340 call sites. A palette whose surface or whose money colour drifts
// below 4.5:1 turns a figure into something a reader has to squint at, so this
// holds the floor for every theme in both modes. The tokens are defined once, in
// globals.css; the call sites are not asked to remember anything.
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES: string[] = [...COLOR_THEMES];

describe('money text colours', () => {
  it('knows the themes it is checking', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(15);
  });

  describe.each(THEMES)('%s', (theme) => {
    it.each(['light', 'dark'] as const)('%s: gains and losses clear 4.5:1 on card and page', (mode) => {
      const t = themeTokens(theme, mode);
      const at = (n: string) => resolveHex(t, n);
      const card = mode === 'light' ? at('--color-white') : at('--color-gray-800');
      const page = mode === 'light' ? at('--color-gray-50') : at('--color-gray-900');
      const gain = at(mode === 'light' ? '--color-green-600' : '--color-green-400');
      const loss = at(mode === 'light' ? '--color-red-600' : '--color-red-400');
      const worst = Math.min(
        contrast(gain, card),
        contrast(gain, page),
        contrast(loss, card),
        contrast(loss, page),
      );
      expect(worst, `${theme} ${mode}`).toBeGreaterThanOrEqual(4.5);
    });
  });
});
