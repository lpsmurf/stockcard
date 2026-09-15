/**
 * POST /api/card — create a card via the active CardProvider (wallet-signed).
 * GET  /api/card?owner= — card + on-chain delegate allowance.
 * PATCH /api/card — status/tier/cashbackMint (wallet-signed).
 */
import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { getCardProvider } from "@/lib/card";
import { MockCardProvider } from "@/lib/card/mock";
import type { Card } from "@/lib/card/provider";
import { keypairFromEnv, usdcBalanceAndDelegate } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

const NETWORKS = ["VISA", "MASTERCARD"] as const;
const TIERS = ["standard", "plus", "black"] as const;
const STATUSES = ["active", "frozen"] as const;

function cashbackMints(): string[] {
  return [
    process.env.NEXT_PUBLIC_MINT_NVDAX,
    process.env.NEXT_PUBLIC_MINT_SPYX,
    process.env.NEXT_PUBLIC_MINT_TIDE,
  ].filter((m): m is string => !!m);
}

async function allowanceFor(owner: PublicKey): Promise<bigint> {
  try {
    const authority = keypairFromEnv("CARD_AUTHORITY_SECRET").publicKey;
    const { delegate, delegatedAmount } = await usdcBalanceAndDelegate(owner);
    return delegate && delegate.equals(authority) ? delegatedAmount : 0n;
  } catch {
    return 0n;
  }
}

export async function POST(request: Request) {
  const auth = verifyWalletAuth(request, "/api/card");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const body = (await request.json().catch(() => null)) as {
    holderName?: unknown;
    network?: unknown;
  } | null;
  const holderName = typeof body?.holderName === "string" ? body.holderName.trim() : "";
  if (!holderName) return err("INVALID", "Cardholder name is required.");
  const network = NETWORKS.includes(body?.network as (typeof NETWORKS)[number])
    ? (body!.network as Card["network"])
    : "VISA";

  const card = await getCardProvider().createCard({ owner: auth.wallet, holderName, network });
  return ok(card, { status: 201 });
}

export async function GET(request: Request) {
  const ownerParam = new URL(request.url).searchParams.get("owner");
  if (!ownerParam) return err("INVALID", "owner query param is required.");
  let owner: PublicKey;
  try {
    owner = new PublicKey(ownerParam);
  } catch {
    return err("INVALID", "owner must be a valid pubkey.");
  }
  const card = await getCardProvider().getCard(ownerParam);
  const allowanceUsd6 = await allowanceFor(owner);
  let delegateAuthority: string | null = null;
  try {
    delegateAuthority = keypairFromEnv("CARD_AUTHORITY_SECRET").publicKey.toBase58();
  } catch {}
  return ok({ card, allowanceUsd6: allowanceUsd6.toString(), delegateAuthority });
}

export async function PATCH(request: Request) {
  const auth = verifyWalletAuth(request, "/api/card");
  if (!auth.ok) return err(auth.code, auth.message, 401);

  const provider = getCardProvider();
  if (!(provider instanceof MockCardProvider)) {
    return err("NOT_IMPLEMENTED", "Card updates aren't implemented for this provider.", 501);
  }
  const card = await provider.getCard(auth.wallet);
  if (!card) return err("NO_CARD", "Create your card first.", 404);

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    tier?: unknown;
    cashbackMint?: unknown;
  } | null;

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return err("INVALID", "status must be active or frozen.");
    }
    card.status = body.status as Card["status"];
  }
  if (body?.tier !== undefined) {
    if (!TIERS.includes(body.tier as (typeof TIERS)[number])) {
      return err("INVALID", "tier must be standard, plus or black.");
    }
    card.tier = body.tier as Card["tier"];
  }
  if (body?.cashbackMint !== undefined) {
    if (typeof body.cashbackMint !== "string" || !cashbackMints().includes(body.cashbackMint)) {
      return err("INVALID", "cashbackMint must be the NVDAx, SPYx or TIDE mint.");
    }
    card.cashbackMint = body.cashbackMint;
  }

  await provider.saveCard(card);
  return ok(card);
}
