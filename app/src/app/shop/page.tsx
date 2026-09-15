"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AmountInput, parseUsd6 } from "@/components/amount-input";
import { MockBadge } from "@/components/mock-badge";
import { PreviewRow } from "@/components/preview-row";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { MARKETS, USDC_MINT } from "@/lib/config";
import { usePortfolio } from "@/lib/portfolio";
import { formatTokens, formatUsd } from "@/lib/risk";
import { useWalletAuth } from "@/lib/wallet-auth";

interface ShopItem {
  symbol: string;
  kind: "stock" | "art" | "item";
  name: string;
  grade?: string;
  image: string;
  priceUsd6: number | null;
  source: string;
}

const TABS = [
  { id: "stock", label: "Stocks" },
  { id: "card", label: "Cards" },
  { id: "watch", label: "Watches" },
  { id: "art", label: "Art" },
] as const;

const MIRROR_NOTE = "Mirrored from a real Collector Crypt listing. Not affiliated. You don't own the real item.";

export default function ShopPage() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const walletAuth = useWalletAuth();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: assets } = usePortfolio();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("stock");
  const [buying, setBuying] = useState<ShopItem | null>(null);

  const itemsQuery = useQuery({
    queryKey: ["shop-items"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/shop/items");
      const json = await res.json();
      return json.data as { items: ShopItem[]; treasury: string };
    },
  });

  const treasury = itemsQuery.data?.treasury ?? "";
  const list = (itemsQuery.data?.items ?? []).filter((i) => {
    const info = MARKETS.find((m) => m.symbol === i.symbol);
    if (tab === "stock") return i.kind === "stock";
    if (tab === "art") return i.kind === "art";
    if (tab === "card") return info?.shopKind === "card";
    if (tab === "watch") return info?.shopKind === "watch";
    return true;
  });

  const priceOf = (item: ShopItem): bigint => {
    if (item.kind === "stock") {
      const a = (assets ?? []).find((x) => x.info.symbol === item.symbol);
      return a?.priceUsd6 ?? 0n;
    }
    return BigInt(item.priceUsd6 ?? 0);
  };

  async function claimTestMoney() {
    if (!publicKey) return;
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: await walletAuth("/api/faucet"),
        body: "{}",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast(`Claimed ${formatUsd(BigInt(json.data.amount))} test money`, { sig: json.data.signature });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      toast(msg.includes("User rejected") ? "Signature cancelled." : msg, { variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-md md:max-w-2xl">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-3xl">Demo shop</h1>
        <MockBadge label="Test money" />
      </div>
      <p className="mt-1 text-sm text-ink-2">Buy mock assets with test dUSDC, then lock them as collateral.</p>

      <button
        onClick={claimTestMoney}
        disabled={!connected}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-rule px-4 font-semibold text-ink disabled:opacity-40"
      >
        Claim test money
      </button>

      <div className="mt-4 flex gap-2" role="tablist">
        {TABS.map((t2) => (
          <button
            key={t2.id}
            role="tab"
            aria-selected={tab === t2.id}
            onClick={() => setTab(t2.id)}
            className={`min-h-[44px] rounded-full px-4 text-sm ${tab === t2.id ? "bg-brass-soft font-semibold text-brass" : "text-ink-2"}`}
          >
            {t2.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {list.map((item) => {
          const price = priceOf(item);
          const info = MARKETS.find((m) => m.symbol === item.symbol);
          const credit = info
            ? (price * BigInt(info.haircutBps >= 10_000 ? 0 : 10_000 - info.haircutBps) * BigInt(info.maxLtvBps)) / 10_000n / 10_000n
            : 0n;
          return (
            <div key={item.symbol} className="rounded-2xl bg-surface p-4">
              <div className="flex h-28 items-center justify-center rounded-xl bg-raised">
                <span className="font-display text-2xl text-ink-3">{item.symbol}</span>
              </div>
              <p className="mt-3 font-semibold leading-snug">{item.name}</p>
              {item.grade ? <p className="text-xs text-ink-3">{item.grade}</p> : null}
              <p className="mt-1 font-mono text-sm tabular">{item.kind === "stock" ? `${formatUsd(price)} · Market price` : `Insured value ${formatUsd(price)}`}</p>
              {item.kind !== "stock" ? <p className="mt-1 text-xs text-ink-3">{MIRROR_NOTE}</p> : null}
              <p className="mt-1 text-xs text-brass">Unlocks up to {formatUsd(credit)} credit per {item.kind === "stock" || item.kind === "art" ? "token" : "item"}</p>
              <button
                onClick={() => setBuying(item)}
                disabled={!connected}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass px-4 text-sm font-semibold text-on-brass disabled:opacity-40"
              >
                Buy with test money
              </button>
            </div>
          );
        })}
      </div>

      {buying ? (
        <BuySheet
          item={buying}
          price={priceOf(buying)}
          onClose={() => setBuying(null)}
          onDone={() => {
            setBuying(null);
            queryClient.invalidateQueries({ queryKey: ["portfolio"] });
          }}
          treasury={treasury}
          payer={{ publicKey: publicKey!, walletAuth, sendTransaction: sendTransaction!, connection }}
        />
      ) : null}
    </div>
  );
}

function BuySheet({
  item,
  price,
  onClose,
  onDone,
  treasury,
  payer,
}: {
  item: ShopItem;
  price: bigint;
  onClose: () => void;
  onDone: () => void;
  treasury: string;
  payer: {
    publicKey: PublicKey;
    walletAuth: (route: string) => Promise<Record<string, string>>;
    sendTransaction: (tx: Transaction, c: Connection) => Promise<string>;
    connection: Connection;
  };
}) {
  const { toast } = useToast();
  const isItem = item.kind === "item";
  const [amountStr, setAmountStr] = useState(isItem ? (Number(price) / 1e6).toString() : "100");
  const [busy, setBusy] = useState(false);
  const amount = parseUsd6(amountStr) ?? 0n;
  const info = MARKETS.find((m) => m.symbol === item.symbol)!;
  const qty = price > 0n ? (amount * 10n ** BigInt(info.decimals)) / price : 0n;

  async function buy() {
    setBusy(true);
    try {
      // 1. pay dUSDC to the shop treasury (wallet-signed on-chain)
      const usdcMint = new PublicKey(USDC_MINT);
      const treasuryKey = new PublicKey(treasury);
      const fromAta = getAssociatedTokenAddressSync(usdcMint, payer.publicKey);
      const toAta = getAssociatedTokenAddressSync(usdcMint, treasuryKey);
      const payTx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, toAta, treasuryKey, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
        createTransferInstruction(fromAta, toAta, payer.publicKey, amount, [], TOKEN_PROGRAM_ID),
      );
      const paySig = await payer.sendTransaction(payTx, payer.connection);

      // 2. tell the server to verify + mint
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: await payer.walletAuth("/api/shop/buy"),
        body: JSON.stringify({ symbol: item.symbol, amount: amount.toString(), paySignature: paySig }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast(`You bought ${formatTokens(BigInt(json.data.amount), info.decimals)} ${item.symbol}`, { sig: json.data.mintSig });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      toast(msg.includes("User rejected") ? "Signature cancelled." : msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Buy ${item.symbol}`} onClose={onClose}>
      <AmountInput
        label="Amount"
        value={amountStr}
        onChange={setAmountStr}
        hint={isItem ? "Fixed price, 1 per wallet" : item.kind === "art" ? "Min 10 notes at $10.00" : "Any amount ≥ $10"}
      />
      <div className="mt-4 rounded-xl bg-raised p-4">
        <PreviewRow label="You get" value={`${formatTokens(qty, info.decimals)} ${item.symbol}`} />
        <PreviewRow label="Price" value={formatUsd(price)} />
      </div>
      {item.kind !== "stock" ? <p className="mt-3 text-xs text-ink-3">{MIRROR_NOTE}</p> : null}
      <button
        onClick={buy}
        disabled={busy || amount <= 0n}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
      >
        {busy ? "Processing…" : "Buy"}
      </button>
    </Sheet>
  );
}
