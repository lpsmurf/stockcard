/**
 * Server-side Solana helpers. Imports server env secrets — route handlers only,
 * never client components.
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import { RPC_URL, USDC_MINT } from "./config";

let cached: Connection | null = null;
export function serverConnection(): Connection {
  return (cached ??= new Connection(RPC_URL, "confirmed"));
}

export function keypairFromEnv(name: string): Keypair {
  const secret = process.env[name];
  if (!secret) throw new Error(`Missing server env ${name}`);
  return Keypair.fromSecretKey(bs58.decode(secret));
}

export function usdcMint(): PublicKey {
  return new PublicKey(USDC_MINT);
}

/** dUSDC and CC-* item mints are legacy SPL; equity mocks are Token-2022.
 *  Decide from the mint's on-chain owner instead of trusting config. */
export async function tokenProgramForMint(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info) throw new Error(`Mint ${mint.toBase58()} not found on-chain`);
  return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

/** ATA address + the create instruction if the account does not exist yet. */
export async function ensureAta(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey,
): Promise<{ ata: PublicKey; createIx: ReturnType<typeof createAssociatedTokenAccountInstruction> | null }> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, tokenProgram);
  const existing = await connection.getAccountInfo(ata, "confirmed");
  return {
    ata,
    createIx: existing
      ? null
      : createAssociatedTokenAccountInstruction(payer, ata, owner, mint, tokenProgram),
  };
}

export async function usdcBalanceAndDelegate(owner: PublicKey): Promise<{
  ata: PublicKey;
  balance: bigint;
  delegate: PublicKey | null;
  delegatedAmount: bigint;
}> {
  const connection = serverConnection();
  const mint = usdcMint();
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
  try {
    const account = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
    return {
      ata,
      balance: account.amount,
      delegate: account.delegate ?? null,
      delegatedAmount: account.delegatedAmount,
    };
  } catch {
    return { ata, balance: 0n, delegate: null, delegatedAmount: 0n };
  }
}
