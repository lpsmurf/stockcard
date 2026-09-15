/**
 * POST /api/shop/buy — verify a dUSDC payment to the shop treasury, then mint the
 * purchased mock token (parameters.md §3c). Idempotent by paySignature.
 */
import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { kvGet, kvListPush, kvListRead, kvSet } from "@/lib/kv";
import { ensureAta, keypairFromEnv, serverConnection, tokenProgramForMint, usdcMint } from "@/lib/solana";
import { createMintToInstruction } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import items from "@/lib/shop-items.json";

export const dynamic = "force-dynamic";

interface ShopOrder {
  id: string;
  kind: string;
  symbol: string;
  amount: string; // tokens minted, base units
  priceUsd6: string; // dUSDC paid
  paySig: string;
  mintSig?: string;
  status: "paid" | "minted" | "failed";
  createdAt: number;
}

const MINT_ENV: Record<string, string> = {
  NVDAx: "NEXT_PUBLIC_MINT_NVDAX",
  SPYx: "NEXT_PUBLIC_MINT_SPYX",
  TSLAx: "NEXT_PUBLIC_MINT_TSLAX",
  SPCX: "NEXT_PUBLIC_MINT_SPCX",
  TIDE: "NEXT_PUBLIC_MINT_TIDE",
  "CC-LUGIA": "NEXT_PUBLIC_MINT_CC_LUGIA",
  "CC-RAYQUAZA": "NEXT_PUBLIC_MINT_CC_RAYQUAZA",
  "CC-MEW": "NEXT_PUBLIC_MINT_CC_MEW",
  "CC-DAYTONA": "NEXT_PUBLIC_MINT_CC_DAYTONA",
  "CC-ROYALOAK": "NEXT_PUBLIC_MINT_CC_ROYALOAK",
  "CC-SEAMASTER": "NEXT_PUBLIC_MINT_CC_SEAMASTER",
};

const DECIMALS: Record<string, number> = { NVDAx: 8, SPYx: 8, TSLAx: 8, SPCX: 6, TIDE: 6 };

async function signedPriceUsd6(symbol: string, programId: PublicKey, mint: PublicKey): Promise<bigint | null> {
  const connection = serverConnection();
  const market = PublicKey.findProgramAddressSync([Buffer.from("market"), mint.toBuffer()], programId)[0];
  const priceKey = PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], programId)[0];
  const info = await connection.getAccountInfo(priceKey, "confirmed");
  if (!info) return null;
  // SignedPrice: disc 8 | market 32 | price i64 | expo i32 | publish_time i64 | source 1
  const price = info.data.readBigInt64LE(8 + 32);
  return price;
}

