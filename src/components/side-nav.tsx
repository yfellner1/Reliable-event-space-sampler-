"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";

export type NavItem = { href: string; label: string; count?: number };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function Links({ items, onPick }: { items: NavItem[]; onPick?: () => void }) {
  const path = usePathname();
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {items.map((l) => {
        const active = isActive(path, l.href);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              onClick={onPick}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 font-semibold no-underline ${
                active ? "bg-brand text-brand-ink" : "text-ink hover:bg-soft"
              }`}
            >
              {l.label}
              {l.count ? (
                <span
                  className={`inline-block min-w-6 rounded-full px-1.5 text-center text-sm ${
                    active ? "bg-brand-ink text-brand" : "bg-accent text-bg"
                  }`}
                >
                  {l.count}
                  <span className="sr-only"> parties</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SignOut() {
  return (
    <form action="/logout" method="post">
      <button className="btn w-full" type="submit">
        Sign out
      </button>
    </form>
  );
}

type Props = { items: NavItem[]; orgName: string; userLine: string };

/** Left sidebar on wider screens; a drawer from the left on phones. */
export function SideNav({ items, orgName, userLine }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const attention = items.find((i) => i.href === "/attention")?.count ?? 0;

  // Close the drawer after moving to another page (adjusting state during
  // render, as React recommends), and on Escape.
  const [shownFor, setShownFor] = useState(path);
  if (shownFor !== path) {
    setShownFor(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const brand = (
    <div>
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <BrandMark name={orgName} size={40} />
        <span className="font-display block text-xl leading-tight font-bold text-brand">{orgName}</span>
      </Link>
      <span className="mt-1.5 block text-sm text-muted">{userLine}</span>
    </div>
  );

  return (
    <>
      {/* Phones: top bar with a menu button. */}
      <div className="mb-4 flex items-center justify-between gap-3 md:hidden print:hidden">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <BrandMark name={orgName} size={34} />
          <span className="font-display text-xl font-bold text-brand">{orgName}</span>
        </Link>
        <button
          type="button"
          className="btn"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden>☰</span> Menu
          {attention ? (
            <span className="inline-block min-w-6 rounded-full bg-accent px-1.5 text-center text-sm text-bg">
              {attention}
              <span className="sr-only"> need attention</span>
            </span>
          ) : null}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 h-full w-full cursor-default bg-black/45"
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-surface p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              {brand}
              <button type="button" className="btn h-11 w-11 p-0" aria-label="Close menu" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <Links items={items} onPick={() => setOpen(false)} />
            <div className="mt-auto">
              <SignOut />
            </div>
          </nav>
        </div>
      ) : null}

      {/* Wider screens: fixed left sidebar. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 py-5 md:block print:hidden">
        <nav aria-label="Main" className="flex h-full flex-col gap-6 overflow-y-auto">
          {brand}
          <Links items={items} />
          <div className="mt-auto">
            <SignOut />
          </div>
        </nav>
      </aside>
    </>
  );
}
