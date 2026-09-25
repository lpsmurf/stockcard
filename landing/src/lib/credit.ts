// Calculator math per specs/002-landing-site/brief.md §6.
// Sanity check against the brief example: $10,000 stock, $3,500 borrowed (35% LTV)
// → canFallPct ≈ 0.4615 (stock can fall ~46% before liquidation),
// APR 12.9% → daily interest ≈ $1.24.

export type AssetType = "stocks" | "cards" | "watches" | "art";

// Max LTV: stocks 50%, graded cards 40%, watches 40%, art 30%.
export const MAX_LTV: Record<AssetType, number> = {
  stocks: 0.5,
  cards: 0.4,
  watches: 0.4,
  art: 0.3,
};

// Liquidation thresholds: stocks 65%, cards 55%, art 45%.
// Assumption: watches use the cards/collectibles threshold of 55% — the brief
// only pins watches' max LTV (40%, "same as collectibles"), not a threshold.
export const LIQUIDATION_THRESHOLD: Record<AssetType, number> = {
  stocks: 0.65,
  cards: 0.55,
  watches: 0.55,
  art: 0.45,
};

export const SUGGESTED_MAX_LTV = 0.35;

// APR bands. Stocks: 9.9% up to 20% LTV, 12.9% for 20–35%, 14.9% for 35–50%.
// Cards, watches and art: 11.9% / 15.9% (two bands, split at 20% LTV).
export function aprForLtv(assetType: AssetType, ltv: number): number {
  if (assetType === "stocks") {
    if (ltv <= 0.2) return 0.099;
    if (ltv <= 0.35) return 0.129;
    return 0.149;
  }
  return ltv <= 0.2 ? 0.119 : 0.159;
}

export function maxLtv(assetType: AssetType): number {
  return MAX_LTV[assetType];
}

export function liquidationThreshold(assetType: AssetType): number {
  return LIQUIDATION_THRESHOLD[assetType];
}

/** Max credit line in currency units for a collateral value. */
export function creditLine(assetType: AssetType, value: number): number {
  return value * MAX_LTV[assetType];
}

/** Current LTV for a borrowed amount against a collateral value. */
export function ltv(borrowed: number, value: number): number {
  if (value <= 0) return 0;
  return borrowed / value;
}

/** Daily interest in currency units: borrowed × APR / 365. */
export function dailyInterest(borrowed: number, apr: number): number {
  return (borrowed * apr) / 365;
}

/**
 * How far the collateral price can fall (as a fraction) before the position
 * reaches the liquidation threshold: 1 − borrowed / (value × liqThreshold).
 * Returns 0 when already at/over the threshold, 1 when nothing is borrowed.
 */
export function canFallPct(assetType: AssetType, value: number, borrowed: number): number {
  const liq = LIQUIDATION_THRESHOLD[assetType];
  if (value <= 0 || liq <= 0) return 0;
  return Math.max(0, 1 - borrowed / (value * liq));
}

/** Collateral value at which the position is liquidated. */
export function liquidationValue(assetType: AssetType, borrowed: number): number {
  const liq = LIQUIDATION_THRESHOLD[assetType];
  return borrowed / liq;
}

export type CreditPreview = {
  creditLine: number;
  ltv: number;
  apr: number;
  dailyInterest: number;
  canFallPct: number;
  liquidationValue: number;
};

export function preview(assetType: AssetType, value: number, borrowed: number): CreditPreview {
  const currentLtv = ltv(borrowed, value);
  const apr = aprForLtv(assetType, currentLtv);
  return {
    creditLine: creditLine(assetType, value),
    ltv: currentLtv,
    apr,
    dailyInterest: dailyInterest(borrowed, apr),
    canFallPct: canFallPct(assetType, value, borrowed),
    liquidationValue: liquidationValue(assetType, borrowed),
  };
}
