import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A Getting Started step that names a settings destination is a promise about
// the settings page. Rename the section id, or move the route, and the link
// still renders and still navigates -- to the top of the page, or a 404. Nothing
// else fails, so this does.
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('Getting Started settings destinations', () => {
  const card = read('src/components/dashboard/GettingStarted.tsx');
  const settings = read('src/app/settings/page.tsx');

  it('links to exactly the destinations this guard knows', () => {
    const hrefs = [...card.matchAll(/href: '(\/settings[^']*)'/g)].map((m) => m[1]);
    expect(hrefs.sort()).toEqual(['/settings', '/settings#notifications', '/settings/ai']);
  });

  it('the AI step goes to a route that exists', () => {
    expect(existsSync(join(process.cwd(), 'src/app/settings/ai/page.tsx'))).toBe(true);
  });

  it('the notifications step names a section the settings page renders', () => {
    expect(settings).toContain('id="notifications"');
  });

  it('arriving on a hash is handled by the scroll-spy hook the settings page uses', () => {
    expect(settings).toContain('useScrollSpy');
    expect(read('src/hooks/useScrollSpy.ts')).toMatch(/window\.location\.hash/);
  });
});
