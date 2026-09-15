"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, createApproveInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "@/components/credit-card";
import { MockBadge } from "@/components/mock-badge";
import { Sheet } from "@/components/sheet";
import { AmountInput, parseUsd6 } from "@/components/amount-input";
import { PreviewRow } from "@/components/preview-row";
import { useToast } from "@/components/toast";
import { useWalletAuth } from "@/lib/wallet-auth";
import { usePortfolio, totals } from "@/lib/portfolio";
import { USDC_MINT } from "@/lib/config";
import { formatTokens, formatUsd } from "@/lib/risk";

interface CardRecord {
  id: string;
  owner: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  network: "VISA" | "MASTERCARD";
  provider: "mock" | "bridge";
  status: "active" | "frozen";
  tier: "standard" | "plus" | "black";
  cashbackMint: string;
}
interface CardTx {
  id: string;
  merchant: string;
  category: string;
  amountUsd6: string;
  status: "pending" | "settled" | "declined";
  declineReason?: string;
  settlementSig?: string;
  cashback?: { amount: string; mint: string; status: string };
  createdAt: number;
}

export default function CardPage() {
  return (
    <Suspense>
      <CardScreen />
    </Suspense>
  );
}

function CardScreen() {
  const params = useSearchParams();
  const simulate = params.get("simulate") === "1";
  const { publicKey, connected, sendTransaction } = useWallet();
  const walletAuth = useWalletAuth();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: assets } = usePortfolio();
  const t = totals(assets ?? []);

  const [holderName, setHolderName] = useState("");
  const [network, setNetwork] = useState<"VISA" | "MASTERCARD">("VISA");
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitStr, setLimitStr] = useState("500");
  const [busy, setBusy] = useState(false);

  const authHeaders = walletAuth;

  const cardQuery = useQuery({
    queryKey: ["card", publicKey?.toBase58()],
    enabled: connected,
    queryFn: async () => {
      const res = await fetch(`/api/card?owner=${publicKey!.toBase58()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "card fetch failed");
      return json.data as { card: CardRecord | null; allowanceUsd6: string; delegateAuthority: string | null };
    },
    refetchInterval: 15_000,
  });

  const txsQuery = useQuery({
    queryKey: ["card-txs", publicKey?.toBase58()],
    enabled: connected && !!cardQuery.data?.card,
    refetchInterval: 5_000,
    queryFn: async () => {
      const res = await fetch(`/api/card/transactions?owner=${publicKey!.toBase58()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "tx fetch failed");
      return json.data as CardTx[];
    },
  });

  const card = cardQuery.data?.card ?? null;
  const allowance = BigInt(cardQuery.data?.allowanceUsd6 ?? "0");

  async function createCard() {
    setBusy(true);
    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: await authHeaders("/api/card"),
        body: JSON.stringify({ holderName: holderName || "CARDHOLDER", network }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      await queryClient.invalidateQueries({ queryKey: ["card"] });
      toast("Card created");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function approveLimit() {
    if (!publicKey || !sendTransaction) return;
    const amount = parseUsd6(limitStr);
    if (amount === null || amount < 0n || amount > 10_000_000_000n) return;
    setBusy(true);
    try {
      const delegate = cardQuery.data?.delegateAuthority;
      if (!delegate) throw new Error("Card authority unavailable");
      const ata = getAssociatedTokenAddressSync(new PublicKey(USDC_MINT), publicKey);
      const ix = createApproveInstruction(ata, new PublicKey(delegate), publicKey, amount, [], TOKEN_PROGRAM_ID);
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      toast(`Card limit set to ${formatUsd(amount)}`, { sig });
      setLimitOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["card"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast(msg.includes("User rejected") ? "Signature cancelled." : msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggleFreeze() {
    if (!card) return;
    const res = await fetch("/api/card", {
      method: "PATCH",
      headers: await authHeaders("/api/card"),
      body: JSON.stringify({ status: card.status === "frozen" ? "active" : "frozen" }),
    });
    const json = await res.json();
    if (json.ok) {
      toast(card.status === "frozen" ? "Card unfrozen" : "Card frozen");
      queryClient.invalidateQueries({ queryKey: ["card"] });
    }
  }

  if (!connected) return null;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl">Card</h1>

      {card ? (
        <>
          <div className="mt-4">
            <CreditCard
              holderName={card.holderName}
              last4={card.last4}
              expMonth={card.expMonth}
              expYear={card.expYear}
              network={card.network}
              availableLabel={formatUsd(t.availableUsd6)}
              frozen={card.status === "frozen"}
            />
          </div>
          <div className="mt-2"><MockBadge label="Sandbox card" /></div>

          <div className="mt-4 rounded-xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-2">Card limit</span>
              <button onClick={() => setLimitOpen(true)} className="min-h-[44px] px-2 font-mono text-sm text-brass">
                {formatUsd(allowance)} · Edit ›
              </button>
            </div>
            <div className="mt-1 h-2 rounded-full bg-rule">
              <div
                className="h-2 rounded-full bg-brass"
                style={{ width: allowance > 0n ? `${Math.min(100, (Number(spentThisMonth(txsQuery.data ?? [])) / Number(allowance)) * 100)}%` : "0%" }}
              />
            </div>
            <p className="mt-1 font-mono text-xs text-ink-3 tabular">
              {formatUsd(allowance - spentThisMonth(txsQuery.data ?? []))} left
            </p>
            <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-between">
              <span className="text-sm">Freeze card</span>
              <input
                type="checkbox"
                checked={card.status === "frozen"}
                onChange={toggleFreeze}
                className="h-5 w-5 accent-[#8e6a22]"
              />
            </label>
          </div>

          <Link
            href="/card?simulate=1"
            className="mt-4 flex min-h-[52px] items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass"
          >
            Test purchase
          </Link>

          <h2 className="mt-6 text-sm font-semibold text-ink-2">Activity</h2>
          <ul className="mt-2 divide-y divide-rule rounded-xl bg-surface">
            {(txsQuery.data ?? []).length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-ink-3">No purchases yet: try a test purchase</li>
            ) : (
              (txsQuery.data ?? []).map((tx) => (
                <li key={tx.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{tx.merchant}</span>
                    <span className="font-mono text-sm tabular">−{formatUsd(BigInt(tx.amountUsd6))}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                    <span className={tx.status === "declined" ? "text-bad" : ""}>
                      {tx.category} · {tx.status === "declined" ? `Declined · ${tx.declineReason}` : tx.status}
                    </span>
                    {tx.settlementSig ? (
                      <a
                        className="text-brass"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://explorer.solana.com/tx/${tx.settlementSig}?cluster=devnet`}
                      >
                        ↗
                      </a>
                    ) : null}
                  </div>
                  {tx.cashback && tx.cashback.status !== "failed" ? (
                    <p className="mt-0.5 text-xs text-brass">
                      +{formatTokens(BigInt(tx.cashback.amount), 8)} cashback ({tx.cashback.status})
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <h2 className="font-display text-xl">Get your virtual card</h2>
          <label className="mt-4 block text-sm text-ink-2">
            Name on card
            <input
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="Luis P"
              className="mt-1 min-h-[48px] w-full rounded-xl border border-rule bg-raised px-4 outline-none focus:border-brass"
            />
          </label>
          <div className="mt-3 flex gap-2">
            {(["VISA", "MASTERCARD"] as const).map((n) => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className={`min-h-[44px] rounded-lg px-4 font-mono text-sm ${network === n ? "bg-brass-soft font-semibold text-brass" : "text-ink-2"}`}
              >
                {n === "VISA" ? "VISA" : "Mastercard"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">Network names are placeholders — no issuer brand approval yet.</p>
          <button
            onClick={createCard}
            disabled={busy}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create card"}
          </button>
          <div className="mt-2"><MockBadge label="Sandbox card" /></div>
        </div>
      )}

      {limitOpen ? (
        <Sheet title="Card limit" onClose={() => setLimitOpen(false)}>
          <AmountInput label="Limit" value={limitStr} onChange={setLimitStr} hint="Delegate allowance — the card can only spend up to this." />
          <button
            onClick={approveLimit}
            disabled={busy}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
          >
            {busy ? "Signing…" : "Approve limit"}
          </button>
        </Sheet>
      ) : null}

      {simulate && card ? <PurchaseSheet allowance={allowance} tier={card.tier} authHeaders={authHeaders} /> : null}
    </div>
  );
}

function spentThisMonth(txs: { status: string; amountUsd6: string; createdAt: number }[]): bigint {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return txs
    .filter((t) => t.status === "settled" && t.createdAt >= start.getTime())
    .reduce((s, t) => s + BigInt(t.amountUsd6), 0n);
}

const PRESETS = [
  { label: "Coffee $4.80", merchant: "Blue Bottle", category: "Coffee", amountUsd6: 4_800_000n },
  { label: "Groceries $62.15", merchant: "Albert Heijn", category: "Groceries", amountUsd6: 62_150_000n },
  { label: "Flight $389.00", merchant: "KLM", category: "Flight", amountUsd6: 389_000_000n },
];

function PurchaseSheet({
  allowance,
  tier,
  authHeaders,
}: {
  allowance: bigint;
  tier: "standard" | "plus" | "black";
  authHeaders: (route: string) => Promise<Record<string, string>>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [merchant, setMerchant] = useState(PRESETS[1].merchant);
  const [amountStr, setAmountStr] = useState("62.15");
  const [busy, setBusy] = useState(false);
  const amount = parseUsd6(amountStr) ?? 0n;
  const tierBps = tier === "black" ? 250n : tier === "plus" ? 150n : 50n;
  const cashbackUsd = (amount * tierBps) / 10_000n;

  async function pay() {
    setBusy(true);
    try {
      const res = await fetch("/api/card/simulate", {
        method: "POST",
        headers: await authHeaders("/api/card/simulate"),
        body: JSON.stringify({ merchant, category: "Purchase", amountUsd6: amount.toString() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      const tx = json.data as CardTx;
      if (tx.status === "declined") {
        toast(`Payment declined: ${tx.declineReason === "LIMIT" ? `card limit ${formatUsd(allowance)}, raise it in Card` : tx.declineReason}`, { variant: "error" });
      } else {
        toast(`Paid ${formatUsd(amount)}${cashbackUsd > 0n ? ` · +${formatUsd(cashbackUsd)} cashback` : ""}`, { sig: tx.settlementSig });
      }
      await queryClient.invalidateQueries({ queryKey: ["card-txs"] });
      window.history.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Test purchase">
      <p className="text-sm text-ink-2">Simulates a card payment on devnet. Real USDC moves.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.merchant}
            onClick={() => {
              setMerchant(p.merchant);
              setAmountStr((Number(p.amountUsd6) / 1e6).toString());
            }}
            className="min-h-[44px] rounded-full bg-brass-soft px-4 text-sm text-brass"
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm text-ink-2">
        Merchant
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="mt-1 min-h-[48px] w-full rounded-xl border border-rule bg-raised px-4 outline-none focus:border-brass"
        />
      </label>
      <div className="mt-3">
        <AmountInput label="Amount" value={amountStr} onChange={setAmountStr} />
      </div>
      <div className="mt-4 rounded-xl bg-raised p-4">
        <PreviewRow label="Cashback" value={`+${formatUsd(cashbackUsd)} in NVDAx`} tone="brass" />
        <PreviewRow label="Card limit left" value={formatUsd(allowance > amount ? allowance - amount : 0n)} />
      </div>
      <button
        onClick={pay}
        disabled={busy || amount <= 0n}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-brass px-4 font-semibold text-on-brass disabled:opacity-40"
      >
        {busy ? "Processing…" : "Pay"}
      </button>
    </Sheet>
  );
}
