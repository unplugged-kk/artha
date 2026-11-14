export type NavLink = {
  title: string;
  desc: string;
  href: string;
};

export type NavMenu = {
  label: string;
  href: string;
  links: NavLink[];
  aside: { eyebrow: string; title: string; href: string };
};

/**
 * The four header menus mirror the four menu labels captured in
 * capture/states/states.json (Products, Developers, Businesses, Resources).
 * Their link lists are Artha's own - the capture only recorded the labels.
 */
export const navMenus: NavMenu[] = [
  {
    label: "Products",
    href: "/platform",
    aside: {
      eyebrow: "New",
      title: "See the whole platform",
      href: "/platform",
    },
    links: [
      {
        title: "Platform",
        desc: "One ledger for accounts, budgets, investments and reports.",
        href: "/platform",
      },
      {
        title: "Copilot",
        desc: "Ask questions about your own money, in plain language.",
        href: "/features/copilot",
      },
      {
        title: "Actions",
        desc: "Scheduled runs that keep the books current while you sleep.",
        href: "/features/actions",
      },
      {
        title: "Accounts and transactions",
        desc: "Import bank and card statements, dedupe, and categorise.",
        href: "/",
      },
      {
        title: "Budgets and goals",
        desc: "Envelopes that reconcile against real spend, not guesses.",
        href: "/",
      },
      {
        title: "Investments and wealth",
        desc: "Folios, SIPs, holdings and allocation drift in one view.",
        href: "/",
      },
    ],
  },
  {
    label: "Developers",
    href: "/",
    aside: {
      eyebrow: "Open source",
      title: "AGPL-3.0-only, self-hosted",
      href: "/",
    },
    links: [
      {
        title: "Documentation",
        desc: "Set up Artha locally with Docker or a bare-metal stack.",
        href: "/",
      },
      {
        title: "API reference",
        desc: "The read and write surface the web app itself uses.",
        href: "/",
      },
      {
        title: "Data model",
        desc: "Accounts, entries, postings and how currencies attach.",
        href: "/",
      },
      {
        title: "Contributing",
        desc: "How changes are proposed, reviewed and merged by a human.",
        href: "/",
      },
    ],
  },
  {
    label: "Businesses",
    href: "/platform",
    aside: {
      eyebrow: "For teams",
      title: "Talk to us about a pilot",
      href: "/platform",
    },
    links: [
      {
        title: "Households",
        desc: "Shared books with per-member visibility and approvals.",
        href: "/platform",
      },
      {
        title: "Advisors",
        desc: "Many clients, separate ledgers, one operator console.",
        href: "/platform",
      },
      {
        title: "Finance teams",
        desc: "Reconciliation, exports and an audit trail that holds up.",
        href: "/platform",
      },
      {
        title: "Security and compliance",
        desc: "Self-hosted, no third-party data processor by default.",
        href: "/platform",
      },
    ],
  },
  {
    label: "Resources",
    href: "/",
    aside: {
      eyebrow: "Principles",
      title: "How we keep the numbers honest",
      href: "/",
    },
    links: [
      {
        title: "Why Artha exists",
        desc: "India-first personal finance, not a US app with a rupee sign.",
        href: "/",
      },
      {
        title: "Financial correctness",
        desc: "The rules every calculation in the product must obey.",
        href: "/",
      },
      {
        title: "Roadmap",
        desc: "What shipped, what is in progress, what is planned.",
        href: "/",
      },
      {
        title: "Community",
        desc: "Where build notes and design decisions are discussed.",
        href: "/",
      },
    ],
  },
];

export const mobileExtras: NavLink[] = [
  { title: "Sign in", desc: "", href: "/login" },
  { title: "Create an account", desc: "", href: "/login" },
  { title: "Platform", desc: "", href: "/platform" },
  { title: "Copilot", desc: "", href: "/features/copilot" },
  { title: "Actions", desc: "", href: "/features/actions" },
];

export const footerColumns = [
  {
    heading: "PRODUCT",
    links: [
      { title: "Platform", href: "/platform" },
      { title: "Copilot", href: "/features/copilot" },
      { title: "Actions", href: "/features/actions" },
      { title: "Accounts", href: "/" },
      { title: "Budgets and goals", href: "/" },
      { title: "Investments", href: "/" },
      { title: "Scheduled entries", href: "/features/actions" },
      { title: "Statements", href: "/" },
      { title: "Reconciliation", href: "/" },
      { title: "Multi-currency", href: "/" },
      { title: "Reports", href: "/" },
      { title: "Imports", href: "/" },
      { title: "Ledger export", href: "/" },
    ],
  },
  {
    heading: "PLATFORM",
    links: [
      { title: "Self-hosting", href: "/" },
      { title: "API reference", href: "/" },
      { title: "Data model", href: "/" },
      { title: "Scheduled transactions", href: "/features/actions" },
      { title: "Exports", href: "/" },
      { title: "Double-entry rules", href: "/" },
      { title: "Posting a journal", href: "/" },
      { title: "Closing a period", href: "/" },
      { title: "Backups", href: "/" },
      { title: "Migrations", href: "/" },
      { title: "Webhooks", href: "/" },
      { title: "Status", href: "/" },
    ],
  },
  {
    heading: "RESOURCES",
    links: [
      { title: "Why Artha exists", href: "/" },
      { title: "Financial correctness", href: "/" },
      { title: "Roadmap", href: "/" },
      { title: "Licence", href: "/" },
      { title: "Contributing", href: "/" },
      { title: "Getting started", href: "/" },
      { title: "Documentation", href: "/" },
      { title: "Ledger conventions", href: "/" },
      { title: "Community", href: "/" },
      { title: "Changelog", href: "/" },
      { title: "Support", href: "/" },
    ],
  },
  {
    heading: "COMPANY",
    links: [
      { title: "Security", href: "/" },
      { title: "Privacy", href: "/" },
      { title: "Terms", href: "/" },
      { title: "Contact", href: "/" },
      { title: "About", href: "/" },
      { title: "Brand", href: "/" },
      { title: "Governance", href: "/" },
      { title: "Trademark", href: "/" },
      { title: "Accessibility", href: "/" },
      { title: "Careers", href: "/" },
    ],
  },
];

