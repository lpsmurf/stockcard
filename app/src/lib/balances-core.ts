/**
 * Home balances (parameters.md "Home balances", contracts/api.md `GET /api/wallet/balances`).
 * Pure module: no imports, so it can be unit-checked with `node --test`. `lib/balances.ts` feeds it.
 *
 * Three buckets, all USD at the price the app already uses:
 *   locked     tokens in the user's positions, at the market SignedPrice
 *   wallet     every priced token in the wallet that isn't locked (our market mints, SOL);
 *              tokens with no price are listed as "No price" and excluded from totals
 *   card       USDC in the ATA the card spends from, at $1.00
 *
 * Two different ratios, never to be confused:
 *   ltvBps           debt ÷ locked collateral AFTER haircut. Drives limits, alerts, liquidation.
 *   debtOfTotalBps   debt ÷ everything held. Context only: never red, never used for alerts,
 *                    because wallet assets can leave at any moment and don't protect the position.
 */

const BPS = 10_000n;
const MULTIPLIER_SCALE = 1_000_000n;

export type PriceSource = "market" | "appraisal" | "partnerFmv" | "demo" | "jupiter" | "fixed" | "none";

export interface Holding {
  mint: string;
  symbol: string;
  /** Raw token amount (base units). */
  amount: bigint;
  decimals: number;
  priceUsd6: bigint | null;
  priceSource: PriceSource;
  /** Gross value, no haircut: this is "what you own", not "what you can borrow against". */
  valueUsd6: bigint;
  /** True when this token can be deposited as collateral. */
  eligible: boolean;
}

export interface MarketBalanceInput {
  mint: string;
  symbol: string;
  decimals: number;
  multiplierMicro: bigint;
  priceUsd6: bigint;
  source: string;
  walletAmount: bigint;
  lockedAmount: bigint;
  /** Locked collateral value after the market haircut (what the program lends against). */
  lockedValueAfterHaircutUsd6: bigint;
  debtUsd6: bigint;
}

export interface BalancesInput {
  markets: MarketBalanceInput[];
  /** USDC in the card wallet, base units (6 decimals, so already USD6 at $1.00). */
  cardUsdc6: bigint;
  sol?: { lamports: bigint; priceUsd6: bigint | null };
  /** Wallet tokens that aren't one of our markets. Listed, never valued. */
  otherTokens?: { mint: string; amount: bigint; decimals: number; symbol?: string }[];
}

export interface Balances {
  locked: Holding[];
  wallet: Holding[];
  cardUsd6: bigint;
  totals: { lockedUsd6: bigint; walletUsd6: bigint; cardUsd6: bigint; totalUsd6: bigint };
  debtUsd6: bigint;
  ltvBps: bigint;
  debtOfTotalBps: bigint;
}

export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Same formula as `collateralValue` in risk.ts with a zero haircut; a test pins them together. */
export function grossValueUsd6(amount: bigint, decimals: number, priceUsd6: bigint, multiplierMicro = MULTIPLIER_SCALE): bigint {
  return (amount * multiplierMicro * priceUsd6) / (10n ** BigInt(decimals) * MULTIPLIER_SCALE);
}

function normalizeSource(source: string): PriceSource {
  const s = source.toLowerCase();
  if (s === "market" || s === "appraisal" || s === "demo") return s;
  if (s === "partnerfmv") return "partnerFmv";
  return "market";
}

export function buildBalances(input: BalancesInput): Balances {
  const locked: Holding[] = [];
  const wallet: Holding[] = [];
  let lockedAfterHaircut = 0n;
  let debt = 0n;

  for (const m of input.markets) {
    debt += m.debtUsd6;
    lockedAfterHaircut += m.lockedValueAfterHaircutUsd6;
    const priced = m.priceUsd6 > 0n;
    const priceSource = priced ? normalizeSource(m.source) : "none";

    if (m.lockedAmount > 0n) {
      locked.push({
        mint: m.mint,
        symbol: m.symbol,
        amount: m.lockedAmount,
        decimals: m.decimals,
        priceUsd6: priced ? m.priceUsd6 : null,
        priceSource,
        valueUsd6: priced ? grossValueUsd6(m.lockedAmount, m.decimals, m.priceUsd6, m.multiplierMicro) : 0n,
        eligible: true,
      });
    }
    if (m.walletAmount > 0n) {
      wallet.push({
        mint: m.mint,
        symbol: m.symbol,
        amount: m.walletAmount,
        decimals: m.decimals,
        priceUsd6: priced ? m.priceUsd6 : null,
        priceSource,
        valueUsd6: priced ? grossValueUsd6(m.walletAmount, m.decimals, m.priceUsd6, m.multiplierMicro) : 0n,
        eligible: true,
      });
    }
  }

  if (input.sol && input.sol.lamports > 0n) {
    const price = input.sol.priceUsd6;
    wallet.push({
      mint: SOL_MINT,
      symbol: "SOL",
      amount: input.sol.lamports,
      decimals: 9,
      priceUsd6: price,
      priceSource: price ? "jupiter" : "none",
      valueUsd6: price ? grossValueUsd6(input.sol.lamports, 9, price) : 0n,
      // Real assets only: SOL is never collateral (CLAUDE.md constraints).
      eligible: false,
    });
  }

  for (const t of input.otherTokens ?? []) {
    if (t.amount <= 0n) continue;
    wallet.push({
      mint: t.mint,
      symbol: t.symbol ?? `${t.mint.slice(0, 4)}…${t.mint.slice(-4)}`,
      amount: t.amount,
      decimals: t.decimals,
      priceUsd6: null,
      priceSource: "none",
      valueUsd6: 0n,
      eligible: false,
    });
  }

  // Priced first, biggest first; "No price" rows sink to the bottom.
  const byValue = (a: Holding, b: Holding) =>
    a.priceUsd6 === null && b.priceUsd6 !== null ? 1 : b.priceUsd6 === null && a.priceUsd6 !== null ? -1 : b.valueUsd6 > a.valueUsd6 ? 1 : b.valueUsd6 < a.valueUsd6 ? -1 : 0;
  locked.sort(byValue);
  wallet.sort(byValue);

  const lockedUsd6 = locked.reduce((sum, h) => sum + h.valueUsd6, 0n);
  const walletUsd6 = wallet.reduce((sum, h) => sum + h.valueUsd6, 0n);
  const cardUsd6 = input.cardUsdc6 > 0n ? input.cardUsdc6 : 0n;
  const totalUsd6 = lockedUsd6 + walletUsd6 + cardUsd6;

  return {
    locked,
    wallet,
    cardUsd6,
    totals: { lockedUsd6, walletUsd6, cardUsd6, totalUsd6 },
    debtUsd6: debt,
    ltvBps: debt > 0n && lockedAfterHaircut > 0n ? (debt * BPS) / lockedAfterHaircut : 0n,
    debtOfTotalBps: debt > 0n && totalUsd6 > 0n ? (debt * BPS) / totalUsd6 : 0n,
  };
}
