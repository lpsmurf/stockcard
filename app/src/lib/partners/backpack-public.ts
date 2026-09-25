/**
 * Backpack public API client — integrations.md "Backpack: details".
 * Base URL https://api.backpack.exchange/api/v1, public endpoints need no auth.
 * Only SPCX matters for StockCard: it is real Token-2022 collateral users can withdraw
 * from Backpack to their own wallet. Account (signed) endpoints live elsewhere (P3 import).
 * All functions degrade gracefully and return null on any failure.
 */

const BASE = "https://api.backpack.exchange/api/v1";
const TIMEOUT_MS = 8_000;

export const SPCX_SYMBOL = "SPCX";
export const SPCX_SPOT_MARKET = "SPCX.US_USDC";
export const SPCX_PERP_MARKET = "SPCX.US_USDC_PERP";

export interface BackpackTokenDeployment {
  blockchain: string;
  address?: string;
  decimals?: number;
  depositEnabled?: boolean;
  withdrawEnabled?: boolean;
  withdrawalFee?: string;
}

export interface BackpackAsset {
  symbol: string;
  displayName?: string;
  tokens?: BackpackTokenDeployment[];
}

export interface BackpackTicker {
  symbol: string;
  lastPrice?: string;
  priceChangePercent24h?: string;
  volume24h?: string;
}

export interface BackpackMarkPrice {
  symbol: string;
  markPrice?: string;
  indexPrice?: string;
}

export interface BackpackDepth {
  bids: [string, string][];
  asks: [string, string][];
  timestamp?: number;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** `/assets` returns a list; find one symbol and its Solana deployment. */
export async function getAsset(symbol: string): Promise<BackpackAsset | null> {
  const assets = await get<BackpackAsset[]>(`/assets`);
  if (!Array.isArray(assets)) return null;
  return assets.find((a) => a.symbol === symbol) ?? null;
}

export function solanaToken(asset: BackpackAsset | null): BackpackTokenDeployment | null {
  return asset?.tokens?.find((t) => t.blockchain.toLowerCase() === "solana") ?? null;
}

/** Spot ticker. source=External gives the external (real-market) price reference. */
export function getTicker(symbol: string, external = false): Promise<BackpackTicker | null> {
  const q = `?symbol=${encodeURIComponent(symbol)}${external ? "&source=External" : ""}`;
  return get<BackpackTicker>(`/ticker${q}`);
}

/** Perp mark/index price — second reference for SPCX. */
export async function getMarkPrice(symbol: string): Promise<BackpackMarkPrice | null> {
  const rows = await get<BackpackMarkPrice[]>(`/markPrices?symbol=${encodeURIComponent(symbol)}`);
  if (Array.isArray(rows)) return rows[0] ?? null;
  return rows as unknown as BackpackMarkPrice | null;
}

/** Order book depth — used to size liquidation haircuts. */
export function getDepth(symbol: string): Promise<BackpackDepth | null> {
  return get<BackpackDepth>(`/depth?symbol=${encodeURIComponent(symbol)}`);
}

export interface SpcxSnapshot {
  /** Solana mint from Backpack's asset registry. */
  mint: string | null;
  withdrawEnabled: boolean;
  withdrawalFee: string | null;
  /** External (real-market) reference price. */
  externalPriceUsd: number | null;
  /** Backpack spot last price. */
  spotLastUsd: number | null;
  /** Perp mark price. */
  perpMarkUsd: number | null;
}

/** Everything the Assets screen shows for SPCX. Never throws. */
export async function getSpcxSnapshot(): Promise<SpcxSnapshot> {
  const [asset, external, spot, perp] = await Promise.all([
    getAsset(SPCX_SYMBOL),
    getTicker(SPCX_SPOT_MARKET, true),
    getTicker(SPCX_SPOT_MARKET),
    getMarkPrice(SPCX_PERP_MARKET),
  ]);
  const token = solanaToken(asset);
  const num = (s?: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    mint: token?.address ?? null,
    withdrawEnabled: token?.withdrawEnabled ?? false,
    withdrawalFee: token?.withdrawalFee ?? null,
    externalPriceUsd: num(external?.lastPrice),
    spotLastUsd: num(spot?.lastPrice),
    perpMarkUsd: num(perp?.markPrice),
  };
}
