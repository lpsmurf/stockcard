"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PreIpoReading } from "@/lib/prices/preipo";
import { type MarketInfo } from "@/lib/config";
import { AmountInput, parseTokens } from "@/components/amount-input";
import { AssetVisual } from "@/components/asset-visual";
import { MockBadge } from "@/components/mock-badge";
import { PreviewRow } from "@/components/preview-row";
import { useToast } from "@/components/toast";
import { PriceChart } from "@/components/price-chart";
import { depositCollateral, withdrawCollateral } from "@/lib/actions";
import { useProgram } from "@/lib/program";
import { usePortfolio } from "@/lib/portfolio";
import { formatPct, formatTokens, formatUsd, liquidationPrice, ltvBps } from "@/lib/risk";

/** Sources the price signer actually consults for this market (lib/prices/signer.ts). */
function priceSources(info: MarketInfo): string[] {
  if (info.preIpo) return [info.preIpo.provider === "tessera" ? "Tessera NAV" : "PreStocks NAV", "Jupiter cross-check"];
  if (info.symbol === "SPCX") return ["Backpack", "Jupiter", "Pyth"];
  if (info.assetClass === "Equity") return ["xStocks API", "Jupiter", "Pyth"];
  if (info.assetClass === "ArtNote") return ["Appraisal"];
  return ["Partner FMV"];
}

export default function AssetDetailPage() {
  return (
    <Suspense>
      <AssetDetail />
    </Suspense>
  );
}

