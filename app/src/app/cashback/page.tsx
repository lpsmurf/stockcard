"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletAuth } from "@/lib/wallet-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MockBadge } from "@/components/mock-badge";
import { PerksTable } from "@/components/perks-table";
import { useToast } from "@/components/toast";
import { MARKETS, CASHBACK_ASSETS } from "@/lib/config";
import { usePortfolio } from "@/lib/portfolio";
import { formatTokens, formatUsd } from "@/lib/risk";

interface CardRecord {
  tier: "standard" | "plus" | "black";
  cashbackMint: string;
  holderName: string;
}

const TIERS = [
  { id: "standard", label: "Standard", rate: "0.5%", price: "Free" },
  { id: "plus", label: "Plus", rate: "1.5%", price: "€9.99/mo" },
  { id: "black", label: "Black", rate: "2.5%", price: "€39.99" },
] as const;

export default function CashbackPage() {
  const { publicKey, connected } = useWallet();
  const walletAuth = useWalletAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: assets } = usePortfolio();
  const [busy, setBusy] = useState(false);

  const cardQuery = useQuery({
    queryKey: ["card", publicKey?.toBase58()],
    enabled: connected,
    queryFn: async () => {
      const res = await fetch(`/api/card?owner=${publicKey!.toBase58()}`);
      const json = await res.json();
      return (json.data?.card ?? null) as CardRecord | null;
    },
    refetchInterval: 15_000,
  });

  const txsQuery = useQuery({
    queryKey: ["card-txs", publicKey?.toBase58()],
    enabled: connected,
    queryFn: async () => {
      const res = await fetch(`/api/card/transactions?owner=${publicKey!.toBase58()}`);
      const json = await res.json();
      return (json.data ?? []) as { cashback?: { usd6: string; amount: string; mint: string; status: string } | null }[];
    },
  });

  const card = cardQuery.data;
  const lifetimeUsd = (txsQuery.data ?? []).reduce((s, t) => s + (t.cashback ? BigInt(t.cashback.usd6) : 0n), 0n);
  const lifetimeAsset = (txsQuery.data ?? []).reduce((s, t) => s + (t.cashback && t.cashback.status === "sent" ? BigInt(t.cashback.amount) : 0n), 0n);

  function symbolOfMint(mint: string): string {
    return MARKETS.find((m) => process.env[m.mintEnvKey] === mint)?.symbol ?? "NVDAx";
  }

  async function save(patch: { tier?: string; cashbackMint?: string }) {
    if (!publicKey) return;
    setBusy(true);
    try {
      const res = await fetch("/api/card", {
        method: "PATCH",
        headers: await walletAuth("/api/card"),
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      await queryClient.invalidateQueries({ queryKey: ["card"] });
      toast("Saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      toast(msg.includes("User rejected") ? "Signature cancelled." : msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!connected) return null;

  return (
    <div className="mx-auto w-full max-w-md md:max-w-xl">
      <h1 className="font-display text-3xl">Cashback</h1>
      <p className="mt-1 text-[15px] text-ink-2">Every purchase buys you more of what you own.</p>

      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Lifetime cashback</p>
        <p className="font-display text-[40px] leading-tight tabular">{formatUsd(lifetimeUsd)}</p>
        <p className="font-mono text-sm text-ink-3 tabular">
          {formatTokens(lifetimeAsset, 8)} {symbolOfMint(card?.cashbackMint ?? "")}
        </p>
      </div>

      {!card ? (
        <p className="mt-6 rounded-xl bg-surface p-4 text-sm text-ink-2">
          Create your card first — tier and cashback asset live on it.
        </p>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-2">Your tier</h2>
            <MockBadge label="Demo toggle" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TIERS.map((t) => (
              <button
                key={t.id}
                onClick={() => save({ tier: t.id })}
                disabled={busy}
                className={`rounded-xl border p-3 text-left ${
                  card.tier === t.id ? "border-brass bg-brass-soft" : "border-rule bg-surface"
                }`}
              >
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="font-mono text-lg tabular">{t.rate}</p>
                <p className="text-xs text-ink-3">{t.price}</p>
              </button>
            ))}
          </div>

          <h2 className="mt-6 text-sm font-semibold text-ink-2">Cashback buys</h2>
          <div className="mt-2 space-y-1 rounded-xl bg-surface p-2">
            {CASHBACK_ASSETS.map((symbol) => {
              const info = MARKETS.find((m) => m.symbol === symbol)!;
              const mint = process.env[info.mintEnvKey] ?? "";
              const selected = card.cashbackMint === mint || (!card.cashbackMint && symbol === "NVDAx");
              const price = (assets ?? []).find((a) => a.info.symbol === symbol)?.priceUsd6 ?? 0n;
              return (
                <button
                  key={symbol}
                  onClick={() => save({ cashbackMint: mint })}
                  disabled={busy}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-raised"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-brass bg-brass" : "border-rule"}`}
                  >
                    {selected ? <span className="h-2 w-2 rounded-full bg-on-brass" /> : null}
                  </span>
                  <span className="flex-1">
                    <span className="font-semibold">{symbol}</span>
                    <span className="ml-2 text-sm text-ink-3">{info.name}</span>
                  </span>
                  <span className="font-mono text-xs text-ink-3 tabular">{formatUsd(price)}</span>
                </button>
              );
            })}
            <div className="flex min-h-[48px] items-center gap-3 px-3 opacity-60">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-rule" />
              <span className="flex-1 text-sm">Card pack credit</span>
              <span className="rounded-full bg-plaster px-2 py-0.5 text-[11px] text-ink-3">soon</span>
            </div>
          </div>

          <p className="mt-4 text-sm text-ink-3">
            Goes straight into your collateral and raises your credit line. Top rate applies up to your tier&apos;s
            monthly cap, then the base rate.
          </p>
        </>
      )}

      <PerksTable tier={card?.tier ?? "standard"} />
    </div>
  );
}
