import type { CSSProperties } from 'react';

/**
 * Colours for a category chip: a tint of the user's own colour behind text that
 * is always readable.
 *
 * The chip used to mix the category colour 85% toward the text colour of the
 * mode. That cannot hold for an arbitrary user-chosen hue: a pale yellow on a
 * light chip measured 1.2:1 and a dark navy on a dark chip 1.0:1, because no
 * single mix ratio is right at both ends of the lightness range. Instead the
 * text colour starts as the category's own colour and moves toward black (light
 * mode) or white (dark mode) only as far as it must to clear `TARGET_RATIO`, so
 * a colour that already reads is left alone and one that does not keeps as much
 * of its hue as the contrast allows.
 *
 * Both modes are computed here and handed to CSS as two custom properties;
 * `.category-chip` (globals.css) picks one from the `dark` class. That keeps the
 * choice off JavaScript -- no hook, and no flash on a server-rendered dark page.
 *
 * The background is the user's colour at 15% over the theme's chip base, which
 * is a CSS variable (`--category-bg-base`) so it follows the palette. The text
 * is computed against the worst-case base for the mode (`WORST_BASE`), so it
 * holds on every palette; `category-chip.test.ts` checks that against each
 * palette's real base.
 */
export const CATEGORY_CHIP_CLASS = 'category-chip';

/** Above the 4.5:1 AA floor: absorbs hex rounding and the small differences between bases of equal luminance. */
export const TARGET_RATIO = 4.9;
/**
 * The chip base in the palette where it makes text LEAST readable, per mode:
 * burgundy's pink gray-200 (the darkest light base) and forest's green gray-700
 * (the lightest dark base). Contrast only falls as the base moves toward the
 * text, so text that clears the target here clears it on every palette.
 * `category-chip.test.ts` fails when a palette's `--category-bg-base` is more
 * adverse than these, so adding a theme cannot quietly break the guarantee.
 */
export const WORST_BASE = { light: '#efb4ba', dark: '#324e39' } as const;
const TINT_SHARE = 0.15;

type Rgb = [number, number, number];

function parseHex(color: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const toHex = (rgb: Rgb): string =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

const lin = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `a` toward `b`: share 0 is `a`, share 1 is `b`. Gamma-space, as `color-mix(in srgb)`. */
const lerp = (a: Rgb, b: Rgb, share: number): Rgb =>
  a.map((v, i) => v + (b[i] - v) * share) as Rgb;

/** The chip background as the browser mixes it, over a given base. */
export function chipBackground(color: Rgb, base: Rgb): Rgb {
  return lerp(base, color, TINT_SHARE);
}

/**
 * The text colour for one mode: the category colour itself when it already
 * clears the target against the chip, otherwise the smallest step toward the
 * mode's extreme that does.
 */
export function readableChipText(color: string, mode: 'light' | 'dark'): string | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const bg = chipBackground(rgb, parseHex(WORST_BASE[mode]) as Rgb);
  if (contrastRatio(rgb, bg) >= TARGET_RATIO) return toHex(rgb);
  const extreme: Rgb = mode === 'light' ? [0, 0, 0] : [255, 255, 255];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(lerp(rgb, extreme, mid), bg) >= TARGET_RATIO) hi = mid;
    else lo = mid;
  }
  return toHex(lerp(rgb, extreme, hi));
}

/** Inline style for a category chip. No colour (or one that is not hex) is the neutral chip. */
export function categoryChipStyle(color: string | null | undefined): CSSProperties {
  const light = color ? readableChipText(color, 'light') : null;
  const dark = color ? readableChipText(color, 'dark') : null;
  if (!color || !light || !dark) {
    return { backgroundColor: 'var(--category-bg-base, #e5e7eb)' };
  }
  return {
    backgroundColor: `color-mix(in srgb, ${color} 15%, var(--category-bg-base, #e5e7eb))`,
    '--chip-fg-light': light,
    '--chip-fg-dark': dark,
  } as CSSProperties;
}
