import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { PURPOSE_REQUIRED_ABOVE_CENTS, payoutProvider } from "@/lib/payout";

/**
 * POST /api/payouts (wallet-signed) — record a payout after the user's transfer is on-chain.
 * Verifies mint, destination, amount and signer before writing anything. Idempotent by signature.
 * GET  /api/payouts — this wallet's payouts, newest first.
 */

export const dynamic = "force-dynamic";

const PURPOSES = ["car", "home", "tax", "other"];

export async function POST(req: Request) {
  const auth = verifyWalletAuth(req, "/api/payouts");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const body = (await req.json().catch(() => null)) as
    | { quoteId?: string; transferSig?: string; purpose?: string; source?: "borrow" | "balance"; eurCents?: number }
    | null;
  if (!body?.quoteId || !body.transferSig) {
    return err("BAD_REQUEST", "We need the quote and the transaction signature.", 400);
  }
  if (
    Number(body.eurCents ?? 0) > PURPOSE_REQUIRED_ABOVE_CENTS &&
    !PURPOSES.includes((body.purpose ?? "").toLowerCase())
  ) {
    return err("PURPOSE_REQUIRED", "Tell us what this transfer is for: car, home, tax or other.", 400);
  }

  try {
    const payout = await payoutProvider().confirm({
      owner: auth.wallet,
      quoteId: body.quoteId,
      transferSig: body.transferSig,
      purpose: body.purpose?.toLowerCase(),
      borrowed: body.source !== "balance",
    });
    return ok(payout);
  } catch (e) {
    return err("PAYOUT_FAILED", (e as Error).message, 400);
  }
}

export async function GET(req: Request) {
  const auth = verifyWalletAuth(req, "/api/payouts");
  if (!auth.ok) return err(auth.code, auth.message, 401);
  return ok(await payoutProvider().list(auth.wallet));
}
