import { Connection, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import fs from "node:fs";
import bs58 from "bs58";
const e = new Map(fs.readFileSync("app/.env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const connection = new Connection(e.get("NEXT_PUBLIC_SOLANA_RPC"), "confirmed");
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(".devnet-wallet.json","utf8"))));
const auths = JSON.parse(fs.readFileSync("scripts/authorities.keypair.json","utf8"));
const tx = new Transaction();
for (const k of ["faucet","card","cashback"]) {
  const kp = Keypair.fromSecretKey(bs58.decode(auths[k]));
  const bal = await connection.getBalance(kp.publicKey);
  console.log(k, kp.publicKey.toBase58(), bal / 1e9, "SOL");
  if (bal < 100_000_000) tx.add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: kp.publicKey, lamports: 200_000_000 }));
}
if (tx.instructions.length) {
  const sig = await connection.sendTransaction(tx, [admin]);
  await connection.confirmTransaction(sig, "confirmed");
  console.log("funded:", sig);
} else console.log("already funded");
