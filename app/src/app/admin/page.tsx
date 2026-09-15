"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MockBadge } from "@/components/mock-badge";
import { useToast } from "@/components/toast";
import { MARKETS, marketMint, CLUSTER } from "@/lib/config";
import { usePortfolio } from "@/lib/portfolio";
import { useReadProgram } from "@/lib/program";
import { formatPct, formatUsd, ltvBps, collateralValue } from "@/lib/risk";
import { PublicKey } from "@solana/web3.js";

/** S11 demo controls (devnet only): crash/restore signed prices, run liquidations. */
export default function AdminPage() {
  const { toast } = useToast();
  const program = useReadProgram();
  const { data: assets, refetch } = usePortfolio();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const positionsQuery = useQuery({
    queryKey: ["all-positions"],
    refetchInterval: 20_000,
    queryFn: () => program.account.position.all(),
  });

  async function call(route: string, body: object) {
    const res = await fetch(route, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? "failed");
    return json.data;
  }

  async function priceAction(symbol: string, action: "crash" | "restore") {
    const info = MARKETS.find((m) => m.symbol === symbol)!;
    const asset = (assets ?? []).find((a) => a.info.symbol === symbol);
    setBusy(`${symbol}-${action}`);
    try {
      const data = await call("/api/admin/price", {
        mint: marketMint(info),
        action,
        currentPriceUsd: asset ? Number(asset.priceUsd6) / 1e6 : undefined,
        restorePriceUsd: info.insuredValueUsd6 ? Number(info.insuredValueUsd6) / 1e6 : undefined,
      });
      toast(`${symbol} ${action === "crash" ? "crashed −30%" : "restored"}`, { sig: data.signature });
      setTimeout(() => refetch(), 2000);
    } catch (e) {
      toast(e instanceof Error ? e.message : "failed", { variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function liquidate(owner: string, symbol: string, debtUsd6: bigint) {
    const info = MARKETS.find((m) => m.symbol === symbol)!;
    setBusy(`liq-${owner.slice(0, 6)}`);
    try {
      const data = await call("/api/admin/liquidate", {
        owner,
        mint: marketMint(info),
        repayUsd6: (debtUsd6 / 2n).toString(), // close factor 50%
      });
      toast("Liquidated 50%", { sig: data.signature });
      setTimeout(() => {
        positionsQuery.refetch();
        refetch();
      }, 2000);
    } catch (e) {
      toast(e instanceof Error ? e.message : "failed", { variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (CLUSTER !== "devnet") return <p className="text-ink-2">Admin is devnet only.</p>;

  const atRisk = (positionsQuery.data ?? [])
    .map((p) => {
      const marketInfo = MARKETS.find((m) => {
        const mint = marketMint(m);
        return mint && p.account.market.equals(new PublicKey(mint));
      });
      return { p, marketInfo };
    })
    .filter((x) => x.marketInfo);

  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-3xl">Demo controls</h1>
        <MockBadge label="Devnet only" />
      </div>

      <label className="mt-4 block text-sm text-ink-2">
        Admin token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 min-h-[48px] w-full rounded-xl border border-rule bg-raised px-4 font-mono outline-none focus:border-brass"
        />
      </label>

      <h2 className="mt-6 text-sm font-semibold text-ink-2">Markets</h2>
      <ul className="mt-2 divide-y divide-rule rounded-xl bg-surface">
        {(assets ?? []).map((a) => (
          <li key={a.info.symbol} className="px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{a.info.symbol}</span>
              <span className="font-mono text-sm tabular">{formatUsd(a.priceUsd6)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs capitalize text-ink-3">{a.source}</span>
              <span className="flex gap-2">
                <button
                  onClick={() => priceAction(a.info.symbol, "crash")}
                  disabled={busy !== null}
                  className="min-h-[44px] rounded-lg border border-warn/50 px-3 text-sm text-warn disabled:opacity-40"
                >
                  {busy === `${a.info.symbol}-crash` ? "…" : "Crash −30%"}
                </button>
                <button
                  onClick={() => priceAction(a.info.symbol, "restore")}
                  disabled={busy !== null}
                  className="min-h-[44px] rounded-lg border border-rule px-3 text-sm text-ink disabled:opacity-40"
                >
                  {busy === `${a.info.symbol}-restore` ? "…" : "Restore"}
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-sm font-semibold text-ink-2">Positions at risk</h2>
      <ul className="mt-2 divide-y divide-rule rounded-xl bg-surface">
        {atRisk.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-ink-3">No positions yet</li>
        ) : (
          atRisk.map(({ p, marketInfo }) => {
            const info = marketInfo!;
            const asset = (assets ?? []).find((a) => a.info.symbol === info.symbol);
            if (!asset) return null;
            const debt = BigInt(p.account.debtPrincipal.toString());
            if (debt === 0n) return null;
            const collateral = BigInt(p.account.collateralAmount.toString());
            const value = collateralValue(collateral, info.decimals, asset.priceUsd6, BigInt(info.haircutBps), info.multiplierMicro);
            const ltv = ltvBps(debt, value);
            const liquidatable = ltv > BigInt(info.liqThresholdBps);
            return (
              <li key={`${p.account.owner.toBase58()}-${info.symbol}`} className="px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-sm">{p.account.owner.toBase58().slice(0, 4)}…{p.account.owner.toBase58().slice(-4)}</span>
                  <span className={`font-mono text-sm tabular ${liquidatable ? "text-bad" : "text-ink-2"}`}>
                    {info.symbol} · LTV {formatPct(ltv)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-3 tabular">Debt {formatUsd(debt)}</span>
                  <button
                    onClick={() => liquidate(p.account.owner.toBase58(), info.symbol, debt)}
                    disabled={busy !== null || !liquidatable}
                    className="min-h-[44px] rounded-lg border border-bad/50 px-3 text-sm text-bad disabled:opacity-40"
                  >
                    {busy?.startsWith("liq-") ? "…" : "Liquidate 50%"}
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
