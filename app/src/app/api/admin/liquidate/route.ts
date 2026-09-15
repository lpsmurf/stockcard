import { NextRequest, NextResponse } from "next/server";
import * as anchor from "@anchor-lang/core";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

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

/** Devnet-only demo control: run a liquidation as the admin keypair (parameters.md §4). */

function guard(req: NextRequest): NextResponse | null {
  if ((process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") !== "devnet") {
    return NextResponse.json({ ok: false, error: { code: "Forbidden", message: "Devnet only" } }, { status: 403 });
  }
  if (req.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: { code: "Unauthorized", message: "Bad admin token" } }, { status: 401 });
  }
  return null;
}

const pda = (programId: PublicKey, ...seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, programId)[0];

export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const ownerStr = body?.owner as string | undefined;
  const mintStr = body?.mint as string | undefined;
  const repayUsd6 = BigInt(body?.repayUsd6 ?? "0");
  if (!ownerStr || !mintStr || repayUsd6 <= 0n) {
    return NextResponse.json({ ok: false, error: { code: "BadRequest", message: "owner, mint, repayUsd6 required" } }, { status: 400 });
  }

  const admin = Keypair.fromSecretKey(bs58.decode(process.env.ADMIN_SECRET!));
  const connection = new anchor.web3.Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!, "confirmed");
  const provider = new anchor.AnchorProvider(connection, walletOf(admin), { commitment: "confirmed" });
  const idl = (await import("@/lib/idl/stockcard.json")).default;
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const mint = new PublicKey(mintStr);
  const owner = new PublicKey(ownerStr);
  const usdcMint = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
  const mintInfo = await connection.getAccountInfo(mint);
  const tokenProgram = mintInfo && mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const market = pda(program.programId, Buffer.from("market"), mint.toBuffer());
  const collateralVault = pda(program.programId, Buffer.from("collateral_vault"), market.toBuffer());
  const adminUsdc = getAssociatedTokenAddressSync(usdcMint, admin.publicKey);
  const adminCollateral = getAssociatedTokenAddressSync(mint, admin.publicKey, false, tokenProgram);

  const { createAssociatedTokenAccountIdempotentInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    admin.publicKey,
    adminCollateral,
    admin.publicKey,
    mint,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  try {
    const signature = await program.methods
      .liquidate(new anchor.BN(repayUsd6.toString()))
      .accounts({
        liquidator: admin.publicKey,
        config: pda(program.programId, Buffer.from("config")),
        market,
        position: pda(program.programId, Buffer.from("position"), market.toBuffer(), owner.toBuffer()),
        collateralMint: mint,
        liquidatorUsdc: adminUsdc,
        usdcVault: pda(program.programId, Buffer.from("usdc_vault")),
        usdcMint,
        liquidatorCollateral: adminCollateral,
        collateralVault,
        signedPrice: pda(program.programId, Buffer.from("price"), market.toBuffer()),
        collateralTokenProgram: tokenProgram,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions([createAtaIx])
      .rpc();
    return NextResponse.json({ ok: true, data: { signature } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = msg.match(/Error Code: (\w+)/)?.[1] ?? "LiquidationFailed";
    return NextResponse.json({ ok: false, error: { code, message: msg.slice(0, 200) } }, { status: 400 });
  }
}