export type Capability = {
  name: string;
  desc: string;
  status: "Shipped" | "In progress" | "Planned";
};

/** The eight capability areas are the substance of the product. */
export const capabilities: Capability[] = [
  {
    name: "Personal finance",
    desc: "Every account, in one ledger: cash flow, net worth and what is left over after the month.",
    status: "Shipped",
  },
  {
    name: "Budgeting and goals",
    desc: "Envelopes and saving targets that reconcile against real spend instead of an estimate.",
    status: "Shipped",
  },
  {
    name: "Banking and transaction intelligence",
    desc: "Statement import, duplicate detection, categories, and transfers recognised as transfers.",
    status: "Shipped",
  },
  {
    name: "Investments",
    desc: "Folders, folios, SIP schedules, holdings and returns for mutual funds, equities and deposits.",
    status: "In progress",
  },
  {
    name: "Wealth intelligence",
    desc: "Net worth over time, allocation drift and concentration, computed from the same ledger.",
    status: "In progress",
  },
  {
    name: "Watchlists",
    desc: "Instruments you follow, kept apart from anything you own, so tracking never moves a balance.",
    status: "Shipped",
  },
  {
    name: "Reports and dashboards",
    desc: "Monthly, quarterly and Indian tax-year views, with exports that match the screen.",
    status: "Shipped",
  },
  {
    name: "AI financial intelligence",
    desc: "A copilot that reads the ledger and answers with figures it can point at.",
    status: "Planned",
  },
];

export type Principle = {
  rule: string;
  meaning: string;
};

/** Financial-correctness rules, stated as product principles. */
export const principles: Principle[] = [
  {
    rule: "Money is never a floating-point number",
    meaning:
      "Amounts are stored as whole numbers in the currency's smallest unit, with the currency carried alongside. No rounding drift, ever.",
  },
  {
    rule: "A transfer is never income or expense",
    meaning:
      "Moving money between two of your own accounts changes both balances and nothing in the profit-and-loss view.",
  },
  {
    rule: "A voided entry has no effect",
    meaning:
      "Voiding keeps the record for the audit trail but removes every effect it had on balances, budgets and reports.",
  },
  {
    rule: "Currencies are never mixed without a rate",
    meaning:
      "Two currencies are only combined through a dated exchange rate that is shown next to the total.",
  },
  {
    rule: "Missing data is shown as missing",
    meaning:
      "If a price or balance is unavailable, the screen says so. Nothing is quietly estimated into a total.",
  },
];

export const plans = [
  {
    name: "Self-hosted",
    price: "Free",
    note: "AGPL-3.0-only, run it yourself",
    features: ["Full ledger", "Statement import", "Local backups"],
    cta: "Read the docs",
    featured: false,
  },
  {
    name: "Household",
    price: "₹149",
    per: "/month",
    note: "For families sharing books",
    features: ["Up to 5 members", "Shared budgets", "Approval on large entries"],
    cta: "Start free",
    featured: true,
  },
  {
    name: "Pro",
    price: "₹399",
    per: "/month",
    note: "For investors who want the detail",
    features: ["XIRR per holding", "Allocation drift", "Tax-year reports"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Business",
    price: "₹1,499",
    per: "/month",
    note: "For advisors and finance teams",
    features: ["Separate client ledgers", "Audit trail export", "Priority support"],
    cta: "Contact us",
    featured: false,
  },
];

export const faqs = [
  {
    q: "What is Artha Copilot?",
    a: "It is the assistant inside Artha. It reads the same ledger the screens read, so an answer about last month's spend is the same figure the report shows.",
  },
  {
    q: "Do I need to send my bank data anywhere?",
    a: "No. Artha is self-hosted and keeps statements and entries in your own database. The copilot answers from that database.",
  },
  {
    q: "Which currencies and formats does it handle?",
    a: "Any currency the bank states, kept apart until a dated exchange rate is applied. Indian statement formats and CSV imports are the first-class path.",
  },
  {
    q: "How do I get started?",
    a: "Run the Docker compose stack, import one statement, and the ledger, budgets and reports are usable the same evening.",
  },
  {
    q: "What does it cost?",
    a: "Self-hosting is free under AGPL-3.0-only. Paid plans add shared households, advisor consoles and support.",
  },
];

export const automationSteps = [
  {
    title: "Run on any event",
    desc: "A new statement, a scheduled date, or a rule you wrote yourself.",
  },
  {
    title: "Automation marketplace",
    desc: "Reusable recipes for recurring bills, SIPs, and month-end close.",
  },
  {
    title: "Secure store for credentials",
    desc: "Bank logins and API tokens stay encrypted and never reach the copilot.",
  },
];
