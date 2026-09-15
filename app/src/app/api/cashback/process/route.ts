/**
 * POST /api/cashback/process — idempotent by txId. Prices the queued cashback USD
 * into the user's chosen asset and deposits it into their collateral position via
 * deposit_collateral_for (cashback authority). Called inline after each settle and
 * safe to retry.
 */
import * as anchor from "@anchor-lang/core";
import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { kvListRead, kvListWrite } from "@/lib/kv";
import { keypairFromEnv, serverConnection, tokenProgramForMint } from "@/lib/solana";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import type { CardTransaction } from "@/lib/card/provider";

/** Minimal signing wallet for AnchorProvider (anchor 1.2 ESM build does not export Wallet). */
function walletOf(kp: Keypair) {
  return {
    publicKey: kp.publicKey,
    signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => {
      (tx as anchor.web3.Transaction).partialSign?.(kp);
      return tx;
    },
    signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
      for (const tx of txs) (tx as anchor.web3.Transaction).partialSign?.(kp);
      return txs;
    },
  };
}

export const dynamic = "force-dynamic";

const DECIMALS_BY_ENV: Record<string, number> = {
  NEXT_PUBLIC_MINT_NVDAX: 8,
  NEXT_PUBLIC_MINT_SPYX: 8,
  NEXT_PUBLIC_MINT_TIDE: 6,
};

export async function POST(request: Request) {
  // wallet-signed OR cron secret (inline server call uses the cron secret)
  const authHeader = request.headers.get("authorization");
  const cronOk = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const auth = verifyWalletAuth(request, "/api/cashback/process");
  if (!cronOk && !auth.ok) return err("UNAUTHORIZED", "This wallet isn't allowed to do that.", 401);

  const body = (await request.json().catch(() => null)) as { txId?: unknown; owner?: unknown } | null;
  const txId = typeof body?.txId === "string" ? body.txId : "";
  if (!txId) return err("INVALID", "txId required.");
  const owner = cronOk ? String(body?.owner ?? "") : auth.ok ? auth.wallet : "";
  if (!owner) return err("INVALID", "owner required.");

  const txs = await kvListRead<CardTransaction>(`txs:${owner}`, 100);
  const tx = txs.find((t) => t.id === txId);
  if (!tx) return err("NOT_FOUND", "Transaction not found.", 404);
  if (tx.status !== "settled") return err("NOT_SETTLED", "Cashback only on settled purchases.");
  if (!tx.cashback || tx.cashback.status === "failed") return err("NO_CASHBACK", "No cashback queued.");
  if (tx.cashback.status === "sent") return ok(tx); // idempotent

  const mintStr = tx.cashback.mint || process.env.NEXT_PUBLIC_MINT_NVDAX;
  if (!mintStr) return err("NOT_CONFIGURED", "Cashback mint not configured.", 500);
  const mint = new PublicKey(mintStr);
  const envKey = Object.keys(DECIMALS_BY_ENV).find((k) => process.env[k] === mintStr);
  const decimals = envKey ? DECIMALS_BY_ENV[envKey] : 8;

  const connection = serverConnection();
  const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
  const market = PublicKey.findProgramAddressSync([Buffer.from("market"), mint.toBuffer()], programId)[0];
  const priceKey = PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], programId)[0];

  // asset qty = usd6 / price (rounded down); skip if < 1 base unit (parameters.md §3)
  const priceInfo = await connection.getAccountInfo(priceKey, "confirmed");
  if (!priceInfo) return err("PRICE_UNAVAILABLE", "Price is updating. Try again in a moment.", 503);
  const price = priceInfo.data.readBigInt64LE(8 + 32);
  const usd6 = BigInt(tx.cashback.usd6);
  const qty = (usd6 * 10n ** BigInt(decimals)) / price;
  if (qty <= 0n) {
    tx.cashback.status = "failed";
    await kvListWrite(`txs:${owner}`, txs.map((t) => (t.id === txId ? tx : t)));
    return ok(tx);
  }

  const cashbackAuthority = keypairFromEnv("CASHBACK_AUTHORITY_SECRET");
  const tokenProgram = await tokenProgramForMint(connection, mint);
  const sourceAta = getAssociatedTokenAddressSync(mint, cashbackAuthority.publicKey, false, tokenProgram);
  const collateralVault = PublicKey.findProgramAddressSync([Buffer.from("collateral_vault"), market.toBuffer()], programId)[0];
  const position = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), new PublicKey(owner).toBuffer()],
    programId,
  )[0];

  const idl = (await import("@/lib/idl/stockcard.json")).default;
  const provider = new anchor.AnchorProvider(connection, walletOf(cashbackAuthority), { commitment: "confirmed" });
  const program = new anchor.Program(idl as anchor.Idl, provider);

  try {
    const sig = await program.methods
      .depositCollateralFor(new PublicKey(owner), new anchor.BN(qty.toString()))
      .accounts({
        authority: cashbackAuthority.publicKey,
        config: PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0],
        market,
        position,
        collateralMint: mint,
        sourceToken: sourceAta,
        collateralVault,
        signedPrice: priceKey,
        tokenProgram,
      })
      .rpc();
    tx.cashback = { ...tx.cashback, amount: qty.toString(), sig, status: "sent" };
  } catch (e) {
    tx.cashback.status = "failed";
    await kvListWrite(`txs:${owner}`, txs.map((t) => (t.id === txId ? tx : t)));
    return err("DEPOSIT_FAILED", e instanceof Error ? e.message.slice(0, 200) : "deposit failed", 500);
  }

  await kvListWrite(`txs:${owner}`, txs.map((t) => (t.id === txId ? tx : t)));
  return ok(tx);
}
