import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { automationSteps } from "@/lib/site";

export const metadata: Metadata = {
  title: "Artha Automation — import, reconcile and report on a schedule",
  description:
    "Artha runs scheduled imports, recurring entries, reconciliation and backups on your own server, and keeps a record of every run.",
};

const resources = [
  {
    title: "Scheduled imports",
    body: "Point a job at a folder or a mailbox. It parses each statement, matches it to the right account and files it, leaving anything unreadable for you.",
  },
  {
    title: "Recurring entries",
    body: "Rent, salaries, SIPs and subscriptions created ahead from a rule, then corrected when the real amount arrives.",
  },
  {
    title: "Reconciliation",
    body: "Bank lines are paired with the ledger and anything unpaired is reported. The job proposes matches; it does not silently accept them.",
  },
  {
    title: "Backups",
    body: "A copy of the database and the files it points to, written to your own disk, so a restore does not depend on a provider.",
  },
  {
    title: "Reports and alerts",
    body: "Monthly summaries and tax-year exports built beside your books. A failed run is reported as a failure, never as a success.",
  },
];

export default function ActionsPage() {
  return (
    <div className="bg-night text-night-ink">
      <SiteHeader tone="dark" />

      <main className="bg-night text-night-ink">
        <section className="bg-night-deep">
          <div className="mx-auto max-w-[1280px] px-4 py-10">
            <p className="text-2xs uppercase tracking-wide text-night-sky">
              Artha Automation
            </p>
            <h1 className="mt-3 max-w-[880px] text-h1-sm font-semibold tracking-tight md:text-h1-md lg:text-h1-lg">
              The repeat work runs on your own machine
            </h1>
            <p className="mt-5 max-w-[720px] text-lede text-night-soft">
              Scheduled imports, recurring entries, reconciliation and backups
              run on the server you installed and write to the ledger you own.
              Every run is recorded.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
              >
                Set up a job
              </Link>
              <Link
                href="/platform"
                className="rounded-pill border border-night-raise px-4 py-2 text-sm font-semibold text-night-ink hover:bg-night-raise"
              >
                See the platform
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-night-raise">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              How a job is set up
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {automationSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-md border border-night-raise bg-night-deep p-6"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-night-raise text-xs font-semibold text-night-mint">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-h3 font-semibold text-night-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base text-night-soft">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-night-raise bg-night-deep">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              What runs on a schedule
            </h2>
            <ul className="mt-8 divide-y divide-night-raise border-y border-night-raise">
              {resources.map((resource) => (
                <li
                  key={resource.title}
                  className="grid gap-2 py-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8"
                >
                  <h3 className="text-h2 font-semibold text-night-ink">
                    {resource.title}
                  </h3>
                  <p className="text-base text-night-soft">{resource.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

                <section className="border-t border-night-raise">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">What every run records</h2>
            <p className="mt-3 max-w-[720px] text-base text-night-soft">Each run records what it started, what changed and what it left for you.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-night-raise bg-night-deep p-6">
                <h3 className="text-h3 font-semibold text-night-ink">Started and finished</h3>
                <p className="mt-2 text-base text-night-soft">When it began, when it ended and how many lines it read.</p>
              </div>
              <div className="rounded-md border border-night-raise bg-night-deep p-6">
                <h3 className="text-h3 font-semibold text-night-ink">What changed, and what was refused</h3>
                <p className="mt-2 text-base text-night-soft">Entries it filed, matches it proposed and anything it could not read.</p>
              </div>
              <div className="rounded-md border border-night-raise bg-night-deep p-6">
                <h3 className="text-h3 font-semibold text-night-ink">Nothing posts itself</h3>
                <p className="mt-2 text-base text-night-soft">A run stops at a proposal. Posting an entry is still your call.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-night-raise bg-night-deep">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              What a job can watch
            </h2>
            <p className="mt-3 max-w-[720px] text-base text-night-soft">
              A job starts from something that changed, not from a button you have
              to remember to press.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              <li className="rounded-md border border-night-raise bg-night p-6">
                <h3 className="text-h3 font-semibold text-night-ink">A folder</h3>
                <p className="mt-2 text-base text-night-soft">
                  Statements dropped into a directory you choose, read once each and
                  filed against the account they belong to.
                </p>
              </li>
              <li className="rounded-md border border-night-raise bg-night p-6">
                <h3 className="text-h3 font-semibold text-night-ink">A mailbox</h3>
                <p className="mt-2 text-base text-night-soft">
                  Bank mail pulled from an account you control, with the attachment
                  kept beside the entries it produced.
                </p>
              </li>
              <li className="rounded-md border border-night-raise bg-night p-6">
                <h3 className="text-h3 font-semibold text-night-ink">A date</h3>
                <p className="mt-2 text-base text-night-soft">
                  The first of the month, the day a SIP falls due, the close of the
                  tax year. The schedule is written down, not remembered.
                </p>
              </li>
              <li className="rounded-md border border-night-raise bg-night p-6">
                <h3 className="text-h3 font-semibold text-night-ink">
                  A rule you wrote
                </h3>
                <p className="mt-2 text-base text-night-soft">
                  Any condition the ledger can answer, so the trigger is as specific
                  as the work it starts.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-night-raise">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              What a run will not do
            </h2>
            <p className="mt-3 max-w-[720px] text-base text-night-soft">
              Automation is worth having only if its limits are as clear as its
              abilities.
            </p>
            <ul className="mt-8 divide-y divide-night-raise border-y border-night-raise">
              <li className="grid gap-2 py-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8">
                <h3 className="text-base font-semibold text-night-ink">
                  Post a balance change on its own
                </h3>
                <p className="text-base text-night-soft">
                  Anything that moves a balance arrives as a proposal you accept or
                  discard. That includes matches it is confident about.
                </p>
              </li>
              <li className="grid gap-2 py-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8">
                <h3 className="text-base font-semibold text-night-ink">
                  Send your ledger anywhere
                </h3>
                <p className="text-base text-night-soft">
                  Credentials stay encrypted on your server and are never passed to
                  the copilot or to an outside service.
                </p>
              </li>
              <li className="grid gap-2 py-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8">
                <h3 className="text-base font-semibold text-night-ink">
                  Report a failure as a success
                </h3>
                <p className="text-base text-night-soft">
                  A statement it could not read is listed as unread. A run that
                  stopped says where it stopped.
                </p>
              </li>
              <li className="grid gap-2 py-5 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8">
                <h3 className="text-base font-semibold text-night-ink">
                  Guess at a missing price
                </h3>
                <p className="text-base text-night-soft">
                  If a valuation is unavailable, the figure is shown as unavailable
                  rather than filled in with an estimate.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-night-raise bg-night-deep">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              How to get one running
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-night-raise bg-night p-6">
                <p className="text-2xs uppercase tracking-wide text-night-sky">
                  Step one
                </p>
                <h3 className="mt-2 text-h3 font-semibold text-night-ink">
                  Run the stack
                </h3>
                <p className="mt-2 text-base text-night-soft">
                  The Docker compose file brings up the database, the web app and the
                  runner together.
                </p>
              </div>
              <div className="rounded-md border border-night-raise bg-night p-6">
                <p className="text-2xs uppercase tracking-wide text-night-sky">
                  Step two
                </p>
                <h3 className="mt-2 text-h3 font-semibold text-night-ink">
                  Import once by hand
                </h3>
                <p className="mt-2 text-base text-night-soft">
                  One statement, filed the way you want the rest filed, gives the
                  rules something to follow.
                </p>
              </div>
              <div className="rounded-md border border-night-raise bg-night p-6">
                <p className="text-2xs uppercase tracking-wide text-night-sky">
                  Step three
                </p>
                <h3 className="mt-2 text-h3 font-semibold text-night-ink">
                  Write the schedule
                </h3>
                <p className="mt-2 text-base text-night-soft">
                  Pick the folder, the mailbox or the date, and set what the job
                  should leave for you.
                </p>
              </div>
              <div className="rounded-md border border-night-raise bg-night p-6">
                <p className="text-2xs uppercase tracking-wide text-night-sky">
                  Step four
                </p>
                <h3 className="mt-2 text-h3 font-semibold text-night-ink">
                  Read the first run
                </h3>
                <p className="mt-2 text-base text-night-soft">
                  Its record tells you what it read, what it proposed and what it
                  could not understand.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-night-raise">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <div className="rounded-lg border border-night-raise bg-night-deep px-6 py-10 md:px-10 md:py-14">
              <h2 className="max-w-[640px] text-h2 font-semibold text-night-ink">
                Put the repeat work on a schedule
              </h2>
              <p className="mt-3 max-w-[640px] text-base text-night-soft">
                Imports, recurring entries and backups can all start running from
                your own instance. You still approve anything that changes a
                balance.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
                >
                  Create an account
                </Link>
                <Link
                  href="/platform"
                  className="rounded-pill border border-night-raise px-4 py-2 text-sm font-semibold text-night-ink hover:bg-night-raise"
                >
                  Explore the platform
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tone="dark" />
    </div>
  );
}
