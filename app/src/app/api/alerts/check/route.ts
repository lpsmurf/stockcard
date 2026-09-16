import * as anchor from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { err, ok } from "@/lib/api";
import { MARKETS, RPC_URL, marketMint, type MarketInfo } from "@/lib/config";
import { alertCopy, readLastBand, sendToOwner, shouldNotify, writeLastBand } from "@/lib/push";
import {
  accrue,
  alertBand,
  collateralValue,
  fixAmounts,
  formatPct,
  formatTokens,
  formatUsd,
  ltvBps,
  type AlertBand,
} from "@/lib/risk";

/**
 * POST /api/alerts/check (T060, contracts/api.md)
 * Header `authorization: Bearer CRON_SECRET`. Reads every position on-chain, values it with the
 * market's SignedPrice, computes the alert band and pushes once per band entered (parameters.md §4).
 * Body `{ owner? }` limits the check to one wallet; `?dryRun=1` computes without sending.
 */

export const dynamic = "force-dynamic";

const CLASS_MAP: Record<string, "equity" | "artNote" | "collectible"> = {
  Equity: "equity",
  ArtNote: "artNote",
  Collectible: "collectible",
};

interface Checked {
  owner: string;
  symbol: string;
  ltv: string;
  band: AlertBand;
  notified: boolean;
  reason?: string;
}

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("UNAUTHORIZED", "Bad cron secret.", 401);
  }
  if (!process.env.NEXT_PUBLIC_PROGRAM_ID) return err("NOT_CONFIGURED", "Program id is not set.", 503);

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const body = (await req.json().catch(() => null)) as { owner?: string } | null;
  const onlyOwner = body?.owner ?? null;

  const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default } as unknown as anchor.Wallet,
    { commitment: "confirmed" },
  );
  const idl = (await import("@/lib/idl/stockcard.json")).default;
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const accounts = program.account as unknown as Record<
    string,
    { all: () => Promise<{ publicKey: PublicKey; account: Record<string, unknown> }[]>; fetchNullable: (k: PublicKey) => Promise<Record<string, unknown> | null> }
  >;

  const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];

  // Market PDA → our config row, so we know symbol, decimals and multiplier.
  const byMarketPda = new Map<string, MarketInfo>();
  for (const info of MARKETS) {
    const mint = marketMint(info);
    if (!mint) continue;
    byMarketPda.set(pda(Buffer.from("market"), new PublicKey(mint).toBuffer()).toBase58(), info);
  }

  const positions = await accounts.position.all();
  const checked: Checked[] = [];
  let notified = 0;

  for (const { account } of positions) {
    const owner = (account.owner as PublicKey).toBase58();
    if (onlyOwner && owner !== onlyOwner) continue;

    const marketPda = (account.market as PublicKey).toBase58();
    const info = byMarketPda.get(marketPda);
    if (!info) continue;

    const collateral = BigInt((account.collateral_amount ?? account.collateralAmount ?? 0).toString());
    const principal = BigInt((account.debt_principal ?? account.debtPrincipal ?? 0).toString());
    if (principal === 0n || collateral === 0n) continue;

    const marketAccount = await accounts.market.fetchNullable(new PublicKey(marketPda));
    const priceAccount = await accounts.signedPrice.fetchNullable(pda(Buffer.from("price"), new PublicKey(marketPda).toBuffer()));
    if (!marketAccount || !priceAccount) continue;

    const priceUsd6 = BigInt(priceAccount.price!.toString());
    const maxLtvBps = BigInt((marketAccount.max_ltv_bps ?? marketAccount.maxLtvBps) as number);
    const liqBps = BigInt((marketAccount.liq_threshold_bps ?? marketAccount.liqThresholdBps) as number);
    const haircutBps = BigInt((marketAccount.haircut_bps ?? marketAccount.haircutBps) as number);
    const assetClassKey = Object.keys((marketAccount.asset_class ?? marketAccount.assetClass) as object)[0] ?? "equity";
    const assetClass = CLASS_MAP[assetClassKey.charAt(0).toUpperCase() + assetClassKey.slice(1)] ?? "equity";

    // Interest since the last on-chain touch, so the band matches what the user sees.
    const lastTs = BigInt((account.last_accrual_ts ?? account.lastAccrualTs ?? 0).toString());
    const aprBps = BigInt((account.apr_bps ?? account.aprBps ?? 0).toString());
    const elapsed = lastTs > 0n ? BigInt(Math.floor(Date.now() / 1000)) - lastTs : 0n;
    const debt = elapsed > 0n ? accrue(principal, aprBps, elapsed) : principal;

    const value = collateralValue(collateral, info.decimals, priceUsd6, haircutBps, info.multiplierMicro);
    const ltv = ltvBps(debt, value);
    const band = alertBand(ltv, maxLtvBps, liqBps, assetClass);
    const last = await readLastBand(owner, info.symbol);

    const row: Checked = { owner, symbol: info.symbol, ltv: formatPct(ltv), band, notified: false };

    if (!shouldNotify(band, last)) {
      // Track improvement so a later drop notifies again.
      if (!dryRun && band !== last) await writeLastBand(owner, info.symbol, band);
      row.reason = last === band ? "already notified for this band" : "band does not notify";
      checked.push(row);
      continue;
    }

    const fix = fixAmounts(debt, collateral, info.multiplierMicro, priceUsd6, haircutBps, maxLtvBps, info.decimals);
    const copy = alertCopy(band as "warning" | "urgent" | "liquidatable", {
      symbol: info.symbol,
      ltvPct: formatPct(ltv),
      liqPct: formatPct(liqBps),
      add: formatTokens(fix.addTokens, info.decimals),
      repay: formatUsd(fix.repayUsd6, { cents: true }),
    });

    if (dryRun) {
      row.reason = `would send: ${copy.title} — ${copy.body}`;
      checked.push(row);
      continue;
    }

    const sent = await sendToOwner(owner, { ...copy, market: info.symbol, band, url: `/?fix=${info.symbol}` });
    await writeLastBand(owner, info.symbol, band);
    row.notified = sent.sent > 0;
    row.reason = sent.skipped ?? `sent to ${sent.sent} device(s)`;
    if (row.notified) notified += 1;
    checked.push(row);
  }

  return ok({ checked: checked.length, notified, dryRun, positions: checked });
}
