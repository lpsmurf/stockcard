import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { payoutProvider } from "@/lib/payout";

/** DELETE /api/bank-accounts/:id — forget a saved IBAN (wallet-signed). */

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = verifyWalletAuth(req, "/api/bank-accounts");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const { id } = await ctx.params;
  const removed = await payoutProvider().removeBankAccount(auth.wallet, id);
  if (!removed) return err("NOT_FOUND", "We don't have that bank account saved.", 404);
  return ok({ removed: true });
}
