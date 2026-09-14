/**
 * Client-side previews of the on-chain risk math (programs/stockcard/src/math.rs).
 * The program is the authority; these numbers only preview what it will enforce.
 * All amounts are bigint in 6-decimal base units; rates in basis points.
 * Multipliers are scaled by 1e6 (MULTIPLIER_SCALE), matching oracle.rs.
 */
export const BPS = 10_000n;
export const SECONDS_PER_YEAR = 31_536_000n;
export const USD = 1_000_000n; // 6 decimals
export const MULTIPLIER_SCALE = 1_000_000n;

const ceilDiv = (a: bigint, b: bigint): bigint => (a === 0n ? 0n : (a - 1n) / b + 1n);

/** Linear interest, rounded up in the protocol's favor. Matches math.rs::accrue_interest. */
export function accrueInterest(debt: bigint, aprBps: bigint, elapsedSecs: bigint): bigint {
  if (debt === 0n || elapsedSecs <= 0n) return 0n;
  return ceilDiv(debt * aprBps * elapsedSecs, BPS * SECONDS_PER_YEAR);
}

export function accrue(debt: bigint, aprBps: bigint, elapsedSecs: bigint): bigint {
  return debt + accrueInterest(debt, aprBps, elapsedSecs);
}

/** Protocol share of interest, rounded up. Matches math.rs::reserve_share. */
export function reserveShare(interest: bigint, protocolShareBps: bigint): bigint {
  return ceilDiv(interest * protocolShareBps, BPS);
}

export interface RateBand {
  maxLtvBps: number;
  aprBps: number;
}

/** Matches math.rs::select_apr_bps. */
export function selectAprBps(bands: RateBand[], ltvBpsValue: bigint): number {
  let selected = 0;
  for (const band of bands) {
    if (band.maxLtvBps === 0 || band.aprBps === 0) continue;
    selected = band.aprBps;
    if (ltvBpsValue <= BigInt(band.maxLtvBps)) return band.aprBps;
  }
  return selected;
}

/** Collateral value in USD base units after haircut. Matches math.rs::collateral_value_usd6. */
export function collateralValue(
  amount: bigint,
  decimals: number,
  priceUsd6: bigint,
  haircutBps: bigint,
  multiplierMicro: bigint = MULTIPLIER_SCALE,
): bigint {
  const gross = (amount * multiplierMicro * priceUsd6) / (10n ** BigInt(decimals) * MULTIPLIER_SCALE);
  return (gross * (BPS - haircutBps)) / BPS;
}

export function ltvBps(debt: bigint, collateralUsd: bigint): bigint {
  if (debt === 0n) return 0n;
  if (collateralUsd === 0n) return 2n ** 64n - 1n;
  return ceilDiv(debt * BPS, collateralUsd);
}

/** Matches math.rs::seize_amount. */
export function seizeAmount(
  repayUsd6: bigint,
  liqBonusBps: bigint,
  priceUsd6: bigint,
  multiplierMicro: bigint,
  decimals: number,
): bigint {
  if (priceUsd6 === 0n || multiplierMicro === 0n) return 0n;
  return (repayUsd6 * (BPS + liqBonusBps) * 10n ** BigInt(decimals) * MULTIPLIER_SCALE) /
    (BPS * priceUsd6 * multiplierMicro);
}

/** Savings share math — matches math.rs. */
export function poolValue(vaultBalance: bigint, totalBorrowed: bigint, reserve: bigint): bigint {
  return vaultBalance + totalBorrowed - reserve;
}

export function sharesForDeposit(amount: bigint, totalShares: bigint, pool: bigint): bigint {
  if (totalShares === 0n) return amount;
  if (pool === 0n) return 0n;
  return (amount * totalShares) / pool;
}

export function amountForShares(shares: bigint, totalShares: bigint, pool: bigint): bigint {
  if (totalShares === 0n) return 0n;
  return (shares * pool) / totalShares;
}

export function utilizationBps(totalBorrowed: bigint, pool: bigint): bigint {
  if (pool === 0n) return totalBorrowed > 0n ? 2n ** 64n - 1n : 0n;
  return ceilDiv(totalBorrowed * BPS, pool);
}