export async function POST(request: Request) {
  const auth = verifyWalletAuth(request, "/api/shop/buy");
  if (!auth.ok) return err(auth.code, auth.message, 401);
  const owner = new PublicKey(auth.wallet);

  const body = (await request.json().catch(() => null)) as { symbol?: unknown; amount?: unknown; paySignature?: unknown } | null;
  const symbol = typeof body?.symbol === "string" ? body.symbol : "";
  const paySig = typeof body?.paySignature === "string" ? body.paySignature : "";
  const item = items.find((i) => i.symbol === symbol);
  if (!item) return err("INVALID", "Unknown shop item.");
  if (!paySig) return err("INVALID", "paySignature required.");

  // Idempotent: same payment signature returns the existing order.
  const existing = await kvGet<ShopOrder>(`shop:pay:${paySig}`);
  if (existing) return ok(existing);

  let paid: bigint;
  try {
    paid = BigInt(String(body?.amount ?? ""));
  } catch {
    return err("INVALID", "amount must be an integer string in dUSDC base units.");
  }
  if (paid <= 0n) return err("INVALID", "amount must be positive.");

  const mintStr = process.env[MINT_ENV[symbol]];
  if (!mintStr) return err("NOT_SEEDED", `${symbol} mint not configured.`, 500);
  const mint = new PublicKey(mintStr);
  const treasury = new PublicKey(process.env.SHOP_TREASURY_ADDRESS ?? "");

  const connection = serverConnection();

  // Verify the payment: treasury dUSDC balance increased by exactly `paid` in paySig.
  const parsed = await connection.getParsedTransaction(paySig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!parsed || parsed.meta?.err) return err("PAYMENT_NOT_FOUND", "Payment transaction not found or failed.");
  const usdc = usdcMint().toBase58();
  const pre = parsed.meta?.preTokenBalances?.find((b) => b.mint === usdc && b.owner === treasury.toBase58());
  const post = parsed.meta?.postTokenBalances?.find((b) => b.mint === usdc && b.owner === treasury.toBase58());
  const delta = BigInt(post?.uiTokenAmount.amount ?? "0") - BigInt(pre?.uiTokenAmount.amount ?? "0");
  if (delta !== paid) return err("PAYMENT_MISMATCH", "Paid amount doesn't match the order.");
  const ownerPre = parsed.meta?.preTokenBalances?.find((b) => b.mint === usdc && b.owner === auth.wallet);
  const ownerPost = parsed.meta?.postTokenBalances?.find((b) => b.mint === usdc && b.owner === auth.wallet);
  if (!ownerPre || !ownerPost || BigInt(ownerPre.uiTokenAmount.amount) - BigInt(ownerPost.uiTokenAmount.amount) !== paid) {
    return err("PAYMENT_MISMATCH", "Payment didn't come from your wallet.");
  }

  // Compute quantity.
  const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
  let qty: bigint;
  if (item.kind === "item") {
    const orders = await kvListRead<ShopOrder>(`shop:${auth.wallet}`);
    if (orders.some((o) => o.symbol === symbol && o.status !== "failed")) {
      return err("ONE_PER_WALLET", "One per wallet for mirrored items.");
    }
    if (paid !== BigInt(item.priceUsd6!)) return err("PAYMENT_MISMATCH", `Item price is exactly ${item.priceUsd6} base units.`);
    qty = 1n;
  } else {
    const price = item.kind === "stock" ? await signedPriceUsd6(symbol, programId, mint) : BigInt(item.priceUsd6!);
    if (!price || price <= 0n) return err("PRICE_UNAVAILABLE", "Price is updating. Try again in a moment.", 503);
    if (paid < 10_000_000n) return err("MIN_AMOUNT", "Minimum purchase is $10.");
    qty = (paid * 10n ** BigInt(DECIMALS[symbol] ?? 6)) / price;
    if (item.kind === "art" && qty < 10_000_000n) return err("MIN_AMOUNT", "Minimum 10 TIDE notes.");
    if (qty <= 0n) return err("MIN_AMOUNT", "Amount buys less than one token unit.");
  }

  const order: ShopOrder = {
    id: paySig.slice(0, 16),
    kind: item.kind,
    symbol,
    amount: qty.toString(),
    priceUsd6: paid.toString(),
    paySig,
    status: "paid",
    createdAt: Date.now(),
  };
  await kvSet(`shop:pay:${paySig}`, order, { ttlSec: 60 * 60 * 24 * 30 });

  // Mint the purchased token to the buyer.
  try {
    const faucet = keypairFromEnv("FAUCET_AUTHORITY_SECRET");
    const tokenProgram = await tokenProgramForMint(connection, mint);
    const { ata, createIx } = await ensureAta(connection, faucet.publicKey, mint, owner, tokenProgram);
    const tx = new Transaction();
    if (createIx) tx.add(createIx);
    tx.add(createMintToInstruction(mint, ata, faucet.publicKey, qty, [], tokenProgram));
    tx.feePayer = faucet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.sign(faucet);
    order.mintSig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(order.mintSig, "confirmed");
    order.status = "minted";
  } catch (e) {
    order.status = "failed";
    await kvSet(`shop:pay:${paySig}`, order);
    await kvListPush(`shop:${auth.wallet}`, order);
    return err("MINT_FAILED", e instanceof Error ? e.message.slice(0, 200) : "mint failed", 500);
  }

  await kvSet(`shop:pay:${paySig}`, order);
  await kvListPush(`shop:${auth.wallet}`, order);
  return ok(order);
}
