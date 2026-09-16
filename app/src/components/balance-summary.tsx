"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useBalances, type Holding } from "@/lib/balances";
import { formatPct, formatTokens, formatUsd } from "@/lib/risk";

/** T076 — Home total balance panel: locked + wallet + card, stacked bar, wallet token disclosure. */
export function BalanceSummary() {
  const { connected } = useWallet();
  const { data, isLoading, error, refetch } = useBalances();

  if (!connected) {
    return (
      <section className="rounded-2xl bg-surface p-5">
        <p className="text-sm text-ink-3">Connect your wallet to see everything you hold.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl bg-surface p-5" aria-busy="true">
        <div className="h-3 w-24 animate-pulse rounded bg-raised" />
        <div className="mt-3 h-7 w-40 animate-pulse rounded bg-raised" />
        <div className="mt-4 space-y-2">
          <div className="h-4 animate-pulse rounded bg-raised" />
          <div className="h-4 animate-pulse rounded bg-raised" />
          <div className="h-4 animate-pulse rounded bg-raised" />
        </div>
        <div className="mt-4 h-1.5 animate-pulse rounded-full bg-raised" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl bg-surface p-5">
        <p className="text-sm text-ink-2">Couldn&apos;t load your balances.</p>
        <button
          onClick={() => void refetch()}
          className="mt-3 flex min-h-[44px] items-center rounded-lg border border-rule px-4 text-sm font-semibold text-ink"
        >
          Try again
        </button>
      </section>
    );
  }

  const { totals, debtOfTotalBps, wallet } = data;
  const total = totals.totalUsd6;
  const share = (v: bigint) => (total > 0n ? Number((v * 10_000n) / total) / 100 : 0);

  const rows: { label: string; value: bigint }[] = [
    { label: "Locked collateral", value: totals.lockedUsd6 },
    { label: "In wallet", value: totals.walletUsd6 },
    { label: "Card", value: totals.cardUsd6 },
  ];

  return (
    <section className="rounded-2xl bg-surface p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Total balance</p>
        <p className="font-mono text-xl tabular">{formatUsd(total)}</p>
      </div>

      <dl className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className="font-mono tabular">{formatUsd(r.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className="bg-brass" style={{ width: `${share(totals.lockedUsd6)}%` }} />
        <div className="bg-ink-3" style={{ width: `${share(totals.walletUsd6)}%` }} />
        <div className="bg-rule" style={{ width: `${share(totals.cardUsd6)}%` }} />
      </div>

      <p className="mt-3 text-sm text-ink-3">Debt is {formatPct(debtOfTotalBps)} of everything you hold</p>

      {wallet.length > 0 ? (
        <details className="group mt-3">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
            View wallet tokens
            <span aria-hidden="true" className="text-ink-3 transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <ul className="divide-y divide-rule">
            {wallet.map((h) => (
              <WalletTokenRow key={h.mint} holding={h} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function WalletTokenRow({ holding: h }: { holding: Holding }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{h.symbol}</p>
        <p className="font-mono text-xs tabular text-ink-3">{formatTokens(h.amount, h.decimals)}</p>
      </div>
      <div className="flex items-center gap-2">
        {h.priceUsd6 !== null ? <span className="font-mono tabular">{formatUsd(h.valueUsd6)}</span> : null}
        {h.priceUsd6 === null ? (
          <span className="rounded-full border border-rule px-2 py-0.5 text-[11px] text-ink-3">No price</span>
        ) : h.eligible ? (
          <>
            <span className="rounded-full border border-brass px-2 py-0.5 text-[11px] text-brass">Eligible</span>
            <Link href={`/portfolio/${h.symbol}?mode=deposit`} className="text-xs font-semibold text-brass">
              Lock
            </Link>
          </>
        ) : null}
      </div>
    </li>
  );
}
