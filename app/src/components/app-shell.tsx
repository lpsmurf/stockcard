"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { MockBadge } from "./mock-badge";
import { usePortfolio } from "@/lib/portfolio";
import { alertBand } from "@/lib/risk";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/card", label: "Card" },
  { href: "/portfolio", label: "Assets" },
  { href: "/savings", label: "Savings" },
  { href: "/shop", label: "Shop" },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Home"],
  [/^\/card/, "Card"],
  [/^\/portfolio/, "Assets"],
  [/^\/cashback/, "Cashback"],
  [/^\/savings/, "Savings"],
  [/^\/shop/, "Demo shop"],
  [/^\/borrow/, "Borrow"],
  [/^\/admin/, "Admin"],
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { connected } = useWallet();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "StockCard";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
      {/* Desktop rail (only once connected — D1) */}
      {connected ? (
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
          <div className="mt-auto flex flex-col gap-2 px-3">
            <span className="inline-flex w-fit items-center rounded-full border border-brass px-2.5 py-0.5 text-[11px] font-semibold text-brass">Plus</span>
            <MockBadge label="Solana devnet" />
          </div>
        </nav>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-rule bg-plaster/90 px-4 backdrop-blur md:px-8">
          {/* Mobile: wordmark + connect */}
          <Link href="/" className="font-display text-xl md:hidden">StockCard</Link>
          <div className="md:hidden"><WalletPill compact /></div>

          {/* Desktop: title left, prices + bell + wallet right */}
          <h1 className="hidden text-xl font-semibold md:block">{title}</h1>
          <div className="hidden items-center gap-4 md:flex">
            <PriceFreshness />
            <AlertBell />
            <WalletPill />
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10">
          <div className="mx-auto w-full max-w-md md:max-w-xl lg:max-w-5xl">{children}</div>
        </main>
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

/** "Prices · 42 s ago" — warn color once the freshest signed price is older than 180 s. */
function PriceFreshness() {
  const { data: assets } = usePortfolio();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const times = (assets ?? []).map((a) => a.pricePublishTime).filter((t) => t > 0);
  if (times.length === 0) return null;
  const age = Math.max(0, Math.floor(Date.now() / 1000 - Math.max(...times)));
  const label = age < 90 ? `${age} s ago` : `${Math.floor(age / 60)} min ago`;
  return (
    <span className={`font-mono text-[11px] tabular ${age > 180 ? "text-warn" : "text-ink-3"}`}>Prices · {label}</span>
  );
}

/** Bell with a dot while any position is in warning/urgent/liquidatable band. */
function AlertBell() {
  const { data: assets } = usePortfolio();
  const active = (assets ?? []).some(
    (a) =>
      a.debt > 0n &&
      ["warning", "urgent", "liquidatable"].includes(
        alertBand(
          a.ltv,
          BigInt(a.info.maxLtvBps),
          BigInt(a.info.liqThresholdBps),
          a.info.assetClass === "Equity" ? "equity" : a.info.assetClass === "ArtNote" ? "artNote" : "collectible",
        ),
      ),
  );
  return (
    <Link href="/" aria-label={active ? "Alerts active — go to Home" : "No alerts"} className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {active ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-bad" aria-hidden="true" /> : null}
    </Link>
  );
}

/** Wallet pill: short address, menu with copy address / explorer / disconnect. */
function WalletPill({ compact = false }: { compact?: boolean }) {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  if (!publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="h-9 rounded-full bg-brass px-3.5 text-sm font-semibold text-on-brass hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const addr = publicKey.toBase58();
  const short = `${addr.slice(0, 4)}…${addr.slice(-4)}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-1 rounded-full border border-rule bg-raised px-3.5 font-mono text-sm text-ink-2 hover:border-brass"
      >
        {short} <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>
      {open ? (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} tabIndex={-1} />
          <div role="menu" className={`absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-rule bg-raised shadow-lg ${compact ? "" : ""}`}>
            <button
              role="menuitem"
              className="block w-full px-4 py-3 text-left text-sm hover:bg-surface"
              onClick={() => {
                void navigator.clipboard?.writeText(addr).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? "Copied ✓" : "Copy address"}
            </button>
            <a
              role="menuitem"
              className="block px-4 py-3 text-sm hover:bg-surface"
              href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              View on explorer ↗
            </a>
            <button
              role="menuitem"
              className="block w-full px-4 py-3 text-left text-sm text-bad hover:bg-surface"
              onClick={() => {
                setOpen(false);
                void disconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
