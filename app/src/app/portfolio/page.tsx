"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { MockBadge } from "@/components/mock-badge";
import { PriceChart } from "@/components/price-chart";
import { usePortfolio, totals } from "@/lib/portfolio";
import { formatPct, formatTokens, formatUsd } from "@/lib/risk";

const FILTERS = ["All", "Stocks", "Art", "Collect."] as const;

export default function PortfolioPage() {
  const { connected } = useWallet();
  const { data: assets, isLoading } = usePortfolio();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selSymbol, setSelSymbol] = useState<string | null>(null);
  const router = useRouter();

  const list = (assets ?? []).filter((a) => {
    if (filter === "Stocks") return a.info.assetClass === "Equity";
    if (filter === "Art") return a.info.assetClass === "ArtNote";
    if (filter === "Collect.") return a.info.assetClass === "Collectible";
    return true;
  });
  const selected = list.find((a) => a.info.symbol === selSymbol) ?? list[0];

  function moveSelection(delta: number) {
    if (list.length === 0) return;
    const idx = selected ? list.indexOf(selected) : 0;
    const next = Math.max(0, Math.min(list.length - 1, idx + delta));
    setSelSymbol(list[next].info.symbol);
  }
  const locked = (assets ?? []).reduce((s, a) => s + a.valueUsd6, 0n);
  const creditLine = totals(assets ?? []).creditLineUsd6;
  const inWallet = (assets ?? []).reduce(
    (s, a) => s + (a.walletBalance * a.info.multiplierMicro * a.priceUsd6) / (10n ** BigInt(a.info.decimals) * 1_000_000n),
    0n,
  );

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl md:hidden">Assets</h1>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface p-4 md:grid-cols-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Locked</p>
          <p className="mt-1 font-mono text-lg tabular">{formatUsd(locked)}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">In wallet</p>
          <p className="mt-1 font-mono text-lg tabular">{formatUsd(inWallet)}</p>
        </div>
        <div className="max-md:hidden">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Credit line</p>
          <p className="mt-1 font-mono text-lg tabular">{formatUsd(creditLine)}</p>
        </div>
      </div>

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
        <>
          {/* Mobile: card list */}
          <ul className="mt-4 divide-y divide-rule rounded-xl bg-surface md:hidden">
            {list.map((a) => (
              <li key={a.info.symbol}>
                <Link href={`/portfolio/${a.info.symbol}`} className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.info.symbol}</span>
                      <span className="rounded-full bg-plaster px-2 py-0.5 text-[11px] text-ink-2">
                        {a.info.assetClass === "ArtNote" ? "Art note" : a.info.assetClass}
                      </span>
                      {a.info.preIpo ? (
                        <span className="rounded-full bg-brass-soft px-2 py-0.5 text-[11px] font-medium text-brass">
                          {a.info.preIpo.label} · {a.info.preIpo.provider === "tessera" ? "Tessera" : "PreStocks"}
                        </span>
                      ) : null}
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

          {/* Desktop: table + selected-asset panel */}
          <div className="mt-4 hidden md:grid md:grid-cols-12 md:gap-6">
            <div className="overflow-hidden rounded-xl bg-surface md:col-span-7">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 text-right font-medium">Price · source</th>
                    <th className="px-4 py-3 text-right font-medium">Locked</th>
                    <th className="hidden px-4 py-3 text-right font-medium xl:table-cell">Wallet</th>
                    <th className="px-4 py-3 text-right font-medium">Max LTV</th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y divide-rule"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      moveSelection(1);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      moveSelection(-1);
                    }
                  }}
                >
                  {list.map((a) => {
                    const isSel = selected?.info.symbol === a.info.symbol;
                    return (
                      <tr
                        key={a.info.symbol}
                        aria-selected={isSel}
                        tabIndex={0}
                        onClick={() => setSelSymbol(a.info.symbol)}
                        onFocus={() => setSelSymbol(a.info.symbol)}
                        onDoubleClick={() => router.push(`/portfolio/${a.info.symbol}`)}
                        className={`cursor-pointer outline-none hover:bg-plaster/60 focus-visible:bg-plaster/60 ${isSel ? "bg-plaster/60" : ""}`}
                        style={isSel ? { boxShadow: "inset 3px 0 0 var(--color-brass)" } : undefined}
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold">{a.info.symbol}</span>
                            <span className="rounded-full bg-plaster px-2 py-0.5 text-[11px] text-ink-2">
                              {a.info.assetClass === "ArtNote" ? "Art note" : a.info.assetClass}
                            </span>
                            {a.info.preIpo ? (
                              <span className="rounded-full bg-brass-soft px-2 py-0.5 text-[11px] font-medium text-brass">
                                {a.info.preIpo.label}
                              </span>
                            ) : null}
                            <MockBadge />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular">
                          {formatUsd(a.priceUsd6)}{" "}
                          <span className="text-xs text-ink-3">
                            · {a.info.priceSource === "PartnerFmv" ? "Partner" : a.info.priceSource}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular">{formatTokens(a.deposited, a.info.decimals)}</td>
                        <td className="hidden px-4 py-3 text-right font-mono tabular xl:table-cell">{formatTokens(a.walletBalance, a.info.decimals)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular text-ink-2">{formatPct(BigInt(a.info.maxLtvBps))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected asset panel (D7) */}
            {selected ? (
              <aside className="self-start rounded-xl bg-surface p-4 md:col-span-5" aria-label={`${selected.info.symbol} details`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">
                    {selected.info.symbol} <span className="font-normal text-ink-3">· {selected.info.name}</span>
                  </p>
                  <Link href={`/portfolio/${selected.info.symbol}`} className="shrink-0 text-sm font-semibold text-brass">
                    Details ›
                  </Link>
                </div>
                <div className="mt-2">
                  <PriceChart symbol={selected.info.symbol} compact defaultDays={90} />
                </div>
                <p className="mt-2 font-mono text-xs tabular text-ink-2">
                  Wallet {formatTokens(selected.walletBalance, selected.info.decimals)} · Locked {formatTokens(selected.deposited, selected.info.decimals)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href={`/portfolio/${selected.info.symbol}?mode=deposit`}
                    className="flex min-h-[44px] items-center justify-center rounded-lg bg-brass px-3 text-sm font-semibold text-on-brass"
                  >
                    Deposit
                  </Link>
                  <Link
                    href={`/portfolio/${selected.info.symbol}?mode=withdraw`}
                    className="flex min-h-[44px] items-center justify-center rounded-lg border border-rule px-3 text-sm font-semibold text-ink"
                  >
                    Withdraw
                  </Link>
                </div>
              </aside>
            ) : null}
          </div>
        </>
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
