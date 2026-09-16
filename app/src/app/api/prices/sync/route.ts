import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { err, ok } from "@/lib/api";
import { kvGet, kvSet } from "@/lib/kv";
import { MARKETS, RPC_URL, marketMint } from "@/lib/config";
import { MAINNET_MINTS, decide, readSources, type SignerDecision } from "@/lib/prices/signer";
import { parseFeedOverrides, readPyth } from "@/lib/prices/pyth";
import { readPreIpo } from "@/lib/prices/preipo";

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

/** Keep one point per symbol per hour for /api/prices/history (90-day window). */
async function recordHistory(symbol: string, price: number) {
  try {
    const key = `pricehist:${symbol}`;
    const series = (await kvGet<[number, number][]>(key)) ?? [];
    const now = Date.now();
    const last = series[series.length - 1];
    if (last && now - last[0] < 3_600_000) return;
    const cutoff = now - 90 * 86_400_000;
    const next = [...series.filter(([t]) => t >= cutoff), [now, Math.round(price * 100) / 100] as [number, number]];
    await kvSet(key, next);
  } catch {
    // history is best-effort; never fail a price post because of it
  }
}

function pda(programId: PublicKey, ...seeds: Buffer[]) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("UNAUTHORIZED", "Bad cron secret.", 401);
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  // Pyth is an extra source, never a hard dependency: without PYTH_API_KEY this returns {}.
  const pyth: Awaited<ReturnType<typeof readPyth>> = await readPyth(
    SIGNED_SYMBOLS,
    fetch,
    process.env.PYTH_API_KEY,
    parseFeedOverrides(process.env.PYTH_FEED_IDS),
  ).catch(() => ({}));
  // Pre-IPO markets price off their issuer's public API (Tessera, PreStocks); keyless.
  const preIpo = await readPreIpo(SIGNED_SYMBOLS, fetch).catch(() => ({}));
  const readings = await readSources(SIGNED_SYMBOLS, fetch, process.env.JUPITER_API_KEY, pyth, preIpo);

  const posted: { symbol: string; price: number; priceE6: number; spreadBps: number | null; sources?: string[]; sig?: string; note?: string }[] = [];
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
      posted.push({ symbol: decision.symbol, price: decision.price, priceE6: decision.priceE6, spreadBps: decision.spreadBps, sources: decision.sources, sig, note: decision.note });
      await recordHistory(decision.symbol, decision.price);
    } catch (e) {
      skipped.push({ symbol: decision.symbol, reason: `post failed: ${(e as Error).message.slice(0, 160)}` });
    }
  }

  // Surface Pyth's state so "why isn't Pyth contributing?" is answerable without reading logs.
  const pythSymbols = Object.keys(pyth);
  const pythStatus = pythSymbols.length
    ? {
        feeds: pythSymbols.length,
        prices: pythSymbols.filter((s) => pyth[s].reading).length,
        entitled: pythSymbols.every((s) => pyth[s].entitled),
        marketOpen: pyth[pythSymbols[0]].marketOpen,
        note: pythSymbols.every((s) => pyth[s].entitled)
          ? undefined
          : "Key has no equity price grant (Pyth Pro); using Pyth market hours only.",
      }
    : { feeds: 0, prices: 0, entitled: false, marketOpen: null, note: "PYTH_API_KEY not set" };

  return ok({ posted, skipped, dryRun, pyth: pythStatus });
}
