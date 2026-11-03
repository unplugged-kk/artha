import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { COLOR_THEMES } from '@/lib/color-themes';
import { resolveHex, themeTokens } from '@/test/theme-css';
import {
  CATEGORY_CHIP_CLASS,
  categoryChipStyle,
  chipBackground,
  contrastRatio,
  luminance,
  readableChipText,
  WORST_BASE,
} from './category-chip';

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** Every hue at several saturations and lightnesses, as hex. */
function sweep(): string[] {
  const out: string[] = [];
  const hsl = (h: number, s: number, l: number) => {
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  for (let h = 0; h < 360; h += 6)
    for (const s of [20, 50, 80, 100])
      for (const l of [8, 18, 30, 45, 60, 75, 88, 96]) out.push(hsl(h, s, l));
  return out;
}

const THEMES: string[] = [...COLOR_THEMES];
const COLOURS = sweep();

describe('category chip text', () => {
  it.each(THEMES)('%s: every colour is readable in both modes against that palette\'s real chip base', (theme) => {
    const failures: string[] = [];
    for (const mode of ['light', 'dark'] as const) {
      const t = themeTokens(theme, mode);
      const base = rgb(resolveHex(t, '--category-bg-base'));
      for (const color of COLOURS) {
        const fg = readableChipText(color, mode);
        const ratio = contrastRatio(rgb(fg as string), chipBackground(rgb(color), base));
        if (ratio < 4.5) failures.push(`${mode} ${color} -> ${fg} ${ratio.toFixed(2)}`);
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it.each(THEMES)('%s: no palette\'s chip base is more adverse than the bound the text is computed against', (theme) => {
    const light = rgb(resolveHex(themeTokens(theme, 'light'), '--category-bg-base'));
    const dark = rgb(resolveHex(themeTokens(theme, 'dark'), '--category-bg-base'));
    // Light mode: a darker base is worse. Dark mode: a lighter base is worse.
    expect(luminance(light)).toBeGreaterThanOrEqual(luminance(rgb(WORST_BASE.light)) - 1e-3);
    expect(luminance(dark)).toBeLessThanOrEqual(luminance(rgb(WORST_BASE.dark)) + 1e-3);
  });

  it('leaves a colour that already reads exactly as chosen', () => {
    expect(readableChipText('#0b1e4a', 'light')).toBe('#0b1e4a');
    expect(readableChipText('#eaf2ff', 'dark')).toBe('#eaf2ff');
  });

  it('moves a failing colour only toward black in light mode and white in dark mode', () => {
    const light = rgb(readableChipText('#fde047', 'light') as string);
    const dark = rgb(readableChipText('#1e3a8a', 'dark') as string);
    expect(Math.max(...light)).toBeLessThan(253);
    expect(Math.min(...dark)).toBeGreaterThan(30);
  });

  it('keeps a failing colour\'s hue family rather than turning it grey', () => {
    const [r, g, b] = rgb(readableChipText('#f59e0b', 'light') as string); // amber
    expect(r).toBeGreaterThan(b + 20);
    expect(g).toBeGreaterThan(b);
  });

  it('is the neutral chip with no colour, or one that is not hex', () => {
    for (const none of [null, undefined, '', 'red', 'var(--x)', 'hsl(10 50% 50%)', '#12']) {
      expect(categoryChipStyle(none)).toEqual({ backgroundColor: 'var(--category-bg-base, #e5e7eb)' });
    }
  });

  it('hands CSS both modes as custom properties and tints the background by the chip base', () => {
    const style = categoryChipStyle('#3b82f6') as Record<string, string>;
    expect(style['--chip-fg-light']).toMatch(/^#[0-9a-f]{6}$/);
    expect(style['--chip-fg-dark']).toMatch(/^#[0-9a-f]{6}$/);
    expect(style.backgroundColor).toBe('color-mix(in srgb, #3b82f6 15%, var(--category-bg-base, #e5e7eb))');
  });

  it('accepts a three-digit hex', () => {
    expect(readableChipText('#fc0', 'light')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('exports the class the stylesheet keys on', () => {
    expect(CATEGORY_CHIP_CLASS).toBe('category-chip');
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toContain(`.${CATEGORY_CHIP_CLASS} {`);
    expect(css).toContain(`.dark .${CATEGORY_CHIP_CLASS} {`);
  });
});

describe('the chip colour is decided in one place', () => {
  const SRC = join(process.cwd(), 'src');
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) out.push(p);
    }
    return out;
  };

  it('no component mixes a category colour toward the text colour itself', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith('category-chip.ts'))
      .filter((f) => /color-mix\([^)]*\$\{[^}]*[cC]olor\}[^)]*(category-text|text-mix)/.test(readFileSync(f, 'utf8')) || readFileSync(f, 'utf8').includes('category-text-mix'))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
