"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConnectButton } from "./connect-button";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/card", label: "Card" },
  { href: "/portfolio", label: "Assets" },
  { href: "/savings", label: "Savings" },
  { href: "/shop", label: "Shop" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      {/* Desktop rail */}
      <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-rule px-4 py-6 md:flex">
        <Link href="/" className="mb-6 px-3 font-display text-2xl">StockCard</Link>
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-[15px] ${isActive(t.href) ? "bg-brass-soft font-semibold text-ink" : "text-ink-2 hover:bg-surface"}`}
          >
            {t.label}
          </Link>
        ))}
        <p className="mt-auto px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">Solana devnet</p>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rule bg-plaster/90 px-4 py-3 backdrop-blur md:px-8">
          <Link href="/" className="font-display text-xl md:hidden">StockCard</Link>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 md:inline">Real assets only · no memecoins</span>
          <ConnectButton />
        </header>
        <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10">{children}</main>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-rule bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={`flex h-14 items-center justify-center text-[13px] ${isActive(t.href) ? "font-semibold text-brass" : "text-ink-2"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
