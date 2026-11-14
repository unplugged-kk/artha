import Link from "next/link";
import { capabilities, principles } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function PlatformPage() {
  return (
    <div className="bg-canvas text-ink">
      <SiteHeader tone="light" />
      <main>
      <section className="border-b border-line bg-canvas-subtle">
        <div className="mx-auto max-w-[1280px] px-4 pt-16 pb-14 md:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
        <h1 className="text-h1-sm font-semibold tracking-tight md:text-h1-md lg:text-h1-lg">
          The platform
        </h1>
        <p className="mt-4 max-w-[680px] text-base text-ink-soft">
          One ledger for accounts, budgets, banking and investments, run on
          your own machine.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
        >
          Start a ledger
        </Link>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-canvas p-5">
            <dt className="text-2xs uppercase tracking-wide text-ink-faint">
              Where it runs
            </dt>
            <dd className="mt-2 text-sm text-ink-soft">
              On a machine you control, with the database beside it.
            </dd>
          </div>
          <div className="rounded-md border border-line bg-canvas p-5">
            <dt className="text-2xs uppercase tracking-wide text-ink-faint">
              What it keeps
            </dt>
            <dd className="mt-2 text-sm text-ink-soft">
              Every entry, with the statement it came from still attached.
            </dd>
          </div>
          <div className="rounded-md border border-line bg-canvas p-5">
            <dt className="text-2xs uppercase tracking-wide text-ink-faint">
              Who can read it
            </dt>
            <dd className="mt-2 text-sm text-ink-soft">
              Only the accounts you create. Nothing leaves the server.
            </dd>
          </div>
          <div className="rounded-md border border-line bg-canvas p-5">
            <dt className="text-2xs uppercase tracking-wide text-ink-faint">
              What it costs
            </dt>
            <dd className="mt-2 text-sm text-ink-soft">
              Nothing to run. The source is open under AGPL-3.0-only.
            </dd>
          </div>
        </dl>
        </div>
        </div>
      </section>

      <section className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-6 lg:px-8">
          <header className="p-6">
            <h2 className="text-h2 font-semibold tracking-tight">Keep the work around your ledger connected</h2>
            <p className="mt-3 max-w-[680px] text-base text-ink-soft">
              Accounts, transactions, budgets and reports all read from the same
              ledger, so a correction in one place is the same correction everywhere
              else.
            </p>
          </header>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">One ledger, every account</h3>
              <p className="mt-2 text-sm text-ink-soft">
                Bank, cash, card and wallet balances sit in one place, each with its
                own currency and its own running total.
              </p>
            </div>
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">Every figure traceable</h3>
              <p className="mt-2 text-sm text-ink-soft">
                Any balance can be traced back to the entries that produced it, so a
                number on a report is never a guess.
              </p>
            </div>
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">Nothing changed by surprise</h3>
              <p className="mt-2 text-sm text-ink-soft">
                A voided entry keeps its place and changes no total. You approve what
                moves, and you can always see what did not.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-6 lg:px-8">
          <header className="p-6">
            <h2 className="text-h2 font-semibold tracking-tight">Accounts</h2>
            <p className="mt-3 max-w-[680px] text-base text-ink-soft">
              One home for everything you hold, described the way you actually hold
              it.
            </p>
          </header>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">Bank, cash and card</h3>
              <p className="mt-2 text-sm text-ink-soft">
                Add a bank account, a cash box or a card, and give each one the
                currency it is really kept in.
              </p>
            </div>
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">Transfers stay transfers</h3>
              <p className="mt-2 text-sm text-ink-soft">
                Moving money between your own accounts is never counted as income or
                as spending, so your totals stay honest.
              </p>
            </div>
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">Unavailable stays unavailable</h3>
              <p className="mt-2 text-sm text-ink-soft">
                If a balance cannot be known, the ledger says so instead of showing
                a zero you might trust.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-canvas-subtle">
        <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-6 lg:px-8">
          <header className="p-6">
            <h2 className="text-h2 font-semibold tracking-tight">
              What the ledger covers
            </h2>
            <p className="mt-3 max-w-[680px] text-base text-ink-soft">
              Eight areas of personal finance, each reading from the same set of
              entries, and each saying plainly whether it is finished.
            </p>
          </header>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {capabilities.map((capability) => (
              <div
                key={capability.name}
                className="rounded-md border border-line bg-canvas p-6"
              >
                <h3 className="text-h3 font-semibold">{capability.name}</h3>
                <p className="mt-2 text-sm text-ink-soft">{capability.desc}</p>
                <p className="mt-3 text-2xs uppercase tracking-wide text-ink-faint">
                  {capability.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-6 lg:px-8">
          <header className="p-6">
            <h2 className="text-h2 font-semibold tracking-tight">
              The rules every number obeys
            </h2>
            <p className="mt-3 max-w-[680px] text-base text-ink-soft">
              These are not aspirations. Each one is a property the ledger is
              built to hold, and the reason a figure on a report can be trusted.
            </p>
          </header>
          <ol className="mt-8 grid gap-4">
            {principles.map((principle, index) => (
              <li
                key={principle.rule}
                className="rounded-md border border-line bg-canvas p-6"
              >
                <h3 className="text-h3 font-semibold">
                  {index + 1}. {principle.rule}
                </h3>
                <p className="mt-2 text-sm text-ink-soft">{principle.meaning}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line bg-canvas-subtle">
        <div className="mx-auto max-w-[789px] px-4 py-14 md:max-w-[789px] md:px-6 lg:max-w-[1296px] lg:px-8">
          <header className="p-6">
            <h2 className="text-h2 font-semibold tracking-tight">
              Where to go next
            </h2>
            <p className="mt-3 max-w-[680px] text-base text-ink-soft">
              The platform is the wide view. Two features show how the day-to-day
              work is actually done.
            </p>
          </header>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">Ask the copilot</h3>
              <p className="mt-2 text-sm text-ink-soft">
                Questions about your own money answered from the same ledger the
                screens read, with the figures it used shown alongside.
              </p>
              <Link
                href="/features/copilot"
                className="mt-4 inline-block text-sm font-semibold text-link hover:text-link-deep"
              >
                See the copilot
              </Link>
            </div>
            <div className="rounded-md border border-line bg-canvas p-6">
              <h3 className="text-h3 font-semibold">Let the work run itself</h3>
              <p className="mt-2 text-sm text-ink-soft">
                Imports, recurring entries and month-end close, run on a schedule
                you set and recorded every time.
              </p>
              <Link
                href="/features/actions"
                className="mt-4 inline-block text-sm font-semibold text-link hover:text-link-deep"
              >
                See automation
              </Link>
            </div>
          </div>
        </div>
      </section>

      </main>
      <SiteFooter tone="light" wide />
    </div>
  );
}
