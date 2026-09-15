"use client";

import { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { AmountInput, parseUsd6 } from "@/components/amount-input";
import { MockBadge } from "@/components/mock-badge";
import { PreviewRow } from "@/components/preview-row";
import { useToast } from "@/components/toast";
import { depositSavings, withdrawSavings } from "@/lib/savings";
import { usdcVaultPda, useConfig, useProgram, useSavingsPosition } from "@/lib/program";
import { USDC_MINT } from "@/lib/config";
import { amountForShares, formatUsd, poolValue, utilizationBps } from "@/lib/risk";

export default function SavingsPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const configQuery = useConfig();
  const savingsQuery = useSavingsPosition(publicKey);
  const vaultQuery = useQuery({
    queryKey: ["vault"],
    refetchInterval: 15_000,
    queryFn: () => connection.getTokenAccountBalance(usdcVaultPda()),
  });
  const usdcBalQuery = useQuery({
    queryKey: ["usdc-bal", publicKey?.toBase58()],
    enabled: !!publicKey,
    refetchInterval: 15_000,
    queryFn: () =>
      connection
        .getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(USDC_MINT), publicKey!))
        .catch(() => null),
  });

  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amountStr, setAmountStr] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const cfg = configQuery.data;
    const vault = BigInt(vaultQuery.data?.value.amount ?? "0");
    if (!cfg) return null;
    const totalBorrowed = BigInt(cfg.totalBorrowed.toString());
    const reserve = BigInt(cfg.reserve.toString());
    const totalShares = BigInt(cfg.totalShares.toString());
    const pool = poolValue(vault, totalBorrowed, reserve);
    const shares = savingsQuery.data ? BigInt(savingsQuery.data.shares.toString()) : 0n;
    const balance = amountForShares(shares, totalShares, pool);
    const utilization = utilizationBps(totalBorrowed, pool);
    const idle = vault > reserve ? vault - reserve : 0n;
    // saver APY = utilization × weighted borrow APR × 60%; estimate weighted APR at 12.5% (parameters.md §3b)
    const apyBps = pool > 0n ? (utilization * 1250n * 6000n) / (10_000n * 10_000n) : 0n;
    return { pool, totalShares, shares, balance, utilization, idle, reserve, apyBps };
  }, [configQuery.data, vaultQuery.data, savingsQuery.data]);

  const amount = parseUsd6(amountStr) ?? 0n;

  async function confirm() {
    if (!publicKey || !stats) return;
    setBusy(true);
    try {
      let sig: string;
      if (tab === "deposit") {
        sig = await depositSavings(program, publicKey, amount);
      } else {
        const shares =
          stats.pool > 0n && amount >= stats.balance
            ? stats.shares
            : (amount * stats.totalShares) / stats.pool || 0n;
        if (shares <= 0n) throw new Error("Nothing to withdraw");
        sig = await withdrawSavings(program, publicKey, shares);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["savings"] }),
        queryClient.invalidateQueries({ queryKey: ["vault"] }),
        queryClient.invalidateQueries({ queryKey: ["usdc-bal"] }),
        queryClient.invalidateQueries({ queryKey: ["config"] }),
      ]);
      toast(`${tab === "deposit" ? "Added" : "Withdrew"} ${formatUsd(amount)}`, { sig });
      setAmountStr("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.match(/Error Code: (\w+)/)?.[1];
      toast(
        code === "InsufficientLiquidity"
          ? `Withdrawals above ${formatUsd(stats.idle)} are available as loans are repaid.`
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
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl">Savings</h1>
      <p className="mt-1 text-[15px] text-ink-2">Earn on USDC. It funds the credit lines.</p>

      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Your savings</p>
        <p className="font-display text-[44px] leading-tight tabular">{formatUsd(stats?.balance ?? 0n)}</p>
      </div>

      <div className="mt-4 rounded-xl bg-surface p-4">
        <PreviewRow label="Current APY" value={stats ? `~${(Number(stats.apyBps) / 100).toFixed(1)}%` : "—"} tone="good" />
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="text-sm text-ink-2">Pool utilization</span>
          <span className="font-mono text-sm tabular">{stats ? (Number(stats.utilization) / 100).toFixed(1) : "0"}%</span>
        </div>
        <div className="h-2 rounded-full bg-rule">
          <div className="h-2 rounded-full bg-brass" style={{ width: `${Math.min(100, Number(stats?.utilization ?? 0n) / 100)}%` }} />
        </div>
        <PreviewRow label="Instant withdraw" value={formatUsd(stats?.idle ?? 0n)} />
        <PreviewRow label="Pool size" value={formatUsd(stats?.pool ?? 0n)} />
      </div>

      {connected ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="tablist">
            {(["deposit", "withdraw"] as const).map((t2) => (
              <button
                key={t2}
                role="tab"
                aria-selected={tab === t2}
                onClick={() => setTab(t2)}
                className={`min-h-[44px] rounded-lg text-sm font-semibold capitalize ${tab === t2 ? "bg-raised shadow-sm" : "text-ink-2"}`}
              >
                {t2 === "deposit" ? "Add USDC" : "Withdraw"}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <AmountInput
              label="Amount"
              value={amountStr}
              onChange={setAmountStr}
              onMax={() =>
                setAmountStr(
                  (Number(tab === "deposit" ? BigInt(usdcBalQuery.data?.value.amount ?? "0") : (stats?.balance ?? 0n)) / 1e6).toString(),
                )
              }
              hint={
                tab === "withdraw" && stats && stats.idle < stats.balance
                  ? `Instant up to ${formatUsd(stats.idle)}; the rest as loans are repaid.`
                  : undefined
              }
            />
          </div>
          <button
            onClick={confirm}
            disabled={busy || amount <= 0n}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
          >
            {busy ? "Signing…" : tab === "deposit" ? "Add USDC" : "Withdraw"}
          </button>
        </>
      ) : null}

      <p className="mt-4 flex items-start gap-2 text-sm text-ink-3">
        APY is variable: 60% of what borrowers pay. Devnet test USDC <MockBadge />
      </p>
    </div>
  );
}
