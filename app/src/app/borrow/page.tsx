"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { AmountInput, parseUsd6 } from "@/components/amount-input";
import { PreviewRow } from "@/components/preview-row";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { borrow, repay, REPAY_ALL } from "@/lib/actions";
import { useProgram } from "@/lib/program";
import { usePortfolio, type PortfolioAsset } from "@/lib/portfolio";
import { accrueInterest, availableCredit, formatPct, formatUsd, liquidationPrice, ltvBps } from "@/lib/risk";
import { SUGGESTED_MAX_LTV_BPS } from "@/lib/config";

export default function BorrowPage() {
  return (
    <Suspense>
      <BorrowSheet />
    </Suspense>
  );
}

function BorrowSheet() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "repay" ? "repay" : "borrow";
  const prefillSymbol = params.get("market");
  const prefillAmount = params.get("amount");

  const { publicKey } = useWallet();
  const program = useProgram();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: assets } = usePortfolio();

  const [amountStr, setAmountStr] = useState(prefillAmount ?? "");
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(() => {
    const list = (assets ?? []).filter((a) => a.deposited > 0n && a.priceUsd6 > 0n);
    if (prefillSymbol) {
      const hit = list.find((a) => a.info.symbol === prefillSymbol);
      if (hit) return [hit, ...list.filter((a) => a !== hit)];
    }
    // auto: most headroom first
    return [...list].sort(
      (a, b) =>
        Number(availableCredit(b.debt, b.valueUsd6, BigInt(b.info.maxLtvBps)) - availableCredit(a.debt, a.valueUsd6, BigInt(a.info.maxLtvBps))),
    );
  }, [assets, prefillSymbol]);

  const [symbol, setSymbol] = useState<string | null>(null);
  const asset: PortfolioAsset | undefined =
    candidates.find((a) => a.info.symbol === symbol) ?? candidates[0];

  const amount = parseUsd6(amountStr) ?? 0n;

  interface Preview {
    newDebt: bigint;
    ltv: bigint;
    max: bigint;
    liqPx: bigint;
    dropPct: number;
    apr: number;
    perDay: bigint;
    suggestedMax: bigint;
    overMax: boolean;
    overSuggested: boolean;
    pay: bigint;
  }

  const preview = useMemo((): Preview | null => {
    if (!asset || amount <= 0n) return null;
    const maxLtv = BigInt(asset.info.maxLtvBps);
    if (mode === "borrow") {
      const newDebt = asset.debt + amount;
      const ltv = ltvBps(newDebt, asset.valueUsd6);
      const max = availableCredit(asset.debt, asset.valueUsd6, maxLtv);
      const liqPx = liquidationPrice(newDebt, asset.deposited, asset.info.multiplierMicro, BigInt(asset.info.haircutBps), BigInt(asset.info.liqThresholdBps), asset.info.decimals);
      const dropPct = asset.priceUsd6 > 0n && liqPx > 0n ? 100 - (Number(liqPx) / Number(asset.priceUsd6)) * 100 : 0;
      const apr = asset.info.aprBands.find((b) => ltv <= BigInt(b.maxLtvBps))?.aprBps ?? asset.info.aprBands.at(-1)!.aprBps;
      const perDay = accrueInterest(newDebt, BigInt(apr), 86_400n);
      const suggestedMax = (asset.valueUsd6 * SUGGESTED_MAX_LTV_BPS) / 10_000n;
      return { newDebt, ltv, max, liqPx, dropPct, apr, perDay, suggestedMax, overMax: amount > max, overSuggested: newDebt > suggestedMax, pay: 0n };
    }
    const pay = amount > asset.debt ? asset.debt : amount;
    const newDebt = asset.debt - pay;
    const ltv = ltvBps(newDebt, asset.valueUsd6);
    return { pay, newDebt, ltv, max: 0n, liqPx: 0n, dropPct: 0, apr: 0, perDay: 0n, suggestedMax: 0n, overMax: false, overSuggested: false };
  }, [asset, amount, mode]);

  async function confirm() {
    if (!publicKey || !asset || amount <= 0n) return;
    setBusy(true);
    try {
      const sig =
        mode === "borrow"
          ? await borrow(program, publicKey, asset, amount)
          : await repay(program, publicKey, asset, amountStr === "all" ? REPAY_ALL : amount);
      await queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast(mode === "borrow" ? `Borrowed ${formatUsd(amount)} to your card` : `Repaid ${formatUsd(amount)}`, { sig });
      router.push("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const m = msg.match(/Error Code: (\w+)/);
      const code = m?.[1];
      const copy: Record<string, string> = {
        ExceedsMaxLtv: `That's more than your credit line. You can borrow up to ${formatUsd(availableCredit(asset.debt, asset.valueUsd6, BigInt(asset.info.maxLtvBps)))}.`,
        StalePrice: "Price is updating. Try again in a moment.",
        InsufficientLiquidity: "The pool can't lend that much right now.",
        PoolUtilizationCap: "Borrowing is full right now.",
        InsufficientCollateral: "You can withdraw up to your available collateral while you have a balance.",
        Paused: "Borrowing is paused. Repayments still work.",
        MarketBlocked: "This market is under review (issuer controls).",
      };
      toast(code ? (copy[code] ?? msg) : msg.includes("User rejected") ? "Signature cancelled." : msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!publicKey) return null;
  if (!asset) {
    return (
      <Sheet title={mode === "borrow" ? "Borrow to your card" : "Repay"}>
        <p className="text-ink-2">No collateral yet. Deposit an asset first.</p>
      </Sheet>
    );
  }

  const maxBorrow = availableCredit(asset.debt, asset.valueUsd6, BigInt(asset.info.maxLtvBps));
  const base = asset.info.symbol.replace(/x$/, "");

  return (
    <Sheet title={mode === "borrow" ? "Borrow to your card" : "Repay"}>
      <AmountInput
        label="Amount"
        value={amountStr === "all" ? "" : amountStr}
        onChange={setAmountStr}
        autoFocus
        onMax={() => setAmountStr(mode === "borrow" ? (Number(maxBorrow) / 1e6).toString() : "all")}
        hint={
          mode === "borrow"
            ? `Up to ${formatUsd(maxBorrow)}`
            : `Debt ${formatUsd(asset.debt)} incl. interest`
        }
      />
      {mode === "repay" && amountStr === "all" ? <p className="mt-1.5 text-sm text-brass">Repay all — the program caps it at your exact debt.</p> : null}

      <div className="mt-4 flex items-center justify-between rounded-xl border border-rule bg-raised px-4 py-3">
        <span className="text-sm text-ink-2">{mode === "borrow" ? "From" : "Against"}</span>
        {candidates.length > 1 ? (
          <select
            aria-label="Position"
            value={asset.info.symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="min-h-[44px] bg-transparent font-mono text-sm"
          >
            {candidates.map((a) => (
              <option key={a.info.symbol} value={a.info.symbol}>
                {a.info.symbol} position
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono text-sm">{asset.info.symbol} position</span>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-raised p-4">
        {mode === "borrow" && preview ? (
          <>
            <PreviewRow
              label="New LTV"
              value={`${formatPct(asset.ltv)} → ${formatPct(preview.ltv)}`}
              tone={preview.overMax ? "bad" : preview.ltv > BigInt(asset.info.maxLtvBps) ? "warn" : undefined}
            />
            <PreviewRow
              label={`Liquidation if ${base} <`}
              value={`${formatUsd(preview.liqPx)} (−${preview.dropPct.toFixed(1)}%)`}
            />
            <PreviewRow
              label="Suggested max (35%)"
              value={formatUsd(preview.suggestedMax)}
              tone={preview.overSuggested ? "warn" : undefined}
            />
            <PreviewRow label="APR / interest" value={`${formatPct(BigInt(preview.apr))} · ${formatUsd(preview.perDay)}/d`} />
          </>
        ) : null}
        {mode === "repay" && preview ? (
          <>
            <PreviewRow label="Debt after" value={formatUsd(preview.newDebt)} />
            <PreviewRow label="LTV after" value={`${formatPct(asset.ltv)} → ${formatPct(preview.ltv)}`} />
          </>
        ) : null}
      </div>

      {mode === "borrow" && preview?.overMax ? (
        <p className="mt-3 text-sm text-bad">
          That&apos;s more than your credit line. You can borrow up to {formatUsd(maxBorrow)}.
        </p>
      ) : null}
      {mode === "borrow" && preview && !preview.overMax && preview.overSuggested ? (
        <p className="mt-3 text-sm text-warn">Above the suggested 35% — liquidation gets closer. You can still proceed.</p>
      ) : null}

      <button
        onClick={confirm}
        disabled={busy || amount <= 0n || (mode === "borrow" && !!preview?.overMax)}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
      >
        {busy ? "Signing…" : "Confirm and sign"}
      </button>
    </Sheet>
  );
}
