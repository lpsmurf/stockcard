import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { err, ok } from "@/lib/api";
import { MARKETS, RPC_URL, marketMint } from "@/lib/config";
import { MAINNET_MINTS, decide, readSources, type SignerDecision } from "@/lib/prices/signer";

/**
 * Price signer (T029a, parameters.md "Price signer"). Called by QStash every 60 s.
 * Header `authorization: Bearer CRON_SECRET`. `?dryRun=1` reads sources and returns the decisions without posting.
 */

export const dynamic = "force-dynamic";

const SIGNED_SYMBOLS = MARKETS.filter((m) => m.priceSource === "Market" && MAINNET_MINTS[m.symbol]).map((m) => m.symbol);

/** Minimal Anchor wallet for a server keypair (`anchor.Wallet` isn't in the ESM build Next.js bundles). */
function keypairWallet(kp: Keypair) {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => sign(tx),
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => txs.map(sign),
  };
}

function pda(programId: PublicKey, ...seeds: Buffer[]) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("UNAUTHORIZED", "Bad cron secret.", 401);
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  const readings = await readSources(SIGNED_SYMBOLS, fetch, process.env.JUPITER_API_KEY);

  const posted: { symbol: string; price: number; priceE6: number; spreadBps: number | null; sig?: string; note?: string }[] = [];
  const skipped: { symbol: string; reason: string }[] = [];

  let program: anchor.Program | null = null;
  let admin: Keypair | null = null;
  if (process.env.NEXT_PUBLIC_PROGRAM_ID && process.env.ADMIN_SECRET) {
    admin = Keypair.fromSecretKey(bs58.decode(process.env.ADMIN_SECRET));
    const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
    const provider = new anchor.AnchorProvider(connection, keypairWallet(admin), { commitment: "confirmed" });
    const idl = (await import("@/lib/idl/stockcard.json")).default;
    program = new anchor.Program(idl as anchor.Idl, provider);
  }

  for (const reading of readings) {
    const info = MARKETS.find((m) => m.symbol === reading.symbol)!;
    const mintStr = marketMint(info);

    let lastSource: string | null = null;
    let market: PublicKey | null = null;
    if (program && mintStr) {
      market = pda(program.programId, Buffer.from("market"), new PublicKey(mintStr).toBuffer());
      try {
        // Account namespace keys are camelCase in the generated client.
        const accounts = program.account as unknown as Record<string, { fetchNullable: (k: PublicKey) => Promise<{ source: Record<string, unknown> } | null> }>;
        const current = await accounts.signedPrice.fetchNullable(pda(program.programId, Buffer.from("price"), market.toBuffer()));
        lastSource = current ? Object.keys(current.source)[0] ?? null : null;
      } catch {
        lastSource = null;
      }
    }

    const decision: SignerDecision = decide(reading, lastSource, Date.now());
    if (decision.action === "skip") {
      skipped.push({ symbol: decision.symbol, reason: decision.reason });
      continue;
    }
    if (dryRun || !program || !admin || !market) {
      posted.push({ ...decision, note: [decision.note, dryRun ? "dry run" : "program or ADMIN_SECRET not configured"].filter(Boolean).join("; ") });
      continue;
    }
    try {
      const sig = await program.methods
        .setSignedPrice(new anchor.BN(decision.priceE6), -6, { market: {} })
        .accounts({
          signer: admin.publicKey,
          config: pda(program.programId, Buffer.from("config")),
          market,
          signedPrice: pda(program.programId, Buffer.from("price"), market.toBuffer()),
        })
        .rpc();
      posted.push({ symbol: decision.symbol, price: decision.price, priceE6: decision.priceE6, spreadBps: decision.spreadBps, sig, note: decision.note });
    } catch (e) {
      skipped.push({ symbol: decision.symbol, reason: `post failed: ${(e as Error).message.slice(0, 160)}` });
    }
  }

  return ok({ posted, skipped, dryRun });
}
