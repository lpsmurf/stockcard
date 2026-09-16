import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { payoutProvider } from "@/lib/payout";

/**
 * GET  /api/bank-accounts  — saved IBANs, masked (wallet-signed)
 * POST /api/bank-accounts  — save one (wallet-signed). FR-080: mod-97 + SEPA country check.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyWalletAuth(req, "/api/bank-accounts");
  if (!auth.ok) return err(auth.code, auth.message, 401);
  return ok(await payoutProvider().listBankAccounts(auth.wallet));
}

export async function POST(req: Request) {
  const auth = verifyWalletAuth(req, "/api/bank-accounts");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const body = (await req.json().catch(() => null)) as { holderName?: string; iban?: string; bic?: string } | null;
  if (!body?.iban) return err("BAD_REQUEST", "Enter the IBAN of the account you want the money in.", 400);

  try {
    const account = await payoutProvider().addBankAccount({
      owner: auth.wallet,
      holderName: body.holderName ?? "",
      iban: body.iban,
      bic: body.bic,
    });
    return ok(account);
  } catch (e) {
    return err("INVALID_BANK_ACCOUNT", (e as Error).message, 400);
  }
}