function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: assets, isLoading } = usePortfolio();

  const asset = (assets ?? []).find((a) => a.info.symbol === symbol);
  const [tab, setTab] = useState<"deposit" | "withdraw">(params.get("mode") === "withdraw" ? "withdraw" : "deposit");
  const [amountStr, setAmountStr] = useState(params.get("amount") ?? "");
  const [busy, setBusy] = useState(false);

  const { data: preipo } = useQuery({
    queryKey: ["preipo", symbol],
    enabled: Boolean(asset?.info.preIpo),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/preipo?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      return json.data as PreIpoReading;
    },
  });

  const amount = useMemo(() => (asset ? (parseTokens(amountStr, asset.info.decimals) ?? 0n) : 0n), [amountStr, asset]);
  const maxWithdraw = useMemo(() => {
    if (!asset) return 0n;
    if (asset.debt === 0n) return asset.deposited;
    // solve for remaining collateral keeping LTV <= max: value_remaining = debt / max_ltv
    const maxLtv = BigInt(asset.info.maxLtvBps);
    const neededValue = (asset.debt * 10_000n + maxLtv - 1n) / maxLtv;
    if (asset.valueUsd6 <= neededValue) return 0n;
    const excessValue = asset.valueUsd6 - neededValue;
    // value per raw unit (with haircut + multiplier)
    const perUnit =
      (asset.info.multiplierMicro * asset.priceUsd6 * (10_000n - BigInt(asset.info.haircutBps))) / (1_000_000n * 10_000n);
    if (perUnit === 0n) return 0n;
    const raw = excessValue * 10n ** BigInt(asset.info.decimals) / perUnit;
    return raw < asset.deposited ? raw : asset.deposited;
  }, [asset]);

  if (isLoading) return <div className="mx-auto h-64 w-full max-w-md animate-pulse rounded-2xl bg-surface" />;
  if (!asset) {
    return (
      <div className="mx-auto w-full max-w-md md:max-w-xl">
        <Link href="/portfolio" className="text-sm text-brass">‹ Assets</Link>
        <p className="mt-4 text-ink-2">Unknown asset.</p>
      </div>
    );
  }

  const creditImpact = (amount * asset.info.multiplierMicro * asset.priceUsd6 * (10_000n - BigInt(asset.info.haircutBps)) * BigInt(asset.info.maxLtvBps)) /
    (10n ** BigInt(asset.info.decimals) * 1_000_000n * 10_000n * 10_000n);
  const newLtv =
    tab === "deposit"
      ? ltvBps(asset.debt, asset.valueUsd6 + (creditImpact * 10_000n) / BigInt(asset.info.maxLtvBps))
      : asset.debt > 0n
        ? ltvBps(asset.debt, asset.valueUsd6 - (creditImpact * 10_000n) / BigInt(asset.info.maxLtvBps))
        : 0n;

  async function confirm() {
    if (!publicKey || !asset || amount <= 0n) return;
    setBusy(true);
    try {
      const sig =
        tab === "deposit"
          ? await depositCollateral(program, publicKey, asset, amount)
          : await withdrawCollateral(program, publicKey, asset, amount);
      await queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast(`${tab === "deposit" ? "Deposited" : "Withdrew"} ${formatTokens(amount, asset.info.decimals)} ${asset.info.symbol}`, { sig });
      router.push("/portfolio");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.match(/Error Code: (\w+)/)?.[1];
      toast(
        code === "InsufficientCollateral"
          ? `You can withdraw up to ${formatTokens(maxWithdraw, asset.info.decimals)} ${asset.info.symbol} while you have a balance.`
          : msg.includes("User rejected")
            ? "Signature cancelled."
            : msg,
        { variant: "error" },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md md:max-w-xl">
      <Link href="/portfolio" className="inline-flex min-h-[44px] items-center text-sm text-brass">‹ Assets</Link>

      {asset.info.assetClass === "ArtNote" || asset.info.assetClass === "Collectible" ? (
        <div className="mt-2">
          <AssetVisual info={asset.info} />
        </div>
      ) : null}

      <div className="mt-2 rounded-2xl bg-surface p-4">
        <PriceChart
          symbol={asset.info.symbol}
          liquidationPriceUsd={
            asset.debt > 0n && asset.deposited > 0n
              ? Number(
                  liquidationPrice(
                    asset.debt,
                    asset.deposited,
                    asset.info.multiplierMicro,
                    BigInt(asset.info.haircutBps),
                    BigInt(asset.info.liqThresholdBps),
                    asset.info.decimals,
                  ),
                ) / 1e6
              : null
          }
        />
      </div>

      <h1 className="mt-4 font-display text-2xl">{asset.info.name}</h1>
      {asset.info.assetClass === "ArtNote" ? (
        <p className="mt-0.5 text-sm text-ink-3">Luxembourg compartment 01</p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-plaster px-2 py-0.5 text-[11px] text-ink-2">
          {asset.info.assetClass === "ArtNote" ? "Art note" : asset.info.assetClass}
        </span>
        {asset.info.grade ? (
          <span className="rounded-full bg-plaster px-2 py-0.5 text-[11px] text-ink-2">{asset.info.grade}</span>
        ) : null}
        {asset.info.preIpo ? (
          <span className="rounded-full bg-brass-soft px-2 py-0.5 text-[11px] font-medium text-brass">
            {asset.info.preIpo.label} · {asset.info.preIpo.provider === "tessera" ? "Tessera" : "PreStocks"}
          </span>
        ) : null}
      </div>
      <div className="mt-3 rounded-xl bg-surface p-4">
        <PreviewRow label="Price" value={`${formatUsd(asset.priceUsd6)} · ${asset.info.preIpo ? "NAV" : asset.info.priceSource === "PartnerFmv" ? "Partner value" : asset.info.priceSource}`} />
        <PreviewRow label="Price sources" value={priceSources(asset.info).join(" · ")} />
        <PreviewRow label="Haircut" value={formatPct(BigInt(asset.info.haircutBps))} />
        <PreviewRow label="Max LTV" value={formatPct(BigInt(asset.info.maxLtvBps))} />
        <PreviewRow label="Locked" value={`${formatTokens(asset.deposited, asset.info.decimals)} ${asset.info.symbol}`} />
        <PreviewRow label="In wallet" value={`${formatTokens(asset.walletBalance, asset.info.decimals)} ${asset.info.symbol}`} />
        <div className="pt-1"><MockBadge /></div>
      </div>
      {asset.info.preIpo ? (
        <p className="mt-2 text-xs text-ink-3">
          {preipo?.premiumBps == null
            ? `We lend against the ${asset.info.preIpo.provider === "tessera" ? "Tessera" : "PreStocks"} NAV (mark price) — the token premium is excluded.`
            : preipo.premiumBps < 0
              ? `Trading ${(-preipo.premiumBps / 100).toFixed(0)}% below NAV — we lend against the lower figure.`
              : `Trading ${(preipo.premiumBps / 100).toFixed(0)}% above NAV — we lend against NAV only.`}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="tablist">
        {(["deposit", "withdraw"] as const).map((t2) => (
          <button
            key={t2}
            role="tab"
            aria-selected={tab === t2}
            onClick={() => setTab(t2)}
            className={`min-h-[44px] rounded-lg text-sm font-semibold capitalize ${tab === t2 ? "bg-raised shadow-sm" : "text-ink-2"}`}
          >
            {t2}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <AmountInput
          label="Amount"
          prefix=""
          value={amountStr}
          onChange={setAmountStr}
          onMax={() =>
            setAmountStr(formatTokens(tab === "deposit" ? asset.walletBalance : maxWithdraw, asset.info.decimals))
          }
          hint={tab === "withdraw" && asset.debt > 0n ? `You can withdraw up to ${formatTokens(maxWithdraw, asset.info.decimals)} ${asset.info.symbol} while you have a balance.` : undefined}
        />
      </div>

      <div className="mt-4 rounded-xl bg-raised p-4">
        <PreviewRow label={tab === "deposit" ? "Credit added" : "Credit removed"} value={formatUsd(creditImpact)} tone={tab === "deposit" ? "good" : "warn"} />
        {asset.debt > 0n ? <PreviewRow label="LTV after" value={`${formatPct(asset.ltv)} → ${formatPct(newLtv)}`} /> : null}
      </div>

      <button
        onClick={confirm}
        disabled={busy || !publicKey || amount <= 0n || (tab === "deposit" && amount > asset.walletBalance) || (tab === "withdraw" && amount > maxWithdraw)}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
      >
        {busy ? "Signing…" : "Confirm and sign"}
      </button>
    </div>
  );
}
