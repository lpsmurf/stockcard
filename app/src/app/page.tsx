"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePortfolio, totals } from "@/lib/portfolio";
import { alertBand, fixAmounts, formatPct, formatTokens, formatUsd } from "@/lib/risk";
import { CreditCard } from "@/components/credit-card";
import { HealthBar } from "@/components/health-bar";
import { MockBadge } from "@/components/mock-badge";
import { Banner } from "@/components/banner";
import { AlertsCard } from "@/components/alerts-card";
import { BalanceSummary } from "@/components/balance-summary";
import { AprLine } from "@/components/apr-line";

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
          <p className="font-display text-[44px] leading-tight tabular">{formatUsd(t.availableUsd6)}</p>
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
      </div>

      <div className="mt-6 space-y-3 lg:col-span-5 lg:mt-0">
        <BalanceSummary />
        {withCollateral.length === 0 ? (
          <div className="rounded-xl bg-surface p-5 text-center">
            <p className="text-ink-2">Add an asset to open your credit line</p>
            <Link
              href="/portfolio"
              className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass"
            >
              Add assets
            </Link>
          </div>
        ) : null}

        {(assets ?? [])
          .filter((a) => a.debt > 0n)
          .map((a) => {
            const band = alertBand(
              a.ltv,
              BigInt(a.info.maxLtvBps),
              BigInt(a.info.liqThresholdBps),
              a.info.assetClass === "Equity" ? "equity" : a.info.assetClass === "ArtNote" ? "artNote" : "collectible",
            );
            if (band === "healthy" || band === "watch") {
              return band === "watch" ? (
                <p key={a.info.symbol} className="text-sm text-ink-2">
                  You can&apos;t borrow more until {a.info.symbol} LTV is under {formatPct(BigInt(a.info.maxLtvBps))}.
                </p>
              ) : null;
            }
            const fix = fixAmounts(
              a.debt,
              a.deposited,
              a.info.multiplierMicro,
              a.priceUsd6,
              BigInt(a.info.haircutBps),
              BigInt(a.info.maxLtvBps),
              a.info.decimals,
            );
            const title =
              band === "liquidatable"
                ? "Your position can be liquidated."
                : band === "urgent"
                  ? "You're close to liquidation."
                  : `${a.info.symbol.replace(/x$/, "")} dropped.`;
            return (
              <Banner
                key={a.info.symbol}
                variant={band === "warning" ? "warn" : "bad"}
                title={title}
                actions={
                  <>
                    <Link
                      href={`/portfolio/${a.info.symbol}?mode=deposit&amount=${formatTokens(fix.addTokens, a.info.decimals)}`}
                      className="flex min-h-[44px] items-center rounded-lg bg-brass px-4 text-sm font-semibold text-on-brass"
                    >
                      Add stock
                    </Link>
                    <Link
                      href={`/borrow?mode=repay&market=${a.info.symbol}&amount=${(Number(fix.repayUsd6) / 1e6).toFixed(2)}`}
                      className="flex min-h-[44px] items-center rounded-lg border border-current px-4 text-sm font-semibold"
                    >
                      Repay {formatUsd(fix.repayUsd6)}
                    </Link>
                  </>
                }
              >
                Add {formatTokens(fix.addTokens, a.info.decimals)} {a.info.symbol} or repay {formatUsd(fix.repayUsd6)} to stay safe.
              </Banner>
            );
          })}

        <AlertsCard />
      </div>
    </div>
  );
}
