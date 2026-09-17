"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useWalletAuth } from "@/lib/wallet-auth";

interface PayoutRow {
  id: string;
  bankLast4: string;
  eurCents: number;
  status: "processing" | "arrived" | "failed" | "returned";
  transferSig: string;
}

const eur = (cents: number) =>
  `€${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** S14 — recent payout rows on Home: "To ··4300 · −€500.00 · Arrived" with the Solana tx link. */
export function PayoutRows() {
  const { publicKey } = useWallet();
  const walletAuth = useWalletAuth();
  const payoutsQuery = useQuery({
    queryKey: ["payouts", publicKey?.toBase58()],
    enabled: !!publicKey,
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await fetch("/api/payouts", { headers: await walletAuth("/api/payouts") });
      const json = await res.json();
      return ((json.data ?? []) as PayoutRow[]).slice(0, 5);
    },
  });
  const payouts = payoutsQuery.data ?? [];
  if (payouts.length === 0) return null;
  return (
    <section aria-label="Bank transfers">
      <h2 className="text-sm font-semibold text-ink-2">Bank transfers</h2>
      <ul className="mt-2 divide-y divide-rule rounded-xl bg-surface">
        {payouts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-ink-3">🏦</span>
              To ··{p.bankLast4}
            </span>
            <a
              className="font-mono tabular text-ink hover:text-brass"
              target="_blank"
              rel="noreferrer"
              href={`https://explorer.solana.com/tx/${p.transferSig}?cluster=devnet`}
            >
              −{eur(p.eurCents)} ↗
            </a>
            <span className={`text-xs capitalize ${p.status === "arrived" ? "text-good" : p.status === "processing" ? "text-ink-3" : "text-bad"}`}>
              {p.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
