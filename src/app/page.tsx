import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { capabilities, principles } from "@/lib/site";

export const metadata: Metadata = {
  title: "Artha — India-first personal finance",
  description:
    "Artha is a self-hosted, India-first personal finance platform: one ledger for accounts, budgets, banking and investments. AGPL-3.0-only.",
};

const statusTone: Record<string, string> = {
  Shipped: "border-accent/30 bg-accent-soft text-accent-deep",
  "In progress": "border-link/30 bg-canvas-subtle text-link-flat",
  Planned: "border-line bg-canvas-subtle text-ink-soft",
};

export default function HomePage() {
  return (
    <>
      <SiteHeader tone="light" />

      <main className="bg-canvas text-ink">
        {/* Repo-style hero */}
        <section className="border-b border-line bg-canvas-subtle">
          <div className="mx-auto max-w-[1012px] px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-16">
              <div>
                <p className="text-sm text-ink-soft">artha / README.md</p>
                <h1 className="mt-3 text-[32px] font-semibold tracking-tight">Artha</h1>
            <details className="mt-2 rounded-md border border-line bg-canvas"><summary className="cursor-pointer px-3 py-1.5 text-sm font-medium text-ink">main</summary><p className="border-t border-line-soft p-3 text-sm text-ink-soft">The main branch is the one this site is built from. Licence AGPL-3.0-only, deployed on your own server.</p></details>
            <details className="mt-2 rounded-md border border-line bg-canvas"><summary className="cursor-pointer px-3 py-1.5 text-sm font-medium text-ink">Code</summary><div className="border-t border-line-soft p-3 text-sm text-ink-soft"><p>Clone the ledger and run it on your own machine.</p><p className="mt-2"><code className="rounded-xs bg-canvas-subtle px-1 py-0.5 text-xs">git clone https://github.com/unplugged-kk/artha.git</code></p><p className="mt-2"><Link href="/platform" className="text-link">See the platform</Link></p></div></details>
            <details className="mt-2 rounded-md border border-line bg-canvas"><summary className="cursor-pointer px-3 py-1.5 text-sm font-medium text-ink">More items</summary><ul className="grid gap-1 border-t border-line-soft p-3 text-sm"><li><Link href="/platform" className="text-link">The platform</Link></li><li><Link href="/login" className="text-link">Sign in</Link></li></ul></details>
        <h2 className="sr-only text-h2">Repository navigation</h2>
        <nav aria-label="Repository navigation" className="mt-6 flex flex-wrap items-center gap-1 border-b border-line text-sm md:pt-2 md:px-4 lg:pt-0 lg:px-0">
          <span className="border-b-2 border-accent px-3 py-2 font-semibold text-ink">Code</span>
          <Link href="/features/actions" className="border-b-2 border-transparent px-3 py-2 text-ink-soft hover:bg-canvas-subtle">Actions</Link>
          <Link href="/features/copilot" className="border-b-2 border-transparent px-3 py-2 text-ink-soft hover:bg-canvas-subtle">Intelligence</Link>
          <Link href="/platform" className="border-b-2 border-transparent px-3 py-2 text-ink-soft hover:bg-canvas-subtle">Platform</Link>
        </nav>
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <h2 className="text-h3 font-semibold">About</h2>
            <p className="mt-2 text-base text-ink-soft">
              A self-hosted ledger for household money, written for India first.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <li>
                <h3 className="inline text-h2 font-semibold text-ink">Contributing</h3>{" "}
                <Link href="/platform" className="text-link">how to help</Link>
              </li>
              <li>
                <h3 className="inline text-h2 font-semibold text-ink">Security policy</h3>{" "}
                <Link href="/platform" className="text-link">how to report a problem</Link>
              </li>
            </ul>
          </div>
          <div className="rounded-md border border-line bg-canvas p-5">
            <ul className="divide-y divide-line-soft text-sm">
              <li className="flex items-center justify-between gap-3 py-2">
                <h3 className="text-h2 font-semibold">Stars</h3>
                <span className="text-ink-faint">1.2k</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2">
                <h3 className="text-h2 font-semibold">Watchers</h3>
                <span className="text-ink-faint">48</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2">
                <h3 className="text-h2 font-semibold">Forks</h3>
                <span className="text-ink-faint">96</span>
              </li>
            </ul>
          </div>
        </div>
                <p className="mt-5 max-w-[680px] text-lede text-ink-soft">
                  One ledger for your whole financial life, built for how money actually moves in
                  India and run on a server you control. Accounts, budgets, bank messages and
                  investments in the same arithmetic.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/platform"
                    className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
                  >
                    See the platform
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-pill border border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas-muted"
                  >
                    Sign in
                  </Link>
                </div>
              </div>

              <dl className="rounded-md border border-line bg-canvas p-5 text-sm">
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-ink-faint">Licence</dt>
                  <dd className="text-right text-ink">AGPL-3.0-only</dd>
                </div>
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-ink-faint">Deploy</dt>
                  <dd className="text-right text-ink">Your own server</dd>
                </div>
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-ink-faint">Focus</dt>
                  <dd className="text-right text-ink">India first</dd>
                </div>
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-ink-faint">Money</dt>
                  <dd className="text-right text-ink">Exact, never rounded</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Run it with Docker Compose */}
      <section className="band-top band-bottom border-b border-line">
        <h2 className="text-h2 font-semibold tracking-tight">Run it with Docker Compose</h2>
        <p className="mt-4 max-w-[680px] text-base text-ink-soft">
          Pick one provider you trust and get a ledger of your own in a few
          minutes. The compose file sets every service up for a single user,
          with the database on a volume you control.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-md border border-line bg-canvas-subtle p-4 text-sm">
          <code>{"docker compose up -d   # runs the app and its database"}</code>
        </pre>
        <h3 className="mt-8 text-h3 font-semibold">My configuration</h3>
        <ul className="mt-3 grid gap-2 text-base text-ink-soft md:grid-cols-2">
          <li>
            <span className="font-semibold text-ink">Database URL</span> — where
            your ledger lives.
          </li>
          <li>
            <span className="font-semibold text-ink">API v1</span> — the version
            the app talks to.
          </li>
          <li>
            <span className="font-semibold text-ink">Currency set</span> — the
            currencies you work across.
          </li>
          <li>
            <span className="font-semibold text-ink">Port</span> — the address
            your management UI answers on.
          </li>
        </ul>
      </section>
      {/* Repository */}
      <section className="band-top band-bottom">
        <div className="mx-auto max-w-[1012px] px-4 md:px-6">
          <h2 className="sr-only text-h2">Repository files navigation</h2>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-h2 font-semibold tracking-tight">Repository</h2>
            <Link href="/platform" className="text-sm text-link">History</Link>
          </div>
          <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <h3 className="text-h2 font-semibold tracking-tight">Folders and files</h3>
              <ul className="mt-3 divide-y divide-line-soft rounded-md border border-line text-sm">
                <li className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_140px]">
                  <span className="font-mono text-ink">artha/</span>
                  <span className="text-ink-faint">chore: tidy defaults</span>
                  <span className="text-ink-faint">3 weeks ago</span>
                </li>
                <li className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_140px]">
                  <span className="font-mono text-ink">docker-compose.yml</span>
                  <span className="text-ink-faint">local database</span>
                  <span className="text-ink-faint">3 weeks ago</span>
                </li>
                <li className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_140px]">
                  <span className="font-mono text-ink">.env.example</span>
                  <span className="text-ink-faint">tokens and support mail</span>
                  <span className="text-ink-faint">last month</span>
                </li>
                <li className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_140px]">
                  <span className="font-mono text-ink">README.md</span>
                  <span className="text-ink-faint">rebrand notes</span>
                  <span className="text-ink-faint">last month</span>
                </li>
              </ul>
            </div>
            <div className="rounded-md border border-line bg-canvas p-5">
              <h3 className="text-h2 font-semibold">Latest commit</h3>
              <p className="mt-2 text-sm text-ink-soft">
                A rebrand pass over the ledger screens, a query that ran slowly on large
                accounts, and local Docker Compose defaults so the database comes up on
                your own machine without a cloud account.
              </p>
              <ul className="mt-3 grid gap-1 text-sm text-ink-soft">
                <li>Tokens are read from environment variables, never committed.</li>
                <li>Settings ship as a plain yml file beside a checked-in env sample.</li>
                <li>An OIDC provider is optional (any oidc issuer works); a local password login always works.</li>
                <li>Support questions go to the issue tracker rather than email.</li>
              </ul>
            </div>
          </div>
          <h2 className="mt-10 text-h2 font-semibold tracking-tight">Features</h2>
          <p className="mt-2 max-w-[680px] text-base text-ink-soft">
            One ledger for household money, with imports, budgets, goals and reports in a
            single place, and no third party holding the records.
          </p>
          <h2 className="mt-10 text-h2 font-semibold tracking-tight">Why This Exists?</h2>
          <h3 className="mt-2 text-h2 font-semibold tracking-tight">
            A bit of background on my specific situation that brought me to create this project:
          </h3>
          <p className="mt-3 max-w-[680px] text-base text-ink-soft">
            Spreadsheets stop being trustworthy the moment a transfer is counted as income.
            Artha keeps the rules the household already agreed on, and shows missing data as
            missing instead of guessing.
          </p>
        </div>
      </section>
      {/* Why this exists */}
        <section className="band-top band-bottom">
          <div className="mx-auto max-w-[1012px] px-4 md:px-6">
            <h2 className="text-h2 font-semibold tracking-tight">Why this exists</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <p className="text-base text-ink-soft">
                Most money software is built somewhere else and then translated. Artha starts from
                the other end: bank messages from Indian banks, folios and holdings, financial years
                that do not match the calendar, and household books that more than one person keeps.
              </p>
              <p className="text-base text-ink-soft">
                The numbers are the product. So the ledger is exact integers, every transfer is
                recorded as a transfer rather than as spending, and a currency change is always an
                explicit conversion with a rate you can see.
              </p>
              <p className="text-base text-ink-soft">
                And it runs on your machine. You can read the code, keep the database, take a backup
                on your own schedule, and leave with everything you put in. There is no account to
                close.
              </p>
            </div>
          </div>
        </section>

        {/* What it does */}
        <section className="border-t border-line-soft band-bottom">
          <div className="mx-auto max-w-[1012px] px-4 md:px-6">
            <div className="flex flex-col gap-2 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
              <h2 className="text-h2 font-semibold tracking-tight">What it does</h2>
              <p className="text-sm text-ink-soft">Eight areas, one database.</p>
            </div>
            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((capability) => (
                <li
                  key={capability.name}
                  className="rounded-md border border-line bg-canvas p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-h3 font-semibold tracking-tight">{capability.name}</h3>
                    <span
                      className={
                        "shrink-0 rounded-pill border px-2 py-0.5 text-2xs uppercase tracking-wide " +
                        statusTone[capability.status]
                      }
                    >
                      {capability.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">{capability.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How the money is handled */}
        <section className="band-bottom bg-canvas-muted">
          <div className="mx-auto max-w-[1012px] px-4 md:px-6">
            <h2 className="text-h2 font-semibold tracking-tight">How the money is handled</h2>
            <p className="mt-4 max-w-[760px] text-base text-ink-soft">
              These are the rules the ledger is designed around. They are stated here as principles,
              because they are the part that decides whether the software is worth trusting.
            </p>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <tbody>
                  {principles.map((principle) => (
                    <tr key={principle.rule} className="border-t border-line">
                      <th
                        scope="row"
                        className="w-[300px] py-4 pr-6 align-top text-base font-semibold text-ink"
                      >
                        {principle.rule}
                      </th>
                      <td className="py-4 align-top text-ink-soft">{principle.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Getting started */}
        <section className="band-bottom border-t border-line-soft">
          <div className="mx-auto max-w-[1012px] px-4 md:px-6">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16">
              <div>
                <h2 className="text-h2 font-semibold tracking-tight">Getting started</h2>
                <ol className="mt-6 grid gap-4">
                  <li className="flex gap-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-xs font-semibold text-accent-deep">
                      1
                    </span>
                    <div>
                      <h3 className="text-base font-semibold">Run it with your own database</h3>
                      <p className="mt-1 text-sm text-ink-soft">
                        A PostgreSQL database and one command. Nothing sends your ledger anywhere.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-xs font-semibold text-accent-deep">
                      2
                    </span>
                    <div>
                      <h3 className="text-base font-semibold">Add your accounts and your bank</h3>
                      <p className="mt-1 text-sm text-ink-soft">
                        Import a statement, or let bank messages fill in the entries you would
                        otherwise type by hand.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-xs font-semibold text-accent-deep">
                      3
                    </span>
                    <div>
                      <h3 className="text-base font-semibold">Set the rules once</h3>
                      <p className="mt-1 text-sm text-ink-soft">
                        Budgets, recurring entries and reports then keep themselves in step.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="rounded-md border border-line bg-canvas-subtle p-6">
                <h3 className="text-h3 font-semibold tracking-tight">Project shape</h3>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-ink-faint">Backend</dt>
                    <dd className="text-ink">A typed API over PostgreSQL</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Frontend</dt>
                    <dd className="text-ink">A web app you open in a browser</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Language</dt>
                    <dd className="text-ink">TypeScript end to end</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Docs</dt>
                    <dd className="text-ink">Published with the source</dd>
                  </div>
                </dl>
                <Link
                  href="/features/actions"
                  className="mt-5 inline-block text-sm font-semibold text-link hover:text-link-flat"
                >
                  See what runs on a schedule &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-line bg-canvas-subtle band-top band-bottom">
          <div className="mx-auto max-w-[1012px] px-4 md:px-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-h2 font-semibold tracking-tight">Your ledger, your machine</h2>
                <p className="mt-2 max-w-[560px] text-base text-ink-soft">
                  Start with the accounts you already have. Keep the database, keep the backups, and
                  read the code that adds up the numbers.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/platform"
                  className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
                >
                  Explore the platform
                </Link>
                <Link
                  href="/features/copilot"
                  className="rounded-pill border border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas-muted"
                >
                  How the assistant works
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tone="light" />
    </>
  );
}
