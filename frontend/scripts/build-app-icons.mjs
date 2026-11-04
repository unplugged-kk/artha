/**
 * The Artha mark, and every file that is derived from it.
 *
 * One source of truth: the geometry and colours below. Running this script
 * writes the in-app logo (transparent), the boxed logo, the website copy and
 * every PNG (app icons, maskable icons, Apple touch icon). Nothing else in the
 * repository is allowed to hold a hand-drawn copy of the mark;
 * `src/test/brand-icons.test.ts` fails when a committed file stops matching
 * what this script produces.
 *
 *   node scripts/build-app-icons.mjs            write everything
 *   node scripts/build-notification-badge.mjs   then rebuild the monochrome badge
 *
 * The mark is a geometric A: a flat-topped inverted V with a crossbar. The
 * crossbar is gold, the rest is blue (in-app) or white on navy (app icons).
 *
 * Constraints other code puts on this file:
 * - `build-notification-badge.mjs` reads the FIRST `d="..."` in the transparent
 *   SVG and rasterizes it with nonzero winding, so the first path is the whole
 *   silhouette, and it only understands M, L, C and Z.
 * - The two shapes inside that path do not overlap, so the winding rule cannot
 *   matter.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(here, '../public/icons');
const WEBSITE_LOGO = resolve(here, '../../website/assets/img/artha-logo.svg');

export const BRAND = {
  /** The A in the app, bright enough on both the light and the dark page. */
  blue: '#3b6ff0',
  /** The crossbar. */
  gold: '#f5a623',
  /** The app-icon background. */
  navy: '#0f2557',
  white: '#ffffff',
};

/** The A: legs only, then the crossbar sitting in the counter. 1000 x 1000 box. */
const LEGS = 'M120,900 L420,100 L580,100 L880,900 L690,900 L500,380 L310,900 Z';
/** Fills the counter between the legs at y 640..740, touching both inner edges. */
const BAR = 'M368.46,740 L631.54,740 L595,640 L405,640 Z';
/** The whole silhouette in one path: what the badge rasterizer reads. */
export const SILHOUETTE = `${LEGS} ${BAR}`;

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';

/** The in-app logo: no background, so it sits on a light or a dark page. */
export function transparentSvg() {
  return `${XML}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="Artha">
  <title>Artha</title>
  <path fill="${BRAND.blue}" d="${SILHOUETTE}"/>
  <path fill="${BRAND.gold}" d="${BAR}"/>
</svg>
`;
}

/**
 * A square icon: navy field, white A, gold bar. `scale` is how much of the
 * square the glyph's 1000-unit box fills; the rest is padding. Maskable icons
 * use a smaller scale so the glyph stays inside the platform's safe circle.
 */
export function boxedSvg(scale = 0.8) {
  const offset = (1000 * (1 - scale)) / 2;
  return `${XML}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="Artha">
  <title>Artha</title>
  <rect width="1000" height="1000" fill="${BRAND.navy}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path fill="${BRAND.white}" d="${SILHOUETTE}"/>
    <path fill="${BRAND.gold}" d="${BAR}"/>
  </g>
</svg>
`;
}

/** Maskable icons keep the glyph inside the central 80% circle (the safe zone is 40% radius). */
export const MASKABLE_SCALE = 0.64;
export const ANY_SCALE = 0.8;

export const PNG_ICONS = [
  { file: 'icon-192x192.png', size: 192, scale: ANY_SCALE },
  { file: 'icon-512x512.png', size: 512, scale: ANY_SCALE },
  { file: 'icon-maskable-192x192.png', size: 192, scale: MASKABLE_SCALE },
  { file: 'icon-maskable-512x512.png', size: 512, scale: MASKABLE_SCALE },
  { file: 'apple-touch-icon.png', size: 180, scale: ANY_SCALE },
];

export async function renderPng(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();
}

/** Every file this script owns, as path -> contents. */
export async function buildIconSet() {
  const files = new Map();
  files.set(resolve(ICONS_DIR, 'artha-logo-transparent.svg'), transparentSvg());
  files.set(resolve(ICONS_DIR, 'artha-logo.svg'), boxedSvg(ANY_SCALE));
  files.set(WEBSITE_LOGO, boxedSvg(ANY_SCALE));
  for (const { file, size, scale } of PNG_ICONS) {
    files.set(resolve(ICONS_DIR, file), await renderPng(boxedSvg(scale), size));
  }
  return files;
}

export const ICON_PATHS = { ICONS_DIR, WEBSITE_LOGO };

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const files = await buildIconSet();
  for (const [path, contents] of files) writeFileSync(path, contents);
  process.stdout.write(`Wrote ${files.size} files\n`);
}
