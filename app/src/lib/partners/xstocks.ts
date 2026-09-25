/**
 * xStocks (Backed) public API client — integrations.md "xStocks (Backed): details".
 * Base URL https://api.backed.fi/api/v2, public endpoints need no key.
 * Every function degrades gracefully: network/HTTP/parse errors return null instead of
 * throwing, so screens and admin guards never crash when the API is unreachable.
 */

const BASE = "https://api.backed.fi/api/v2";
const TIMEOUT_MS = 8_000;

export interface XstockDeployment {
  network: string;
  address: string;
}

export interface XstockAsset {
  symbol: string;
  name?: string;
  isin?: string;
  underlying?: string;
  tradingHoursMode?: string;
  isTradingHalted?: boolean;
  deployments?: XstockDeployment[];
}

export interface XstockPriceData {
  quote?: number;
  currency?: string;
  timestamp?: string;
}

export interface XstockMultiplier {
  currentMultiplier?: number;
  newMultiplier?: number;
  activationDateTime?: string;
}

export interface XstockSystemStatus {
  isMarketTradingHalted?: boolean;
  isAtomicTradingHalted?: boolean;
}

export interface XstockProofOfReserves {
  sharesHeld?: number;
  circulatingSupply?: number;
  lastAuditedAt?: string;
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

/** Solana mint address for an asset, if deployed on Solana. */
export function solanaMint(asset: XstockAsset | null): string | null {
  const dep = asset?.deployments?.find((d) => d.network.toLowerCase() === "solana");
  return dep?.address ?? null;
}

export function listAssets(): Promise<XstockAsset[] | null> {
  return get<XstockAsset[]>("/public/assets");
}

export function getAsset(symbol: string): Promise<XstockAsset | null> {
  return get<XstockAsset>(`/public/assets/${encodeURIComponent(symbol)}`);
}

/** Indicative price — price signer source #1 (Jupiter is #2). */
export function getPriceData(symbol: string): Promise<XstockPriceData | null> {
  return get<XstockPriceData>(`/public/assets/${encodeURIComponent(symbol)}/price-data`);
}

/** Token-2022 Scaled UI Amount multiplier (dividends/splits). */
export function getMultiplier(symbol: string): Promise<XstockMultiplier | null> {
  return get<XstockMultiplier>(`/public/assets/${encodeURIComponent(symbol)}/multiplier?network=Solana`);
}

/** Trading-halt status — halt ⇒ admin guard pauses borrowing on that market. */
export function getSystemStatus(symbol: string): Promise<XstockSystemStatus | null> {
  return get<XstockSystemStatus>(`/public/system/status/${encodeURIComponent(symbol)}`);
}

/** Proof of reserves — reserves < supply ⇒ admin guard pauses the market. */
export function getProofOfReserves(symbol: string): Promise<XstockProofOfReserves | null> {
  return get<XstockProofOfReserves>(`/public/proof-of-reserves/${encodeURIComponent(symbol)}`);
}

export interface XstockGuard {
  symbol: string;
  /** True when the issuer reports a trading halt. */
  halted: boolean;
  /** True when sharesHeld < circulatingSupply. */
  reservesShortfall: boolean;
  /** False when the API could not be reached (guard then leaves the market alone). */
  reachable: boolean;
}

/** Combined guard check used by /api/admin/guards. Never throws. */
export async function checkGuards(symbol: string): Promise<XstockGuard> {
  const [status, por] = await Promise.all([getSystemStatus(symbol), getProofOfReserves(symbol)]);
  const reachable = status !== null || por !== null;
  const halted = Boolean(status?.isMarketTradingHalted || status?.isAtomicTradingHalted);
  const reservesShortfall =
    por?.sharesHeld !== undefined && por?.circulatingSupply !== undefined
      ? por.sharesHeld < por.circulatingSupply
      : false;
  return { symbol, halted, reservesShortfall, reachable };
}
