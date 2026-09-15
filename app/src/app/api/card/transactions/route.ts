import { err, ok } from "@/lib/api";
import { getCardProvider } from "@/lib/card";
import { PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

/** GET /api/card/transactions?owner= — newest first. Read-only (no signature; the feed is public-by-wallet like on-chain data). */
export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get("owner");
  if (!owner) return err("INVALID", "owner query param is required.");
  try {
    new PublicKey(owner);
  } catch {
    return err("INVALID", "owner must be a valid pubkey.");
  }
  const txs = await getCardProvider().listTransactions(owner);
  return ok(txs);
}
