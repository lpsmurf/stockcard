import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { addSubscription, removeSubscription, type StoredSubscription } from "@/lib/push";

/**
 * POST /api/push/subscribe  — register this device (wallet-signed)
 * DELETE /api/push/subscribe — remove one endpoint (wallet-signed)
 * contracts/api.md · data-model.md "PushSubscription"
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyWalletAuth(req, "/api/push/subscribe");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const body = (await req.json().catch(() => null)) as { subscription?: unknown } | null;
  const sub = body?.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return err("BAD_REQUEST", "That push subscription is missing its endpoint or keys.", 400);
  }

  const stored: StoredSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    createdAt: Date.now(),
  };
  const devices = await addSubscription(auth.wallet, stored);
  return ok({ id: stored.endpoint.slice(-24), devices });
}

export async function DELETE(req: Request) {
  const auth = verifyWalletAuth(req, "/api/push/subscribe");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return err("BAD_REQUEST", "Tell us which endpoint to remove.", 400);

  const removed = await removeSubscription(auth.wallet, body.endpoint);
  return ok({ removed });
}
