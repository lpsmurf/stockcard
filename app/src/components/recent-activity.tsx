"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { formatUsd } from "@/lib/risk";

interface CardTx {
  id: string;
  merchant: string;
  category: string;
  amountUsd6: string;
  status: "pending" | "settled" | "declined";
  settlementSig?: string;
}

/** D2 — "Recent card activity" (last 5) for the Home right column. Renders nothing without a card or txs. */
export function RecentActivity() {
  const { publicKey, connected } = useWallet();
  const query = useQuery({
    queryKey: ["card-txs", publicKey?.toBase58()],
    enabled: connected,
    refetchInterval: 15_000,
    queryFn: async () => {
      const res = await fetch(`/api/card/transactions?owner=${publicKey!.toBase58()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "tx fetch failed");
      return json.data as CardTx[];
    },
  });

  const txs = (query.data ?? []).slice(0, 5);
  if (txs.length === 0) return null;

  return (
    <section className="rounded-2xl bg-surface p-4" aria-label="Recent card activity">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink-2">Recent card activity</h2>
        <Link href="/card" className="text-xs font-semibold text-brass">
          All ›
        </Link>
      </div>
      <ul className="mt-2 divide-y divide-rule">
        {txs.map((tx) => (
          <li key={tx.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {tx.merchant}
              {tx.status === "declined" ? <span className="ml-1 text-xs text-bad">declined</span> : null}
            </span>
            <span className="font-mono tabular text-ink-2">−{formatUsd(BigInt(tx.amountUsd6))}</span>
            {tx.settlementSig ? (
              <a
                className="text-brass"
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${tx.merchant} transaction on explorer`}
                href={`https://explorer.solana.com/tx/${tx.settlementSig}?cluster=devnet`}
              >
                ↗
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
