/**
 * POST /api/card/simulate — wallet-signed purchase simulation.
 * Merchant presets (parameters.md §3) or custom merchant+category+amountUsd6.
 * On settle, cashback is queued with a preview per parameters.md §3 tiers.
 */
import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { getCardProvider } from "@/lib/card";
import type { CardTransaction } from "@/lib/card/provider";
import { kvListRead, kvListWrite } from "@/lib/kv";

export const dynamic = "force-dynamic";

const PRESETS: Record<string, { merchant: string; category: string; amountUsd6: bigint }> = {
  coffee: { merchant: "Blue Bottle", category: "Coffee", amountUsd6: 4_800_000n },
  groceries: { merchant: "Albert Heijn", category: "Groceries", amountUsd6: 62_150_000n },
  flight: { merchant: "KLM", category: "Travel", amountUsd6: 389_000_000n },
};

// parameters.md §3 cashback tiers. Top rate applies while month-to-date
// spend is within the cap (the 25%-of-balance cap is not tracked off-chain).
const TIERS = {
  standard: { topBps: 50n, baseBps: 25n, capUsd6: 1_000_000_000n },
  plus: { topBps: 150n, baseBps: 50n, capUsd6: 2_000_000_000n },
  black: { topBps: 250n, baseBps: 75n, capUsd6: 4_000_000_000n },
} as const;

export async function POST(request: Request) {
  const auth = verifyWalletAuth(request, "/api/card/simulate");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const body = (await request.json().catch(() => null)) as {
    preset?: unknown;
    merchant?: unknown;
    category?: unknown;
    amountUsd6?: unknown;
  } | null;

  let merchant: string;
  let category: string;
  let amountUsd6: bigint;
  const preset = typeof body?.preset === "string" ? PRESETS[body.preset] : undefined;
  if (preset) {
    ({ merchant, category, amountUsd6 } = preset);
  } else {
    merchant = typeof body?.merchant === "string" ? body.merchant.trim() : "";
    category = typeof body?.category === "string" ? body.category.trim() : "";
    try {
      amountUsd6 = BigInt(String(body?.amountUsd6 ?? ""));
    } catch {
      return err("INVALID", "amountUsd6 must be an integer string in USD base units.");
    }
    if (!merchant || !category) return err("INVALID", "merchant and category are required.");
    if (amountUsd6! <= 0n) return err("INVALID", "amountUsd6 must be greater than zero.");
  }

  const provider = getCardProvider();
  const tx = await provider.simulatePurchase({ owner: auth.wallet, merchant, category, amountUsd6: amountUsd6! });

  if (tx.status === "settled") {
    const card = await provider.getCard(auth.wallet);
    if (card) {
      const txs = await kvListRead<CardTransaction>(`txs:${auth.wallet}`, 100);
      const now = new Date();
      const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
      const mtdSpend = txs
        .filter((t) => t.status === "settled" && t.createdAt >= monthStart)
        .reduce((sum, t) => sum + BigInt(t.amountUsd6), 0n);
      const tier = TIERS[card.tier];
      const bps = mtdSpend <= tier.capUsd6 ? tier.topBps : tier.baseBps;
      const usd6 = (BigInt(tx.amountUsd6) * bps) / 10_000n;
      if (usd6 > 0n) {
        // Asset quantity is priced and deposited by /api/cashback/process (T037);
        // here we only queue the USD preview.
        tx.cashback = { mint: card.cashbackMint, amount: "0", usd6: usd6.toString(), status: "queued" };
        const updated = txs.map((t) => (t.id === tx.id ? tx : t));
        await kvListWrite(`txs:${auth.wallet}`, updated);

        // process inline (T037): price + deposit_collateral_for
        const origin = new URL(request.url).origin;
        fetch(`${origin}/api/cashback/process`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET}` },
          body: JSON.stringify({ txId: tx.id, owner: auth.wallet }),
        }).catch(() => {});
      }
    }
  }

  return ok(tx);
}
