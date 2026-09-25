/**
 * T051 — xStocks issuer guards (integrations.md "Issuer controls" / off-chain guards).
 * POST (admin token, devnet only): for every xStock market, check the issuer's trading-halt
 * status and proof of reserves. A halt or reserves < supply pauses borrowing on that market
 * via `update_market` with maxLtvBps = 0 (the program has no per-market pause flag; LTV 0
 * blocks new borrows while repay/withdraw keep working). When the guard clears, the original
 * max LTV from config.ts is restored. Results are cached in KV.
 * GET (public): the cached guard state so the Assets screen can show a "Trading halted" chip.
 * Everything degrades gracefully — an unreachable xStocks API leaves markets untouched.
 */
import { NextRequest, NextResponse } from "next/server";
import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { MARKETS, marketMint } from "@/lib/config";
import { kvGet, kvSet } from "@/lib/kv";
import { checkGuards } from "@/lib/partners/xstocks";

const KV_KEY = "guards:xstocks";

export interface GuardState {
  symbol: string;
  halted: boolean;
  reservesShortfall: boolean;
  pausedOnChain: boolean;
  checkedAt: number;
  signature?: string;
}

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

function guard(req: NextRequest): NextResponse | null {
  if ((process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") !== "devnet") {
    return NextResponse.json({ ok: false, error: { code: "Forbidden", message: "Devnet only" } }, { status: 403 });
  }
  if (req.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: { code: "Unauthorized", message: "Bad admin token" } }, { status: 401 });
  }
  return null;
}

/** xStock markets = equity symbols ending in "x" with a configured mint (NVDAx, SPYx, TSLAx). */
const XSTOCK_MARKETS = MARKETS.filter((m) => m.assetClass === "Equity" && m.symbol.endsWith("x") && marketMint(m));

export async function GET() {
  let states: GuardState[] = [];
  try {
    states = (await kvGet<GuardState[]>(KV_KEY)) ?? [];
  } catch {
    states = [];
  }
  return NextResponse.json({ ok: true, data: { guards: states, halted: states.filter((s) => s.pausedOnChain).map((s) => s.symbol) } });
}

export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const admin = Keypair.fromSecretKey(bs58.decode(process.env.ADMIN_SECRET!));
  const connection = new anchor.web3.Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!, "confirmed");
  const provider = new anchor.AnchorProvider(connection, walletOf(admin), { commitment: "confirmed" });
  const idl = (await import("@/lib/idl/stockcard.json")).default;
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const configKey = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0];

  const previous = ((await kvGet<GuardState[]>(KV_KEY).catch(() => null)) ?? []) as GuardState[];
  const states: GuardState[] = [];

  for (const info of XSTOCK_MARKETS) {
    const check = await checkGuards(info.symbol);
    if (!check.reachable) {
      // API unreachable — leave the market as-is and keep any previous state visible.
      const prev = previous.find((s) => s.symbol === info.symbol);
      states.push(prev ?? { symbol: info.symbol, halted: false, reservesShortfall: false, pausedOnChain: false, checkedAt: Date.now() });
      continue;
    }

    const mint = new PublicKey(marketMint(info));
    const marketKey = PublicKey.findProgramAddressSync([Buffer.from("market"), mint.toBuffer()], program.programId)[0];
    const shouldPause = check.halted || check.reservesShortfall;
    const prev = previous.find((s) => s.symbol === info.symbol);
    const wasPaused = prev?.pausedOnChain ?? false;

    let signature: string | undefined;
    let pausedOnChain = wasPaused;
    if (shouldPause !== wasPaused) {
      try {
        const market = await (
          program.account as unknown as {
            market: {
              fetch(key: PublicKey): Promise<{
                liqThresholdBps: number;
                liqBonusBps: number;
                haircutBps: number;
                aprBands: { maxLtvBps: number; aprBps: number }[];
                maxPriceAgeSecs: number;
                closedMarketAgeSecs: number;
                closedHaircutBps: number;
              }>;
            };
          }
        ).market.fetch(marketKey);
        const nextMaxLtv = shouldPause ? 0 : info.maxLtvBps;
        signature = await program.methods
          .updateMarket(
            nextMaxLtv,
            market.liqThresholdBps,
            market.liqBonusBps,
            market.haircutBps,
            market.aprBands,
            market.maxPriceAgeSecs,
            market.closedMarketAgeSecs,
            market.closedHaircutBps,
          )
          .accounts({ admin: admin.publicKey, config: configKey, market: marketKey })
          .rpc();
        pausedOnChain = shouldPause;
      } catch {
        pausedOnChain = wasPaused; // tx failed — report the previous truth
      }
    }
    states.push({
      symbol: info.symbol,
      halted: check.halted,
      reservesShortfall: check.reservesShortfall,
      pausedOnChain,
      checkedAt: Date.now(),
      signature,
    });
  }

  await kvSet(KV_KEY, states).catch(() => {});
  return NextResponse.json({ ok: true, data: { guards: states } });
}
