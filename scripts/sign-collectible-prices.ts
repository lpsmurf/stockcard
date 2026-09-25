/**
 * T054 — collectible price signer (devnet).
 * For every PartnerFmv (CC-*) market, resolve the insured value and post it as a signed
 * price with the `partnerFmv` source. The insured value comes from a real Collector Crypt
 * card when `CC_DISPLAY_MINT_<SYMBOL>` is set (mock devnet mint mapped to a real card for
 * display, per tasks.md); otherwise the config.ts `insuredValueUsd6` fallback is used.
 *
 * Default is a dry run that only prints what would be posted. Pass --send to actually
 * submit set_signed_price transactions to devnet.
 *
 *   npx tsx scripts/sign-collectible-prices.ts           # dry run
 *   npx tsx scripts/sign-collectible-prices.ts --send    # post prices
 */
import * as anchor from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
const EXPO = -6;
const SEND = process.argv.includes("--send");

interface CollectibleSpec {
  symbol: string;
  mintEnvKey: string;
  insuredValueUsd6: bigint;
}

// Mirrors config.ts CC-* markets (kept inline so the script has no app imports).
const COLLECTIBLES: CollectibleSpec[] = [
  { symbol: "CC-LUGIA", mintEnvKey: "NEXT_PUBLIC_MINT_CC_LUGIA", insuredValueUsd6: 54_000_000_000n },
  { symbol: "CC-RAYQUAZA", mintEnvKey: "NEXT_PUBLIC_MINT_CC_RAYQUAZA", insuredValueUsd6: 13_000_000_000n },
  { symbol: "CC-MEW", mintEnvKey: "NEXT_PUBLIC_MINT_CC_MEW", insuredValueUsd6: 5_500_000_000n },
  { symbol: "CC-DAYTONA", mintEnvKey: "NEXT_PUBLIC_MINT_CC_DAYTONA", insuredValueUsd6: 74_200_000_000n },
  { symbol: "CC-ROYALOAK", mintEnvKey: "NEXT_PUBLIC_MINT_CC_ROYALOAK", insuredValueUsd6: 51_315_000_000n },
  { symbol: "CC-SEAMASTER", mintEnvKey: "NEXT_PUBLIC_MINT_CC_SEAMASTER", insuredValueUsd6: 10_600_000_000n },
];

function readEnvFile(): Map<string, string> {
  const env = new Map<string, string>();
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, "app", file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env.has(m[1])) env.set(m[1], m[2]);
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !env.has(k)) env.set(k, v);
  return env;
}

/** Fetch insuredValue from a real Collector Crypt card (devnet API). Never throws. */
async function ccInsuredValueUsd(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`https://dev-api.collectorcrypt.com/cards/publicNft/${encodeURIComponent(mint)}`, {
      headers: { Accept: "application/json", "User-Agent": "stockcard-demo/1.0 (hackathon; not affiliated)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const card = (await res.json()) as { insuredValue?: string };
    const n = Number(card.insuredValue);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function main() {
  const env = readEnvFile();
  const admin = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(ROOT, ".devnet-wallet.json"), "utf8"))),
  );
  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "target", "idl", "stockcard.json"), "utf8"));
  const program = new anchor.Program(idl, provider);
  const programId: PublicKey = program.programId;

  const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
  const configPda = pda(Buffer.from("config"));

  console.log(SEND ? "Posting collectible prices to devnet…" : "DRY RUN (pass --send to post prices)\n");

  for (const spec of COLLECTIBLES) {
    const mintStr = env.get(spec.mintEnvKey);
    if (!mintStr) {
      console.log(`${spec.symbol}: skipped (no ${spec.mintEnvKey})`);
      continue;
    }

    // Devnet mock: map the mock mint to a real Collector Crypt card for display.
    const ccMint = env.get(`CC_DISPLAY_MINT_${spec.symbol.replace(/-/g, "_")}`);
    let priceUsd6 = spec.insuredValueUsd6;
    let origin = "config fallback";
    if (ccMint) {
      const insured = await ccInsuredValueUsd(ccMint);
      if (insured !== null) {
        priceUsd6 = BigInt(Math.round(insured * 1e6));
        origin = `Collector Crypt insuredValue (${ccMint})`;
      } else {
        origin = "config fallback (Collector Crypt unreachable)";
      }
    }

    const priceUsd = Number(priceUsd6) / 1e6;
    console.log(`${spec.symbol}: $${priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })} — ${origin}`);
    if (!SEND) continue;

    const mint = new PublicKey(mintStr);
    const market = pda(Buffer.from("market"), mint.toBuffer());
    const signedPrice = pda(Buffer.from("price"), market.toBuffer());
    const sig = await program.methods
      .setSignedPrice(new anchor.BN(priceUsd6.toString()), EXPO, { partnerFmv: {} })
      .accounts({ signer: admin.publicKey, config: configPda, market, signedPrice })
      .rpc();
    console.log(`  tx: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
