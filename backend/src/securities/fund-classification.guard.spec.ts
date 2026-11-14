import { readFileSync } from "fs";
import { join } from "path";
import { gitListFiles } from "../common/repo-tree.util";

/**
 * A fund's category is the string AMFI published, or absent -- never a guess.
 *
 * `docs/specs/fund-categories-and-comparison.md` INV-FUNDCAT-001. The failure
 * this guards against is specific and was the rejected upstream implementation:
 * classifying a fund from its *name* (`/hdfc/i` -> a fund house, `'flexi'` ->
 * Flexi Cap) or defaulting a missing classification to a plausible word such as
 * `'Equity'`. Both read as data and are inventions, and once written they make
 * every same-category comparison wrong with no way to tell which rows were
 * guessed.
 *
 * The scan matches *assignment shapes*, not reads: a later feature legitimately
 * reads `fundCategory` to group funds, and only writing one out of thin air is
 * the defect.
 */
const srcRoot = join(__dirname, "..");

/** Comments are stripped before matching, or prose explaining the ban trips it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (match, lead: string) => lead + " ".repeat(match.length - lead.length),
    );
}

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "a defaulted fund category (|| / ?? onto a literal)",
    pattern:
      /\b(?:fundCategory|fundHouse|fundSchemeType|schemeCategory|fund_category|fund_house)\b[^;\n]{0,80}?(?:\|\||\?\?)\s*(?:["'`]|$)/,
  },
  {
    label: "a literal assigned as a fund classification",
    pattern:
      /\b(?:fundCategory|fundHouse|fundSchemeType|fund_category|fund_house)\b\s*[:=]\s*["'`]/,
  },
  {
    label: "a classification derived from the scheme or security name",
    pattern:
      /\b(?:fundCategory|fundHouse|fund_category|fund_house)\b\s*[:=][^;\n]{0,120}?(?:schemeName|scheme_name|security\.name|security_name|\.symbol)\b/,
  },
];

function sourceFiles(): string[] {
  return gitListFiles(srcRoot)
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !file.endsWith(".spec.ts"))
    .filter((file) => !file.endsWith("fund-classification.guard.spec.ts"));
}

describe("a fund classification is captured, never guessed", () => {
  it("writes no fund classification from a default, a literal or a name", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = stripComments(readFileSync(join(srcRoot, file), "utf8"));
      for (const { label, pattern } of FORBIDDEN) {
        if (pattern.test(source)) offenders.push(`${file}: ${label}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the parser null for an absent field rather than an empty string", () => {
    // A behavioural anchor beside the scan: the one place a classification is
    // produced must answer `null`, which is what makes "Unclassified" honest.
    const source = readFileSync(
      join(srcRoot, "securities/providers/mfapi-payload.util.ts"),
      "utf8",
    );
    expect(source).toContain('return trimmed === "" ? null : trimmed;');
  });
});
