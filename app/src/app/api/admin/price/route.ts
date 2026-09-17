import { NextRequest, NextResponse } from "next/server";
import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { MARKETS, marketMint } from "@/lib/config";
import { kvGet, kvSet } from "@/lib/kv";

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

/** Devnet-only demo control: crash (−30%) or restore a signed market price (parameters.md §4). */

function guard(req: NextRequest): NextResponse | null {
  if ((process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") !== "devnet") {
    return NextResponse.json({ ok: false, error: { code: "Forbidden", message: "Devnet only" } }, { status: 403 });
  }
  if (req.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: { code: "Unauthorized", message: "Bad admin token" } }, { status: 401 });
  }
  return null;
}

function marketPda(programId: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("market"), mint.toBuffer()], programId)[0];
}
function pricePda(programId: PublicKey, market: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("price"), market.toBuffer()], programId)[0];
}
function configPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}

export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const mintStr = body?.mint as string | undefined;
  if (!mintStr) {
    return NextResponse.json({ ok: false, error: { code: "BadRequest", message: "mint required" } }, { status: 400 });
  }

  let priceUsd: number;
  let source: "market" | "demo";
  if (body.action === "crash") {
    const current = Number(body.currentPriceUsd ?? 0);
    if (!(current > 0)) {
      return NextResponse.json({ ok: false, error: { code: "BadRequest", message: "currentPriceUsd required for crash" } }, { status: 400 });
    }
    priceUsd = current * 0.7;
    source = "demo";
  } else if (body.action === "restore") {
    priceUsd = Number(body.restorePriceUsd ?? 0);
    source = "market";
  } else if (typeof body.price === "number" && body.price > 0) {
    priceUsd = body.price;
    source = "demo";
  } else {
    return NextResponse.json({ ok: false, error: { code: "BadRequest", message: "price or action required" } }, { status: 400 });
  }
  if (!(priceUsd > 0)) {
    return NextResponse.json({ ok: false, error: { code: "BadRequest", message: "price must be positive" } }, { status: 400 });
  }

  const admin = Keypair.fromSecretKey(bs58.decode(process.env.ADMIN_SECRET!));
  const connection = new anchor.web3.Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!, "confirmed");
  const provider = new anchor.AnchorProvider(connection, walletOf(admin), { commitment: "confirmed" });
  const idl = (await import("@/lib/idl/stockcard.json")).default;
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const marketInfo = MARKETS.find((info) => marketMint(info) === mintStr);
  if (!marketInfo) {
    return NextResponse.json({ ok: false, error: { code: "BadRequest", message: "Unknown market mint" } }, { status: 400 });
  }

  const mint = new PublicKey(mintStr);
  const market = marketPda(program.programId, mint);
  const priceUsd6 = Math.round(priceUsd * 1e6);

  const signature = await program.methods
    .setSignedPrice(new anchor.BN(priceUsd6), -6, { [source]: {} })
    .accounts({
      signer: admin.publicKey,
      config: configPda(program.programId),
      market,
      signedPrice: pricePda(program.programId, market),
    })
    .rpc();

  const demoKey = `pricedemo:${marketInfo.symbol}`;
  const demoPoints = (await kvGet<[number, number][]>(demoKey)) ?? [];
  demoPoints.push([Date.now(), priceUsd]);
  await kvSet(demoKey, demoPoints);

  // Alert delivery is best-effort, but wait for the check before returning.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  let alertCheck: "dispatched" | "skipped" | "failed" = appUrl ? "failed" : "skipped";
  if (appUrl) {
    try {
      await fetch(`${appUrl}/api/alerts/check`, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "content-type": "application/json" },
        body: "{}",
      });
      alertCheck = "dispatched";
    } catch {
      // The signed price update and demo point remain successful if alert delivery fails.
    }
  }

  return NextResponse.json({ ok: true, data: { signature, priceUsd6, alertCheck } });
}
