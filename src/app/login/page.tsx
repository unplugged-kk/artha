import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

/**
 * Sign-in screen. The reference capture was another product login form, so this
 * keeps only the layout idea: one narrow centred card on a tinted page with a
 * single primary action. None of that product copy, branding or markup is here.
 */
export const metadata: Metadata = {
  title: "Sign in — Artha",
  description: "Sign in to your self-hosted Artha ledger.",
};

export default function LoginPage() {
  return (
    <div className="bg-canvas-subtle text-ink">
      <SiteHeader tone="light" />
      <main className="bg-canvas-subtle text-ink">
        <div className="mx-auto max-w-[420px] px-4 py-16">
          <div className="rounded-md border border-line bg-canvas p-6">
            <h1 className="text-h3 font-semibold tracking-tight">
              Sign in to Artha
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Your ledger stays on your machine. Sign in to pick up where you left
              off.
            </p>
            <form className="mt-6 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-ink">
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:bg-accent-deep"
              >
                Sign in
              </button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter tone="light" />
    </div>
  );
}
