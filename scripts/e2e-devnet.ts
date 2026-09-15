/**
 * End-to-end app test against the local dev server + devnet:
 * faucet → shop buy NVDAx → deposit → borrow → card create → approve limit → purchase → cashback.
 * Prints explorer links. Usage: npx tsx scripts/e2e-devnet.ts   (dev server on :3000 must be running)
 */
import * as anchor from "@anchor-lang/core";
import {
  createAssociatedTokenAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  createApproveInstruction,
  createTransferInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import * as fs from "node:fs";
import * as path from "node:path";
import bs58 from "bs58";

const ROOT = path.resolve(__dirname, "..");
const APP = process.env.APP_URL ?? "http://localhost:3000";
const EXPLORER = "https://explorer.solana.com/tx";

function env(): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of fs.readFileSync(path.join(ROOT, "app", ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function signHeaders(kp: Keypair, route: string): Record<string, string> {
  const timestamp = Date.now().toString();
  const msg = new TextEncoder().encode(`stockcard:${route}:${timestamp}`);
  // keypair.sign is not exposed; sign the auth message with @noble/curves ed25519.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ed25519 } = require("@noble/curves/ed25519.js");
  const sig = ed25519.sign(msg, kp.secretKey.slice(0, 32));
  return {
    "content-type": "application/json",
    "x-wallet": kp.publicKey.toBase58(),
    "x-timestamp": timestamp,
    "x-signature": Buffer.from(sig).toString("base64"),
  };
}

async function api(route: string, kp: Keypair, body: object = {}, method = "POST") {
  const res = await fetch(`${APP}${route}`, { method, headers: signHeaders(kp, route), body: JSON.stringify(body) });
  const json = await res.json();
  if (!json.ok) throw new Error(`${route}: ${json.error?.code} ${json.error?.message}`);
  return json.data;
}

async function apiGet(route: string) {
  const res = await fetch(`${APP}${route}`);
  const json = await res.json();
  if (!json.ok) throw new Error(`${route}: ${json.error?.code} ${json.error?.message}`);
  return json.data;
}

async function main() {
  const e = env();
  const connection = new Connection(e.get("NEXT_PUBLIC_SOLANA_RPC")!, "confirmed");
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(ROOT, ".devnet-wallet.json"), "utf8"))));
  const programId = new PublicKey(e.get("NEXT_PUBLIC_PROGRAM_ID")!);
  const usdcMint = new PublicKey(e.get("NEXT_PUBLIC_USDC_MINT")!);
  const nvdaMint = new PublicKey(e.get("NEXT_PUBLIC_MINT_NVDAX")!);

  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "target", "idl", "stockcard.json"), "utf8"));
  const walletOf = (kp: Keypair) => ({
    publicKey: kp.publicKey,
    signTransaction: async (tx: Transaction) => (tx.partialSign(kp), tx),
    signAllTransactions: async (txs: Transaction[]) => (txs.forEach((t) => t.partialSign(kp)), txs),
  });
  const provider = new anchor.AnchorProvider(connection, walletOf(admin) as never, { commitment: "confirmed" });
  const program = new anchor.Program(idl, provider);

  const user = Keypair.generate();
  console.log("user:", user.publicKey.toBase58());
  const fundSig = await connection.sendTransaction(
    new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user.publicKey, lamports: 80_000_000 })),
    [admin],
  );
  await connection.confirmTransaction(fundSig, "confirmed");

  // 1. faucet
  const faucet = await api("/api/faucet", user);
  console.log("1. faucet 100,000 dUSDC:", `${EXPLORER}/${faucet.signature}?cluster=devnet`);

  // 2. shop: buy $1,000 of NVDAx
  const shop = await apiGet("/api/shop/items");
  const treasury = new PublicKey(shop.treasury);
  const priceRes = await program.account.signedPrice.fetch(
    PublicKey.findProgramAddressSync([Buffer.from("price"), PublicKey.findProgramAddressSync([Buffer.from("market"), nvdaMint.toBuffer()], programId)[0].toBuffer()], programId)[0],
  );
  const price = BigInt(priceRes.price.toString());
  const payAmount = 1_000_000_000n; // $1,000
  const userUsdc = getAssociatedTokenAddressSync(usdcMint, user.publicKey);
  const treasuryAta = getAssociatedTokenAddressSync(usdcMint, treasury);
  const payTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(user.publicKey, treasuryAta, treasury, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createTransferInstruction(userUsdc, treasuryAta, user.publicKey, payAmount, [], TOKEN_PROGRAM_ID),
  );
  payTx.feePayer = user.publicKey;
  payTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  payTx.sign(user);
  const paySig = await connection.sendRawTransaction(payTx.serialize());
  await connection.confirmTransaction(paySig, "confirmed");
  const order = await api("/api/shop/buy", user, { symbol: "NVDAx", amount: payAmount.toString(), paySignature: paySig });
  console.log("2. shop buy NVDAx:", `${EXPLORER}/${order.mintSig}?cluster=devnet`, `(${order.amount} raw)`);

  // 3. deposit all NVDAx
  const userNvda = getAssociatedTokenAddressSync(nvdaMint, user.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const nvdaBal = await connection.getTokenAccountBalance(userNvda);
  const market = PublicKey.findProgramAddressSync([Buffer.from("market"), nvdaMint.toBuffer()], programId)[0];
  const position = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), user.publicKey.toBuffer()], programId)[0];
  const collVault = PublicKey.findProgramAddressSync([Buffer.from("collateral_vault"), market.toBuffer()], programId)[0];
  const userProgram = new anchor.Program(idl, new anchor.AnchorProvider(connection, walletOf(user) as never, { commitment: "confirmed" }));
  const depositSig = await userProgram.methods
    .depositCollateral(new anchor.BN(nvdaBal.value.amount))
    .accounts({
      owner: user.publicKey,
      config: PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0],
      market,
      position,
      collateralMint: nvdaMint,
      ownerToken: userNvda,
      collateralVault: collVault,
      signedPrice: PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], programId)[0],
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .rpc();
  console.log("3. deposit", nvdaBal.value.uiAmount, "NVDAx:", `${EXPLORER}/${depositSig}?cluster=devnet`);

  // 4. borrow $400
  const borrowSig = await userProgram.methods
    .borrow(new anchor.BN(400_000_000))
    .accounts({
      owner: user.publicKey,
      config: PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0],
      market,
      position,
      collateralMint: nvdaMint,
      usdcVault: PublicKey.findProgramAddressSync([Buffer.from("usdc_vault")], programId)[0],
      usdcMint,
      destinationUsdc: userUsdc,
      signedPrice: PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], programId)[0],
      collateralVault: collVault,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("4. borrow $400:", `${EXPLORER}/${borrowSig}?cluster=devnet`);

  // 5. create card + approve limit
  const card = await api("/api/card", user, { holderName: "E2E TEST", network: "VISA" });
  console.log("5. card created: ****", card.last4);
  const cardInfo = await apiGet(`/api/card?owner=${user.publicKey.toBase58()}`);
  const approveTx = new Transaction().add(
    createApproveInstruction(userUsdc, new PublicKey(cardInfo.delegateAuthority), user.publicKey, 500_000_000n, [], TOKEN_PROGRAM_ID),
  );
  approveTx.feePayer = user.publicKey;
  approveTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  approveTx.sign(user);
  const approveSig = await connection.sendRawTransaction(approveTx.serialize());
  await connection.confirmTransaction(approveSig, "confirmed");
  console.log("   limit $500 approved:", `${EXPLORER}/${approveSig}?cluster=devnet`);

  // 6. test purchase $62.15
  const purchase = await api("/api/card/simulate", user, { merchant: "Albert Heijn", category: "Groceries", amountUsd6: "62150000" });
  console.log("6. purchase:", purchase.status, purchase.settlementSig ? `${EXPLORER}/${purchase.settlementSig}?cluster=devnet` : purchase.declineReason);

  // 7. cashback processed inline — check the feed
  await new Promise((r) => setTimeout(r, 4000));
  const txs = await apiGet(`/api/card/transactions?owner=${user.publicKey.toBase58()}`);
  const row = txs.find((t: { id: string }) => t.id === purchase.id);
  console.log("7. cashback:", row?.cashback?.status, row?.cashback?.sig ? `${EXPLORER}/${row.cashback.sig}?cluster=devnet` : row?.cashback);

  // 8. repay all + withdraw all
  const repaySig = await userProgram.methods
    .repay(new anchor.BN("18446744073709551615"))
    .accounts({
      payer: user.publicKey,
      config: PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0],
      market,
      position,
      collateralMint: nvdaMint,
      payerUsdc: userUsdc,
      usdcVault: PublicKey.findProgramAddressSync([Buffer.from("usdc_vault")], programId)[0],
      usdcMint,
      signedPrice: PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], programId)[0],
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("8. repay all:", `${EXPLORER}/${repaySig}?cluster=devnet`);
  const withdrawSig = await userProgram.methods
    .withdrawCollateral(new anchor.BN(nvdaBal.value.amount))
    .accounts({
      owner: user.publicKey,
      config: PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0],
      market,
      position,
      collateralMint: nvdaMint,
      ownerToken: userNvda,
      collateralVault: collVault,
      signedPrice: PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], programId)[0],
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .rpc();
  console.log("9. withdraw all:", `${EXPLORER}/${withdrawSig}?cluster=devnet`);
  console.log("\nE2E PASS");
}

main().catch((e) => {
  console.error("E2E FAIL:", e);
  process.exit(1);
});
