import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import * as icons from '../../scripts/build-app-icons.mjs';
import { parsePath } from '../../scripts/build-notification-badge.mjs';

// The mark is defined once, in scripts/build-app-icons.mjs, and everything else
// is derived from it. The app used to ship the logo of the project it was forked
// from, committed as hand-exported files nothing tied to anything -- so these
// tests tie them: a committed file that stops matching the generator fails, the
// maskable icons must keep the glyph inside the platform's safe circle, and the
// old brand colours must not come back.
const repo = resolve(__dirname, '../../..');
const iconsDir = resolve(repo, 'frontend/public/icons');

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('the committed brand files match the generator', () => {
  it('every SVG is byte-identical to what the script produces', async () => {
    const files: Map<string, string | Buffer> = await icons.buildIconSet();
    for (const [path, contents] of files) {
      if (typeof contents !== 'string') continue;
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path, 'utf8'), path).toBe(contents);
    }
  });

  it('every PNG exists at the size the script asks for', async () => {
    for (const { file, size } of icons.PNG_ICONS as { file: string; size: number }[]) {
      const meta = await sharp(resolve(iconsDir, file)).metadata();
      expect([meta.width, meta.height], file).toEqual([size, size]);
    }
  });
});

describe('the app icons', () => {
  it('are opaque and carry the navy field in every corner (a transparent icon masks to a hole)', async () => {
    for (const { file, size } of icons.PNG_ICONS as { file: string; size: number }[]) {
      const { data, info } = await sharp(resolve(iconsDir, file)).raw().toBuffer({ resolveWithObject: true });
      const at = (x: number, y: number) => Array.from(data.subarray((y * size + x) * info.channels, (y * size + x) * info.channels + 3));
      const navy = [1, 3, 5].map((i) => parseInt(icons.BRAND.navy.slice(i, i + 2), 16));
      for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
        const px = at(x, y);
        expect(Math.max(...px.map((v, i) => Math.abs(v - navy[i]))), `${file} corner ${x},${y}`).toBeLessThan(6);
      }
      if (info.channels === 4) {
        for (let i = 3; i < data.length; i += 4) expect(data[i], file).toBe(255);
      }
    }
  });

  it('keep the maskable glyph inside the safe zone (a circle of 40% of the side)', async () => {
    for (const { file, size } of (icons.PNG_ICONS as { file: string; size: number }[]).filter((i) => i.file.includes('maskable'))) {
      const { data, info } = await sharp(resolve(iconsDir, file)).raw().toBuffer({ resolveWithObject: true });
      const navy = [1, 3, 5].map((i) => parseInt(icons.BRAND.navy.slice(i, i + 2), 16));
      const centre = (size - 1) / 2;
      let farthest = 0;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const o = (y * size + x) * info.channels;
          const differs = Math.max(...[0, 1, 2].map((c) => Math.abs(data[o + c] - navy[c]))) > 40;
          if (differs) farthest = Math.max(farthest, Math.hypot(x - centre, y - centre));
        }
      }
      expect(farthest / size, file).toBeLessThanOrEqual(0.4);
    }
  });

  it('use the ordinary icons at a larger glyph than the maskable ones', () => {
    expect(icons.ANY_SCALE).toBeGreaterThan(icons.MASKABLE_SCALE);
  });
});

describe('the in-app logo', () => {
  const svg = readFileSync(resolve(iconsDir, 'artha-logo-transparent.svg'), 'utf8');

  it('has no background, so it sits on a light or a dark page', () => {
    expect(svg).not.toMatch(/<rect/);
  });

  it('carries the whole silhouette in its FIRST path, which the notification badge rasterizes', () => {
    expect(svg.match(/\sd="([^"]+)"/)?.[1]).toBe(icons.SILHOUETTE);
  });

  it('uses only path commands the badge rasterizer understands', () => {
    expect(() => parsePath(icons.SILHOUETTE)).not.toThrow();
    expect(parsePath(icons.SILHOUETTE).length).toBe(2); // the A and the crossbar
  });

  it('is legible as a graphic on both page backgrounds (3:1) and the icon field is strong (7:1)', () => {
    expect(contrast(icons.BRAND.blue, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(icons.BRAND.blue, '#101828')).toBeGreaterThanOrEqual(3);
    expect(contrast(icons.BRAND.white, icons.BRAND.navy)).toBeGreaterThanOrEqual(7);
  });
});

describe('the previous project\'s brand is gone', () => {
  const OLD = [/#4fa091/i, /#2f7f72/i];
  const scanned = [
    ...readdirSync(iconsDir).filter((f) => f.endsWith('.svg')).map((f) => resolve(iconsDir, f)),
    resolve(repo, 'website/assets/img/artha-logo.svg'),
    resolve(repo, 'website/assets/css/styles.css'),
    resolve(repo, 'website/index.html'),
    resolve(repo, 'website/404.html'),
  ];

  it.each(scanned.map((p) => [p.replace(repo + '/', ''), p]))('%s carries neither old teal', (_name, path) => {
    const text = readFileSync(path, 'utf8');
    for (const old of OLD) expect(text, String(old)).not.toMatch(old);
  });

  it('the website and the README point at a logo that exists', () => {
    expect(existsSync(resolve(repo, 'website/assets/img/artha-logo.svg'))).toBe(true);
    const readme = readFileSync(resolve(repo, 'README.md'), 'utf8');
    const ref = readme.match(/src="([^"]*artha-logo[^"]*)"/)?.[1];
    expect(ref).toBeTruthy();
    expect(existsSync(resolve(repo, ref as string))).toBe(true);
  });
});
