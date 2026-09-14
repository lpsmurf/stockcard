/**
 * Client-side previews of the on-chain risk math (programs/stockcard/src/math.rs).
 * The program is the authority; these numbers only preview what it will enforce.
 * All amounts are bigint in 6-decimal base units; rates in basis points.
 */
export const BPS = 10_000n;
export const SECONDS_PER_YEAR = 31_536_000n;
export const USD = 1_000_000n; // 6 decimals

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** Linear interest, rounded up in the protocol's favor. */
export function accrue(debt: bigint, aprBps: bigint, elapsedSecs: bigint): bigint {
  if (debt === 0n || elapsedSecs <= 0n) return debt;
  return debt + ceilDiv(debt * aprBps * elapsedSecs, BPS * SECONDS_PER_YEAR);
}

/** Collateral value in USD base units after haircut. priceUsd6 = price of one whole token in USD base units. */
export function collateralValue(amount: bigint, decimals: number, priceUsd6: bigint, haircutBps: bigint): bigint {
  const gross = (amount * priceUsd6) / 10n ** BigInt(decimals);
  return (gross * (BPS - haircutBps)) / BPS;
}

export function ltvBps(debt: bigint, collateralUsd: bigint): bigint {
  if (debt === 0n) return 0n;
  if (collateralUsd === 0n) return 2n ** 64n - 1n;
  return ceilDiv(debt * BPS, collateralUsd);
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
