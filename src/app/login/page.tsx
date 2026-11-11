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
                Username or email address
                <input
                  type="text"
                  name="login"
                  required
                  autoComplete="username"
                  className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Password
                <input
                  type="password"
                  name="password"
                  required
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

            <form className="mt-4 grid gap-3" method="get">
              <label className="grid gap-1 text-sm font-medium text-ink">
                Sign-in code
                <input
                  type="text"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Six digits"
                  className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
              <button
                type="submit"
                className="rounded-pill border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas-subtle"
              >
                Use a sign-in code
              </button>
            </form>

            <p className="mt-4 text-sm text-ink-soft">
              <a href="/login" className="text-link hover:text-link-deep">
                Forgot your password?
              </a>
            </p>

            <ul className="mt-4 grid gap-2 border-t border-line pt-4 text-sm text-ink-soft">
              <li>
                Your ledger stays on your own machine. Nothing is uploaded, and this
                account only covers the web interface.
              </li>
              <li>
                Two-factor authentication and passkeys are set up after your first
                sign-in, from account settings.
              </li>
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter tone="light" compact />
    </div>
  );
}
