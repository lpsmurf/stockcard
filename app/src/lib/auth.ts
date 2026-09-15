/**
 * Wallet-signature auth for state-changing routes (contracts/api.md).
 * Headers: x-wallet (base58 pubkey), x-signature (base64 ed25519 over the
 * UTF-8 message `stockcard:{route}:{timestamp}`), x-timestamp (ms, ≤ 5 min old).
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { PublicKey } from "@solana/web3.js";

const MAX_AGE_MS = 5 * 60 * 1000;

export type WalletAuth =
  | { ok: true; wallet: string }
  | { ok: false; code: "UNAUTHORIZED"; message: string };

const DENIED: WalletAuth = {
  ok: false,
  code: "UNAUTHORIZED",
  message: "This wallet isn't allowed to do that.",
};

export function verifyWalletAuth(request: Request, route: string): WalletAuth {
  const wallet = request.headers.get("x-wallet");
  const signature = request.headers.get("x-signature");
  const timestamp = request.headers.get("x-timestamp");
  if (!wallet || !signature || !timestamp) return DENIED;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) return DENIED;

  try {
    const pubkey = new PublicKey(wallet);
    const message = new TextEncoder().encode(`stockcard:${route}:${timestamp}`);
    const sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    if (!ed25519.verify(sig, message, pubkey.toBytes())) return DENIED;
  } catch {
    return DENIED;
  }
  return { ok: true, wallet };
}
