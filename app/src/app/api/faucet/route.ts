/**
 * POST /api/faucet — test money (parameters.md §3c): 100,000 dUSDC once per wallet,
 * then up to 10,000 per 24 h. Wallet-signed (contracts/api.md).
 */
import { err, ok } from "@/lib/api";
import { verifyWalletAuth } from "@/lib/auth";
import { kvGet, kvSet } from "@/lib/kv";
import { ensureAta, keypairFromEnv, serverConnection, usdcMint } from "@/lib/solana";
import { TOKEN_PROGRAM_ID, createMintToInstruction } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";

export const dynamic = "force-dynamic";

const FIRST_CLAIM = 100_000_000_000n; // 100,000 dUSDC
const DAILY = 10_000_000_000n; // 10,000 dUSDC
const DAY_MS = 24 * 60 * 60 * 1000;

interface FaucetState {
  firstClaimAt?: number;
  windowStart: number;
  claimedInWindow: string;
}

export async function POST(request: Request) {
  const auth = verifyWalletAuth(request, "/api/faucet");
  if (!auth.ok) return err(auth.code, auth.message, 401);
  const owner = new PublicKey(auth.wallet);

  const key = `faucet:${auth.wallet}`;
  const now = Date.now();
  const state = (await kvGet<FaucetState>(key)) ?? { windowStart: now, claimedInWindow: "0" };
  if (now - state.windowStart > DAY_MS) {
    state.windowStart = now;
    state.claimedInWindow = "0";
  }

  const first = state.firstClaimAt === undefined;
  const amount = first ? FIRST_CLAIM : DAILY;
  if (!first && BigInt(state.claimedInWindow) >= DAILY) {
    const nextIn = Math.ceil((state.windowStart + DAY_MS - now) / 60000);
    return err("RATE_LIMITED", `Test money refills in ~${nextIn} min.`, 429);
  }

  const connection = serverConnection();
  const faucet = keypairFromEnv("FAUCET_AUTHORITY_SECRET");
  const mint = usdcMint();
  const { ata, createIx } = await ensureAta(connection, faucet.publicKey, mint, owner, TOKEN_PROGRAM_ID);

  const tx = new Transaction();
  if (createIx) tx.add(createIx);
  tx.add(createMintToInstruction(mint, ata, faucet.publicKey, amount, [], TOKEN_PROGRAM_ID));
  tx.feePayer = faucet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  tx.sign(faucet);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  state.firstClaimAt ??= now;
  state.claimedInWindow = (BigInt(state.claimedInWindow) + amount).toString();
  await kvSet(key, state, { ttlSec: 60 * 60 * 24 * 30 });

  return ok({ signature, amount: amount.toString() });
}