export function availableCredit(debt: bigint, collateralUsd: bigint, maxLtvBps: bigint): bigint {
  const limit = (collateralUsd * maxLtvBps) / BPS;
  return limit > debt ? limit - debt : 0n;
}

export type Health = "healthy" | "watch" | "atRisk";
export function health(ltv: bigint, maxLtvBps: bigint, liqThresholdBps: bigint): Health {
  if (ltv > liqThresholdBps) return "atRisk";
  if (ltv > maxLtvBps) return "watch";
  return "healthy";
}

/** Price (USD base units) at which the position crosses the liquidation threshold.
 *  parameters.md §4: debt / (collateral × multiplier × (1 − haircut) × liq_threshold). */
export function liquidationPrice(
  debt: bigint,
  collateralAmount: bigint,
  multiplierMicro: bigint,
  haircutBps: bigint,
  liqThresholdBps: bigint,
  decimals: number,
): bigint {
  if (collateralAmount === 0n || liqThresholdBps === 0n) return 0n;
  const num = debt * BPS * 10n ** BigInt(decimals) * MULTIPLIER_SCALE;
  const den = collateralAmount * multiplierMicro * (BPS - haircutBps) * liqThresholdBps;
  return num / den;
}

export type AlertBand = "healthy" | "watch" | "warning" | "urgent" | "liquidatable";

/** parameters.md §4 alert bands. Equity: warning > 5500, urgent > 6000.
 *  Art/collectibles: warning at liq − 1000, urgent at liq − 500. */
export function alertBand(
  ltv: bigint,
  maxLtvBps: bigint,
  liqThresholdBps: bigint,
  assetClass: "equity" | "artNote" | "collectible",
): AlertBand {
  if (ltv > liqThresholdBps) return "liquidatable";
  const warnAbove = assetClass === "equity" ? 5500n : liqThresholdBps - 1000n;
  const urgentAbove = assetClass === "equity" ? 6000n : liqThresholdBps - 500n;
  if (ltv > urgentAbove) return "urgent";
  if (ltv > warnAbove) return "warning";
  if (ltv > maxLtvBps) return "watch";
  return "healthy";
}

/** Exact amounts to return to max LTV (parameters.md §4).
 *  add: tokens, rounded up to 4 decimals. repay: USD base units, rounded up to cents. */
export function fixAmounts(
  debt: bigint,
  collateralAmount: bigint,
  multiplierMicro: bigint,
  priceUsd6: bigint,
  haircutBps: bigint,
  maxLtvBps: bigint,
  decimals: number,
): { addTokens: bigint; repayUsd6: bigint } {
  const value = collateralValue(collateralAmount, decimals, priceUsd6, haircutBps, multiplierMicro);
  // repay = debt − value × max_ltv, rounded up to cents
  const targetDebt = (value * maxLtvBps) / BPS;
  const repayRaw = debt > targetDebt ? debt - targetDebt : 0n;
  const repayUsd6 = repayRaw === 0n ? 0n : ceilDiv(repayRaw, 10_000n) * 10_000n;
  // add = (debt / max_ltv − value) in tokens, rounded up to 4 decimals
  const targetValue = ceilDiv(debt * BPS, maxLtvBps);
  const missingValue = targetValue > value ? targetValue - value : 0n;
  const tokenUnit4 = decimals >= 4 ? 10n ** BigInt(decimals - 4) : 1n;
  const rawNeeded =
    missingValue === 0n
      ? 0n
      : ceilDiv(
          missingValue * 10n ** BigInt(decimals) * MULTIPLIER_SCALE * BPS,
          priceUsd6 * multiplierMicro * (BPS - haircutBps),
        );
  const addTokens = rawNeeded === 0n ? 0n : ceilDiv(rawNeeded, tokenUnit4) * tokenUnit4;
  return { addTokens, repayUsd6 };
}

export function formatUsd(usd6: bigint, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  const neg = usd6 < 0n;
  const abs = neg ? -usd6 : usd6;
  const dollars = abs / USD;
  const frac = (abs % USD) / 10_000n;
  const whole = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "−" : ""}$${whole}${cents ? "." + frac.toString().padStart(2, "0") : ""}`;
}

export function formatPct(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(bps % 100n === 0n ? 0 : 1)}%`;
}
