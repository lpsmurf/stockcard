"use client";

import Link from "next/link";
import { Banner } from "./banner";
import { usePortfolio } from "@/lib/portfolio";
import { alertBand, fixAmounts, formatPct, formatTokens, formatUsd } from "@/lib/risk";

/** Risk band banners (warning / urgent / liquidatable) — shown under the top bar on desktop, inline on mobile Home. */
export function BandBanners() {
  const { data: assets } = usePortfolio();
  return (
    <>
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
    </>
  );
}
