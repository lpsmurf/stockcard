"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { MockBadge } from "@/components/mock-badge";
import { usePortfolio } from "@/lib/portfolio";
import { formatPct, formatTokens, formatUsd } from "@/lib/risk";

const FILTERS = ["All", "Stocks", "Art", "Collect."] as const;

export default function PortfolioPage() {
  const { connected } = useWallet();
  const { data: assets, isLoading } = usePortfolio();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const list = (assets ?? []).filter((a) => {
    if (filter === "Stocks") return a.info.assetClass === "Equity";
    if (filter === "Art") return a.info.assetClass === "ArtNote";
    if (filter === "Collect.") return a.info.assetClass === "Collectible";
    return true;
  });
  const locked = (assets ?? []).reduce((s, a) => s + a.valueUsd6, 0n);
  const inWallet = (assets ?? []).reduce(
    (s, a) => s + (a.walletBalance * a.info.multiplierMicro * a.priceUsd6) / (10n ** BigInt(a.info.decimals) * 1_000_000n),
    0n,
  );

  return (
    <div className="mx-auto max-w-md md:max-w-2xl">
      <h1 className="font-display text-3xl">Assets</h1>
      <p className="mt-1 font-mono text-sm text-ink-3 tabular">
        Locked {formatUsd(locked)} · Wallet {formatUsd(inWallet)}
      </p>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Asset class filter">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-[44px] rounded-full px-4 text-sm ${filter === f ? "bg-brass-soft font-semibold text-brass" : "text-ink-2"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-rule rounded-xl bg-surface">
          {list.map((a) => (
            <li key={a.info.symbol}>
              <Link href={`/portfolio/${a.info.symbol}`} className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.info.symbol}</span>
                    <span className="rounded-full bg-plaster px-2 py-0.5 text-[11px] text-ink-2">
                      {a.info.assetClass === "ArtNote" ? "Art note" : a.info.assetClass}
                    </span>
                    <MockBadge />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-3">
                    {a.info.name} · {formatUsd(a.priceUsd6)} · {a.info.priceSource === "PartnerFmv" ? "Partner value" : a.info.priceSource === "Market" ? "Market price" : a.info.priceSource}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-2 tabular">
                    Locked {formatTokens(a.deposited, a.info.decimals)} · Wallet {formatTokens(a.walletBalance, a.info.decimals)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-ink-3">Max LTV {formatPct(BigInt(a.info.maxLtvBps))}</p>
                  <span className="mt-1 inline-block rounded-lg border border-rule px-3 py-1.5 text-sm text-ink">Deposit</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-2">
        <Link
          href="/shop"
          className="flex min-h-[48px] items-center justify-center rounded-xl border border-rule px-4 font-semibold text-ink"
        >
          Shop with test money
        </Link>
        {!connected ? <p className="text-center text-sm text-ink-3">Connect a wallet to deposit.</p> : null}
      </div>
    </div>
  );
}
