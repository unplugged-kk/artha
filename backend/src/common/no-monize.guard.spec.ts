import { readFileSync } from "fs";
import { join } from "path";

import { findRepoRoot, gitListFiles, requireRepoRoot } from "./repo-tree.util";

/**
 * The Artha de-branding, enforced.
 *
 * The product was forked from Monize and the name leaked into prose, comments,
 * configuration identifiers, database roles and wire formats. Every one of those
 * has been renamed to Artha; this guard is what keeps a future edit from
 * quietly reintroducing it.
 *
 * A rule in prose gets read, agreed with and violated anyway (`docs/adr/0002`:
 * "prefer a scanning test wherever the mistake is mechanical"), so the rule is a
 * test rather than a paragraph. The inventory comes from `git ls-files`, so the
 * guard sees exactly the tree CI sees.
 *
 * Three classes of file may still name the upstream project, each for a reason
 * that is a decision rather than an oversight:
 *
 *  - `LICENSE` -- the AGPL-3.0-only text and upstream copyright notices must be
 *    retained verbatim.
 *  - the `README.md` provenance line -- the fork's attribution, required by the
 *    licence and useful to a reader.
 *  - `docs/release-notes/**` and `docs/audits/**` -- shipped historical records;
 *    editing them to match a later tree would falsify what shipped when.
 */

const REPO_ROOT = findRepoRoot(__dirname);

const describeTree = REPO_ROOT || process.env.CI ? describe : describe.skip;

/**
 * `monize` as a standalone token: a letter may not touch it on either side, so
 * `monize`, `monize_user`, `monize-network` and `X-Monize-Share-Name` all match
 * while an ordinary word that merely contains the letters (`economize`) does not.
 */
const BANNED = /(?<![A-Za-z])monize(?![A-Za-z])/i;

/** Exact paths that may name the upstream project, each with its reason. */
const EXEMPT_FILES: ReadonlyArray<[path: string, reason: string]> = [
  ["LICENSE", "AGPL-3.0-only text; upstream copyright notices retained verbatim"],
  ["README.md", "the provenance line records the upstream fork (attribution)"],
  [
    "backend/src/common/no-monize.guard.spec.ts",
    "this guard names the token it bans",
  ],
];

/** Path prefixes that may name the upstream project, each with its reason. */
const EXEMPT_PREFIXES: ReadonlyArray<[prefix: string, reason: string]> = [
  ["docs/release-notes/", "shipped release history; rewriting it falsifies it"],
  ["docs/audits/", "historical audit records; rewriting them falsifies them"],
];

function exempt(path: string): boolean {
  return (
    EXEMPT_FILES.some(([p]) => p === path) ||
    EXEMPT_PREFIXES.some(([p]) => path.startsWith(p))
  );
}

/** The lines of one file that still name the upstream project. */
function offenders(path: string, text: string): string[] {
  const lines = text.split("\n");
  // README keeps one allowed sentence: the provenance line carrying the fork's
  // attribution. Every other line is still held to the rule.
  const scannable =
    path === "README.md" ? lines.filter((line) => !line.includes("fork of")) : lines;
  const found: string[] = [];
  scannable.forEach((line) => {
    if (BANNED.test(line)) found.push(`${path}: ${line.trim().slice(0, 140)}`);
  });
  return found;
}

describeTree("the repository does not name the upstream project", () => {
  const scan = (): { files: number; found: string[] } => {
    const root = requireRepoRoot(REPO_ROOT);
    const files = gitListFiles(root).filter((f) => !exempt(f));
    const found: string[] = [];
    for (const file of files) {
      let text: string;
      try {
        text = readFileSync(join(root, file), "utf8");
      } catch {
        continue; // binary or unreadable: nothing to brand
      }
      found.push(...offenders(file, text));
    }
    return { files: files.length, found };
  };

  it("scans the tracked tree it claims to scan", () => {
    // A broken inventory would make the assertion below vacuous.
    const { files } = scan();
    expect(files).toBeGreaterThan(500);
  });

  it("has no 'monize' token outside the exempt licence, provenance and history", () => {
    const { found } = scan();
    expect(found).toEqual([]);
  });
});
