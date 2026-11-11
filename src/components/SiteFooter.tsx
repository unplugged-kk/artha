import Link from "next/link";
import { footerColumns } from "@/lib/site";

type Tone = "light" | "dark";

/**
 * Site footer. Two frames are in use, and which one applies depends on the
 * shell rather than on the colour:
 *
 *  - the ledger shell (start page): the <footer> itself carries the insets
 *    (48 top / 40 bottom; 16 sides, widening to 40 at the 768 px
 *    breakpoint), the inner wrapper limits the width to 1012 px, and the
 *    columns run one per row.
 *  - the product shell (/platform and the two feature routes): the <footer>
 *    carries no padding at all, the inner wrapper holds those same insets,
 *    widens the content column to 1280 px, and the columns run two across,
 *    becoming four at 1024 px.
 *
 * The product routes get the wide frame from their tone; /platform is light
 * but still uses it, so it passes `wide`.
 */
export default function SiteFooter({
  tone = "light",
  wide,
  compact,
}: {
  tone?: Tone;
  wide?: boolean;
  /**
   * For screens that are a task rather than a landing page (/login). The
   * reference sign-in screen is a short centred form with a legal line under
   * it, not a full site nav, and carrying the four link columns there made the
   * page about 80% taller than it had any reason to be.
   */
  compact?: boolean;
}) {
  const dark = tone === "dark";
  const isWide = wide ?? dark;

  const shell = dark
    ? "border-night-raise bg-night-deep text-night-soft"
    : "border-line bg-canvas-muted text-ink-soft";
  const heading = dark ? "text-night-ink" : "text-ink";
  const linkClass = dark ? "hover:text-night-ink" : "hover:text-ink";
  const rule = dark ? "border-night-raise" : "border-line";

  const frame =
    "border-t " + (isWide ? shell : "px-4 pt-12 pb-10 md:px-10 lg:px-4 " + shell);
  const inner = isWide
    ? "mx-auto max-w-[1280px] px-4 pt-12 pb-10 md:px-10"
    : "mx-auto max-w-[1012px]";
  const columns = isWide
    ? "mt-6 grid grid-cols-2 gap-8 lg:grid-cols-4"
    : "mt-6 grid gap-8";

  if (compact) {
    return (
      <footer className={frame}>
        <div className={inner}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <p>Artha is India-first personal finance. Self-hosted, AGPL-3.0-only.</p>
            <p>Built in the open. You keep the ledger.</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={frame}>
      <div className={inner}>
        <h2 className={"text-base uppercase tracking-wide " + heading}>
          Site-wide Links
        </h2>
        <div className={columns}>
          {footerColumns.map((column) => (
            <div key={column.heading}>
              <h3 className={"text-base uppercase tracking-wide " + heading}>
                {column.heading}
              </h3>
              <ul className="mt-3 grid gap-2">
                {column.links.map((link) => (
                  <li key={link.title}>
                    <Link href={link.href} className={"text-sm " + linkClass}>
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={"mt-10 border-t pt-6 text-xs " + rule}>
          <p>
            Artha is India-first personal finance. Self-hosted, AGPL-3.0-only.
          </p>
          <p className="mt-1">Built in the open. You keep the ledger.</p>
        </div>
      </div>
    </footer>
  );
}
