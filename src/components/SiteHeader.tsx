"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { navMenus, mobileExtras } from "@/lib/site";

type Tone = "light" | "dark";

export default function SiteHeader({ tone = "light" }: { tone?: Tone }) {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!barRef.current) return;
      if (barRef.current.contains(event.target as Node)) return;
      setOpenMenu(null);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  const dark = tone === "dark";
  const barClass = dark
    ? "border-night-raise bg-night text-night-ink"
    : "border-line bg-canvas text-ink";
  const navButtonClass = dark
    ? "rounded-sm px-2 py-1 text-sm text-night-soft hover:text-night-ink"
    : "rounded-sm px-2 py-1 text-sm text-ink-soft hover:text-ink";
  const secondaryLinkClass = dark
    ? "hidden rounded-pill border border-night-raise px-3 py-1 text-sm text-night-ink hover:bg-night-raise md:inline-block"
    : "hidden rounded-pill border border-line px-3 py-1 text-sm text-ink hover:bg-canvas-subtle md:inline-block";

  return (
    <header className={"sticky top-0 z-50 border-b " + barClass}>
      <h2 className="sr-only text-h2">Navigation Menu</h2>
      <div ref={barRef} className="mx-auto max-w-[1012px] px-4 lg:px-8">
        <div className="flex h-16 items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm py-1 text-base font-semibold"
            onClick={() => {
              setOpenMenu(null);
              setMobileOpen(false);
            }}
          >
            <span
              aria-hidden="true"
              className={
                "flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold " +
                (dark ? "bg-night-raise text-night-mint" : "bg-accent-soft text-accent-deep")
              }
            >
              A
            </span>
            <span>Artha</span>
          </Link>

          <nav aria-label="Primary" className="hidden md:flex md:items-center md:gap-1">
            {navMenus.map((menu, index) => {
              const isOpen = openMenu === index;
              return (
                <div key={menu.label} className="relative">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onClick={() => setOpenMenu(isOpen ? null : index)}
                    className={navButtonClass + (isOpen ? " font-semibold" : "")}
                  >
                    {menu.label}
                  </button>
                  {isOpen ? (
                    <div
                      className={
                        "absolute left-0 top-full mt-2 w-[660px] rounded-lg border p-4 " +
                        (dark
                          ? "border-night-raise bg-night-deep text-night-ink"
                          : "border-line bg-canvas text-ink")
                      }
                    >
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                        <ul className="grid gap-1">
                          {menu.links.map((link) => (
                            <li key={link.title}>
                              <Link
                                href={link.href}
                                onClick={() => setOpenMenu(null)}
                                className={
                                  "block rounded-md px-2 py-2 " +
                                  (dark ? "hover:bg-night-raise" : "hover:bg-canvas-subtle")
                                }
                              >
                                <span className="block text-sm font-semibold">{link.title}</span>
                                <span
                                  className={
                                    "block text-xs " +
                                    (dark ? "text-night-soft" : "text-ink-soft")
                                  }
                                >
                                  {link.desc}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <div
                          className={
                            "rounded-md border p-3 " +
                            (dark
                              ? "border-night-raise bg-night"
                              : "border-line-soft bg-canvas-subtle")
                          }
                        >
                          <p
                            className={
                              "text-2xs uppercase tracking-wide " +
                              (dark ? "text-night-mint" : "text-accent-deep")
                            }
                          >
                            {menu.aside.eyebrow}
                          </p>
                          <Link
                            href={menu.aside.href}
                            onClick={() => setOpenMenu(null)}
                            className="mt-1 block text-sm font-semibold"
                          >
                            {menu.aside.title}
                            <span aria-hidden="true" className="ml-1">
                              &rarr;
                            </span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className={secondaryLinkClass}>
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-pill bg-accent px-3 py-1 text-sm font-semibold text-canvas hover:bg-accent-deep"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-20 md:hidden">
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className={
            "cursor-pointer rounded-sm border px-3 py-1 text-sm " +
            (dark ? "border-night-raise text-night-ink" : "border-line text-ink")
          }
        >
          Menu
        </button>
        <div
          hidden={!mobileOpen}
          className={
            "absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-md border shadow-lg " +
            (dark ? "border-night-raise bg-night-deep" : "border-line bg-canvas")
          }
        >
          <div className="mx-auto max-w-[1012px] px-4 py-4">
            <ul className="grid gap-1">
              {mobileExtras.map((link) => (
                <li key={link.title}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={
                      "block rounded-md px-2 py-2 text-sm font-semibold " +
                      (dark ? "hover:bg-night-raise" : "hover:bg-canvas-subtle")
                    }
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
            <div
              className={"my-3 border-t " + (dark ? "border-night-raise" : "border-line-soft")}
            />
            {navMenus.map((menu) => (
              <div key={menu.label} className="py-2">
                <p
                  className={
                    "text-2xs uppercase tracking-wide " +
                    (dark ? "text-night-soft" : "text-ink-faint")
                  }
                >
                  {menu.label}
                </p>
                <ul className="mt-1 grid gap-1">
                  {menu.links.map((link) => (
                    <li key={link.title}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={
                          "block rounded-md px-2 py-1 text-sm " +
                          (dark ? "hover:bg-night-raise" : "hover:bg-canvas-subtle")
                        }
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>
      </div>
    </header>
  );
}
