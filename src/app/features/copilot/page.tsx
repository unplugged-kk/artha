import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { plans, faqs } from "@/lib/site";

export const metadata: Metadata = {
  title: "Artha Intelligence — AI that reads the ledger, never invents it",
  description:
    "Artha Intelligence answers questions about your own ledger on your own server: it reads what is recorded, shows the working, and reports anything it cannot know as unavailable.",
};

const abilities = [
  {
    title: "Explains, does not invent",
    body: "Every answer is traced back to entries that already exist in your ledger. If the entries are not there, the answer says so instead of estimating.",
  },
  {
    title: "Answers with the working shown",
    body: "Each figure comes with the rows and the rule that produced it, so you can check the arithmetic yourself before you act on it.",
  },
  {
    title: "Stays out of the arithmetic",
    body: "Totals, balances and conversions are calculated by the ledger, not by the assistant. The assistant reads results; it never replaces them.",
  },
];

const stages = [
  {
    step: "Ask",
    body: "You ask in plain language, the way you would ask a person who keeps your books.",
  },
  {
    step: "Read",
    body: "The assistant reads only the records it needs, on your own server, and nothing leaves your instance.",
  },
  {
    step: "Show",
    body: "You get an answer, the entries behind it, and a clear note on anything that could not be answered.",
  },
];

export default function CopilotPage() {
  return (
    <div className="bg-night text-night-ink">
      <SiteHeader tone="dark" />
      <main className="bg-night text-night-ink">
        <section className="bg-night-deep">
          <div className="mx-auto max-w-[1280px] px-4">
            <p className="text-2xs uppercase tracking-wide text-night-mint">
              Artha Intelligence
            </p>
            <h1 className="mt-3 max-w-[900px] text-h1-sm font-semibold tracking-tight md:text-h1-md lg:text-h1-lg">
              An assistant that reads your ledger and never invents a number
            </h1>
            <p className="mt-5 max-w-[720px] text-lede text-night-soft">
              Ask about your spending, your budgets or your portfolio in plain
              language. The answer comes from the entries you actually
              recorded, on the machine you actually own.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
              >
                Try it on your data
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
              What it is good for
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {abilities.map((ability) => (
                <article
                  key={ability.title}
                  className="rounded-md border border-night-raise bg-night-deep p-6"
                >
                  <h3 className="text-h3 font-semibold text-night-ink">
                    {ability.title}
                  </h3>
                  <p className="mt-3 text-base text-night-soft">{ability.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-night-deep">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              From question to answer
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {stages.map((stage, index) => (
                <li
                  key={stage.step}
                  className="rounded-md border border-night-raise bg-night p-6"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-night-raise text-xs font-semibold text-night-mint">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-h3 font-semibold text-night-ink">
                    {stage.step}
                  </h3>
                  <p className="mt-3 text-base text-night-soft">{stage.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-[720px] text-base text-night-soft">
              Some questions have no answer in your ledger yet. When that
              happens the assistant says the data is unavailable and names what
              is missing, rather than filling the gap with a plausible number.
            </p>
          </div>
        </section>

        <section className="border-t border-night-raise">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              Pricing plans
            </h2>
            <p className="mt-2 text-base text-night-soft">
              Self-hosted is free forever. Paid plans cover hosting and support.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <li
                  key={plan.name}
                  className={
                    "flex flex-col rounded-md border bg-night-deep p-6 " +
                    ("featured" in plan && plan.featured
                      ? "border-night-mint"
                      : "border-night-raise")
                  }
                >
                  {"featured" in plan && plan.featured ? (
                    <span className="mb-3 inline-block w-fit rounded-pill bg-night-raise px-2 py-0.5 text-2xs uppercase tracking-wide text-night-mint">
                      Most chosen
                    </span>
                  ) : null}
                  <h3 className="text-h2 font-semibold text-night-ink">
                    {plan.name}
                  </h3>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="text-h2 font-semibold text-night-ink">
                      {plan.price}
                    </span>
                    <span className="text-sm text-night-soft">
                      {"per" in plan ? plan.per : ""}
                    </span>
                  </p>
                  <p className="mt-2 text-base text-night-soft">{plan.note}</p>
                  <ul className="mt-4 grid gap-2 text-base text-night-soft">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span aria-hidden="true" className="text-night-mint">
                          &bull;
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={
                      "mt-6 inline-block rounded-pill px-4 py-2 text-center text-sm font-semibold " +
                      ("featured" in plan && plan.featured
                        ? "bg-brand text-canvas hover:bg-accent-deep"
                        : "border border-night-raise text-night-ink hover:bg-night-raise")
                    }
                  >
                    {plan.cta}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-night-deep pt-12">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <h2 className="text-h2 font-semibold text-night-ink">
              Frequently asked questions
            </h2>
            <dl className="mt-8 divide-y divide-night-raise border-y border-night-raise">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="grid gap-2 py-5 md:grid-cols-[320px_minmax(0,1fr)] md:gap-8"
                >
                  <dt className="text-base font-semibold text-night-ink">
                    {faq.q}
                  </dt>
                  <dd className="text-base text-night-soft">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-night-raise">
          <div className="mx-auto max-w-[1280px] px-4 pb-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <h2 className="max-w-[560px] text-h2 font-semibold text-night-ink">
                Start with the ledger you already have
              </h2>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
                >
                  Create an account
                </Link>
                <Link
                  href="/features/actions"
                  className="rounded-pill border border-night-raise px-4 py-2 text-sm font-semibold text-night-ink hover:bg-night-raise"
                >
                  Automation
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
