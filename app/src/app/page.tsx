"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePortfolio, totals } from "@/lib/portfolio";
import { formatPct, formatTokens, formatUsd, liquidationPrice } from "@/lib/risk";
import { CreditCard } from "@/components/credit-card";
import { HealthBar } from "@/components/health-bar";
import { MockBadge } from "@/components/mock-badge";
import { AlertsCard } from "@/components/alerts-card";
import { BalanceSummary } from "@/components/balance-summary";
import { BandBanners } from "@/components/band-banners";
import { RecentActivity } from "@/components/recent-activity";
import { AprLine } from "@/components/apr-line";
import { PayoutRows } from "@/components/payout-rows";

export default function HomePage() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  if (!connected || !publicKey) return <Welcome onConnect={() => setVisible(true)} />;
  return <Home />;
}

function Welcome({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="mx-auto max-w-md py-6 md:grid md:max-w-3xl md:grid-cols-2 md:items-center md:gap-12 lg:max-w-5xl">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brass">Real assets only · No memecoins</p>
        <h1 className="mt-4 font-display text-[40px] leading-[1.1] lg:text-[64px]">
          Spend what you own.
          <br />
          <em className="text-brass">Never sell it.</em>
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-ink-2">
          Lock stocks, art or graded cards. Get a USDC credit line. Pay anywhere cards work.
        </p>
        <button
          onClick={onConnect}
          className="mt-8 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass md:w-auto md:px-8"
        >
          Connect wallet
        </button>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-3 md:justify-start">
          Solana devnet · test assets <MockBadge />
        </p>
        <ol className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {["Lock", "Borrow", "Spend", "Repay"].map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              {i > 0 ? <span aria-hidden="true" className="text-brass">──▶</span> : null}
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-6 md:mt-0 md:justify-self-end">
        <CreditCard holderName="YOUR NAME" last4="4021" expMonth={9} expYear={29} network="VISA" availableLabel="$18,420.00" />
      </div>
    </div>
  );
}

function Home() {
  const { data: assets, isLoading } = usePortfolio();
  const t = totals(assets ?? []);
  const worst = (assets ?? []).filter((a) => a.debt > 0n).sort((a, b) => Number(b.ltv - a.ltv))[0];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-2xl bg-surface" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface" />
        <div className="h-16 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const withCollateral = (assets ?? []).filter((a) => a.deposited > 0n);

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-7">
        <Link href="/card" className="block">
          <CreditCard
            holderName="CARDHOLDER"
            last4="4021"
            expMonth={9}
            expYear={29}
            network="VISA"
            availableLabel={formatUsd(t.availableUsd6)}
          />
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Available credit</p>
          <p className="font-display text-[44px] leading-tight tabular lg:text-[56px]">{formatUsd(t.availableUsd6)}</p>
          <p className="text-sm text-ink-3">of {formatUsd(t.creditLineUsd6)} credit line</p>
        </div>

        {worst ? (
          <div className="mt-4">
            <HealthBar
              ltvBps={worst.ltv}
              maxLtvBps={BigInt(worst.info.maxLtvBps)}
              liqThresholdBps={BigInt(worst.info.liqThresholdBps)}
            />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Debt</p>
            <p className="mt-1 font-mono text-lg tabular">{formatUsd(t.debtUsd6)}</p>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">APR</p>
            <p className="mt-1 font-mono text-lg tabular">{worst ? formatPct(BigInt(worst.aprBps)) : "—"}</p>
            <p className="text-xs text-ink-3">by LTV</p>
          </div>
        </div>

        {worst ? <AprLine className="mt-2 text-xs text-ink-3" bands={worst.info.aprBands} ltvBps={worst.ltv} /> : null}
        {worst ? (
          <p className="mt-1 text-xs text-ink-3">Founding member preview: −2 pt APR for 12 months on your first €5,000 — applied off-chain at launch.</p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/borrow"
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass"
          >
            Borrow to card
          </Link>
          <Link
            href="/borrow?mode=repay"
            className="flex min-h-[48px] items-center justify-center rounded-xl border border-rule px-4 font-semibold text-ink"
          >
            Repay
          </Link>
        </div>

        <Link
          href="/bank"
          className="mt-3 flex min-h-[48px] items-center justify-center rounded-xl border border-rule px-4 font-semibold text-ink"
        >
          Send to bank
        </Link>

        {withCollateral.length === 0 ? (
          <div className="mt-4 rounded-xl bg-surface p-5 text-center">
            <p className="text-ink-2">Add an asset to open your credit line</p>
            <Link
              href="/portfolio"
              className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass"
            >
              Add assets
            </Link>
            <Link
              href="/shop"
              className="mt-2 flex min-h-[48px] items-center justify-center rounded-xl border border-rule px-4 font-semibold text-ink"
            >
              Shop with test money
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-3 lg:col-span-5 lg:mt-0">
        <BalanceSummary />
        {/* Mobile: banners inline (desktop shows them under the top bar via the shell) */}
        <div className="space-y-3 md:hidden">
          <BandBanners />
        </div>

        <RecentActivity />
        <AlertsCard />
        <PayoutRows />
      </div>

      {/* D2 positions strip (desktop/tablet): one row per market with collateral */}
      {withCollateral.length > 0 ? (
        <section className="mt-8 hidden md:block lg:col-span-12" aria-label="Your positions">
          <h2 className="text-sm font-semibold text-ink-2">Your positions</h2>
          <ul className="mt-2 divide-y divide-rule rounded-xl bg-surface">
            {withCollateral.map((a) => {
              const liqPx =
                a.debt > 0n
                  ? liquidationPrice(
                      a.debt,
                      a.deposited,
                      a.info.multiplierMicro,
                      BigInt(a.info.haircutBps),
                      BigInt(a.info.liqThresholdBps),
                      a.info.decimals,
                    )
                  : 0n;
              const ltvPct = Number(a.ltv) / 100;
              return (
                <li key={a.info.symbol}>
                  <Link href={`/portfolio/${a.info.symbol}`} className="flex items-center gap-4 px-4 py-3 hover:bg-plaster/60">
                    <span className="w-24 shrink-0 font-semibold">{a.info.symbol}</span>
                    <span className="font-mono text-sm tabular text-ink-2">
                      {formatTokens(a.deposited, a.info.decimals)} locked · {formatUsd(a.valueUsd6)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="font-mono text-sm tabular">LTV {formatPct(a.ltv)}</span>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-rule" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-brass"
                          style={{ width: `${Math.min(100, (ltvPct / (a.info.liqThresholdBps / 100)) * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="font-mono text-sm tabular text-ink-3">
                      {liqPx > 0n ? `Liquidation < ${formatUsd(liqPx)}` : "No debt"}
                    </span>
                    <span aria-hidden="true" className="text-ink-3">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
