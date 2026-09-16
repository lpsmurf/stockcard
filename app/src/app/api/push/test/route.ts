import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { sendToOwner } from "@/lib/push";

/** POST /api/push/test — "Notifications are on" to the caller's devices (wallet-signed). */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyWalletAuth(req, "/api/push/test");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const result = await sendToOwner(auth.wallet, {
    title: "Notifications are on",
    body: "We'll warn you before your position can be liquidated.",
    market: "",
    band: "healthy",
    url: "/",
  });
  return ok(result);
}
