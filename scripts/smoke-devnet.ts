/**
 * P1 smoke run on devnet: fresh wallet -> mint NVDAx (faucet authority) -> deposit 10 ->
 * borrow $500 -> repay all -> withdraw all. Prints explorer links for each step.
 *
 * Usage: npx tsx scripts/smoke-devnet.ts
 */
import * as anchor from "@anchor-lang/core";
import {
  createAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import * as fs from "node:fs";
import * as path from "node:path";
import bs58 from "bs58";

const ROOT = path.resolve(__dirname, "..");

function env(): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of fs.readFileSync(path.join(ROOT, "app", ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

const EXPLORER = "https://explorer.solana.com/tx";
const link = (sig: string) => `${EXPLORER}/${sig}?cluster=devnet`;

async function main() {
  const e = env();
  const connection = new Connection(e.get("NEXT_PUBLIC_SOLANA_RPC")!, "confirmed");
  const admin = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(ROOT, ".devnet-wallet.json"), "utf8"))),
  );
  const faucet = Keypair.fromSecretKey(bs58.decode(e.get("FAUCET_AUTHORITY_SECRET")!));
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "target", "idl", "stockcard.json"), "utf8"));
  const program = new anchor.Program(idl, provider);
  const programId = program.programId;

  const usdcMint = new PublicKey(e.get("NEXT_PUBLIC_USDC_MINT")!);
  const nvdaMint = new PublicKey(e.get("NEXT_PUBLIC_MINT_NVDAX")!);
  const pda = (...s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, programId)[0];
  const config = pda(Buffer.from("config"));
  const usdcVault = pda(Buffer.from("usdc_vault"));
  const market = pda(Buffer.from("market"), nvdaMint.toBuffer());
  const collateralVault = pda(Buffer.from("collateral_vault"), market.toBuffer());
  const price = pda(Buffer.from("price"), market.toBuffer());

  // fresh user wallet, funded with rent SOL from admin
  const user = Keypair.generate();
  console.log("user:", user.publicKey.toBase58());
  const fundTx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user.publicKey, lamports: 50_000_000 }),
  );
  const fundSig = await connection.sendTransaction(fundTx, [admin]);
  await connection.confirmTransaction(fundSig, "confirmed");
  console.log("funded user 0.05 SOL:", link(fundSig));

  const userNvda = await createAssociatedTokenAccount(connection, user, nvdaMint, user.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  const userUsdc = await createAssociatedTokenAccount(connection, user, usdcMint, user.publicKey);

  // faucet: 25 NVDAx + 1,000 dUSDC
  const mintSig = await mintTo(connection, admin, nvdaMint, userNvda, faucet, 25_000_000_000n, [], undefined, TOKEN_2022_PROGRAM_ID);
  console.log("mint 25 NVDAx:", link(mintSig));
  await mintTo(connection, admin, usdcMint, userUsdc, faucet, 1_000_000_000n);

  const depositSig = await program.methods
    .depositCollateral(new anchor.BN(1_000_000_000))
    .accounts({
      owner: user.publicKey,
      config,
      market,
      position: pda(Buffer.from("position"), market.toBuffer(), user.publicKey.toBuffer()),
      collateralMint: nvdaMint,
      ownerToken: userNvda,
      collateralVault,
      signedPrice: price,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([user])
    .rpc();
  console.log("deposit 10 NVDAx:", link(depositSig));

  const borrowSig = await program.methods
    .borrow(new anchor.BN(500_000_000))
    .accounts({
      owner: user.publicKey,
      config,
      market,
      position: pda(Buffer.from("position"), market.toBuffer(), user.publicKey.toBuffer()),
      collateralMint: nvdaMint,
      usdcVault,
      usdcMint,
      destinationUsdc: userUsdc,
      signedPrice: price,
      collateralVault,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([user])
    .rpc();
  console.log("borrow $500:", link(borrowSig));

  const repaySig = await program.methods
    .repay(new anchor.BN("18446744073709551615"))
    .accounts({
      payer: user.publicKey,
      config,
      market,
      position: pda(Buffer.from("position"), market.toBuffer(), user.publicKey.toBuffer()),
      collateralMint: nvdaMint,
      payerUsdc: userUsdc,
      usdcVault,
      usdcMint,
      signedPrice: price,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([user])
    .rpc();
  console.log("repay all:", link(repaySig));

  const withdrawSig = await program.methods
    .withdrawCollateral(new anchor.BN(1_000_000_000))
    .accounts({
      owner: user.publicKey,
      config,
      market,
      position: pda(Buffer.from("position"), market.toBuffer(), user.publicKey.toBuffer()),
      collateralMint: nvdaMint,
      ownerToken: userNvda,
      collateralVault,
      signedPrice: price,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([user])
    .rpc();
  console.log("withdraw all:", link(withdrawSig));

  const nvdaBal = await connection.getTokenAccountBalance(userNvda);
  console.log("\nfinal NVDAx balance:", nvdaBal.value.uiAmount, "(expect 25)");
  console.log("SMOKE PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
