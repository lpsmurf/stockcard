import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { payoutProvider, type Tier } from "@/lib/payout";

/**
 * POST /api/payouts/quote (wallet-signed) — rate, fees, "you receive", and the address to send
 * the USDC to. Valid 60 s (parameters.md §3d).
 */

export const dynamic = "force-dynamic";

const TIERS: Tier[] = ["standard", "plus", "black"];

export async function POST(req: Request) {
  const auth = verifyWalletAuth(req, "/api/payouts/quote");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const body = (await req.json().catch(() => null)) as
    | { bankAccountId?: string; eurCents?: number; source?: "borrow" | "balance"; tier?: string }
    | null;
  if (!body?.bankAccountId) return err("BAD_REQUEST", "Pick one of your saved bank accounts.", 400);
  if (!Number.isFinite(body.eurCents)) return err("BAD_REQUEST", "Enter how much you want to send.", 400);

  const tier = TIERS.includes(body.tier as Tier) ? (body.tier as Tier) : "standard";
  try {
    const quote = await payoutProvider().quote({
      owner: auth.wallet,
      bankAccountId: body.bankAccountId,
      eurCents: Math.round(body.eurCents as number),
      tier,
    });
    return ok(quote);
  } catch (e) {
    return err("QUOTE_FAILED", (e as Error).message, 400);
  }
}
