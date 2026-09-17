/**
 * End-to-end API check against the deployed StockCard app.
 * Faucets test dUSDC, approves the card delegate, buys a mock stock in the shop,
 * creates a mock card, simulates a purchase, and verifies the transaction list.
 *
 * Usage: cd app && node scripts/e2e-api.mjs
 */
import { readFileSync } from "node:fs";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  createApproveInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";

// Load .env.local without pulling in dotenv.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const APP_URL = process.env.APP_URL ?? "https://stockcard-app.vercel.app";
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT);
const SHOP_TREASURY = new PublicKey(process.env.SHOP_TREASURY_ADDRESS);
const CARD_AUTHORITY = Keypair.fromSecretKey(bs58.decode(process.env.CARD_AUTHORITY_SECRET)).publicKey;
const PAYOUT_ADDRESS = new PublicKey(process.env.PAYOUT_ADDRESS);

const connection = new Connection(RPC, "confirmed");
const wallet = Keypair.generate();
const owner = wallet.publicKey;

async function authHeaders(route) {
  const ts = Date.now();
  const msg = new TextEncoder().encode(`stockcard:${route}:${ts}`);
  const sig = ed25519.sign(msg, wallet.secretKey.slice(0, 32));
  return {
    "x-wallet": owner.toBase58(),
    "x-signature": Buffer.from(sig).toString("base64"),
    "x-timestamp": String(ts),
    "content-type": "application/json",
  };
}

async function post(route, body = {}) {
  const res = await fetch(`${APP_URL}${route}`, {
    method: "POST",
    headers: await authHeaders(route),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${route}: ${json.error?.message ?? res.status}`);
  return json.data;
}

async function main() {
  console.log(`wallet ${owner.toBase58()}`);

  // Devnet airdrop is rate-limited; fund the test wallet from the repo's devnet admin wallet.
  const adminSecret = JSON.parse(readFileSync(new URL("../../.devnet-wallet.json", import.meta.url), "utf8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(adminSecret));
  const fundTx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: owner, lamports: 100_000_000 }),
  );
  fundTx.feePayer = admin.publicKey;
  fundTx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  fundTx.sign(admin);
  const fundSig = await connection.sendRawTransaction(fundTx.serialize());
  await connection.confirmTransaction(fundSig, "confirmed");
  console.log("funded test wallet", fundSig);

  const faucet = await post("/api/faucet");
  console.log("faucet", faucet.amount, faucet.signature);

  // Approve the card authority to spend dUSDC (the "set card limit" step).
  const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, owner);
  const approveTx = new Transaction().add(
    createApproveInstruction(usdcAta, CARD_AUTHORITY, owner, 1_000_000_000n, [], TOKEN_PROGRAM_ID),
  );
  approveTx.feePayer = owner;
  approveTx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  approveTx.sign(wallet);
  const approveSig = await connection.sendRawTransaction(approveTx.serialize());
  await connection.confirmTransaction(approveSig, "confirmed");
  console.log("approved card delegate", approveSig);

  // Bank flow: add IBAN, quote, transfer USDC to the payout ATA, confirm.
  const account = await post("/api/bank-accounts", { holderName: "Demo User", iban: "NL91ABNA0417164300" });
  console.log("bank account", account.id, account.last4);

  const quote = await post("/api/payouts/quote", { bankAccountId: account.id, eurCents: 5_000, source: "balance" });
  console.log("quote", quote.quoteId, `${quote.eurCents / 100} EUR -> ${quote.usdc6} USDC6`);

  const payoutAta = getAssociatedTokenAddressSync(USDC_MINT, PAYOUT_ADDRESS);
  const payoutTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(owner, payoutAta, PAYOUT_ADDRESS, USDC_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createTransferInstruction(usdcAta, payoutAta, owner, BigInt(quote.usdc6), [], TOKEN_PROGRAM_ID),
  );
  payoutTx.feePayer = owner;
  payoutTx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  payoutTx.sign(wallet);
  const transferSig = await connection.sendRawTransaction(payoutTx.serialize());
  await connection.confirmTransaction(transferSig, "confirmed");
  console.log("payout transfer", transferSig);

  const payout = await post("/api/payouts", { quoteId: quote.quoteId, transferSig, source: "balance" });
  console.log("payout", payout.status, payout.sepaReference, `${payout.receiveCents / 100} EUR`);

  // Buy $50 of NVDAx in the demo shop.
  const amount = 50_000_000n;
  const toAta = getAssociatedTokenAddressSync(USDC_MINT, SHOP_TREASURY);
  const payTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(owner, toAta, SHOP_TREASURY, USDC_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createTransferInstruction(usdcAta, toAta, owner, amount, [], TOKEN_PROGRAM_ID),
  );
  payTx.feePayer = owner;
  payTx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  payTx.sign(wallet);
  const paySig = await connection.sendRawTransaction(payTx.serialize());
  await connection.confirmTransaction(paySig, "confirmed");
  console.log("shop payment", paySig);

  const buy = await post("/api/shop/buy", { symbol: "NVDAx", amount: amount.toString(), paySignature: paySig });
  console.log("bought", buy.amount, "NVDAx", buy.mintSig);

  const card = await post("/api/card", { holderName: "Demo User", network: "VISA" });
  console.log("card", card.last4, card.provider, card.tier);

  const sim = await post("/api/card/simulate", { preset: "coffee" });
  console.log("simulated purchase", sim.status, sim.merchant, sim.amountUsd6);

  const txs = await fetch(`${APP_URL}/api/card/transactions?owner=${owner.toBase58()}`).then((r) => r.json());
  console.log("transactions", txs.data?.length ?? 0, txs.data?.[0]?.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
