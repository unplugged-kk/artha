// The original page asked for "Mona Sans" / "Mona Sans VF" in its font stack.
// Those are not Google fonts and were not shipped in the capture (0 font files
// on the root and sign-in pages, 2 on each product page), so they are replaced
// here with Inter, exposed as --font-artha-sans, which globals.css already puts
// first in --font-sans.
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const arthaSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-artha-sans",
});

export const metadata: Metadata = {
  title: "Artha — India-first personal finance",
  description:
    "Artha is a self-hosted, India-first personal finance platform: one ledger for accounts, budgets, banking and investments. AGPL-3.0-only.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={arthaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
