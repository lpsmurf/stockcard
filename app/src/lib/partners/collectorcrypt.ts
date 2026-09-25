/**
 * Collector Crypt public API client — integrations.md "Collector Crypt: details".
 * Production https://api.collectorcrypt.com, devnet https://dev-api.collectorcrypt.com.
 * No key needed for reads (an optional `ccsk_` Bearer key only raises rate limits).
 *
 * Honest labeling: Collector Crypt is an integration target, not a partner. UI must say
 * "Not affiliated" and never show logos. All functions degrade gracefully to null/[].
 */

import { CLUSTER } from "../config";

const BASE = CLUSTER === "devnet" ? "https://dev-api.collectorcrypt.com" : "https://api.collectorcrypt.com";
const TIMEOUT_MS = 8_000;

export interface CollectorCryptCard {
  mint?: string;
  name?: string;
  /** USD, as a string. */
  insuredValue?: string;
  grade?: string;
  gradeNum?: number;
  gradingCompany?: string;
  /** Grading cert ID — cross-checkable with the PSA API (psa.ts). */
  gradingID?: string;
  nftStandard?: "Pnft" | "Cnft" | "StandardNft" | "CoreNft" | string;
  category?: string;
  population?: number;
  images?: { small?: string; medium?: string; large?: string }[];
}

export interface CollectorCryptMarket {
  owner?: string;
  status?: string;
  inSwap?: boolean;
  burnedForBridge?: boolean;
  activeListings?: unknown[];
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "stockcard-demo/1.0 (hackathon; not affiliated)",
    };
    const key = typeof process !== "undefined" ? process.env.COLLECTOR_CRYPT_API_KEY : undefined;
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Per-card insured value, grade and cert — price signer input and asset detail data. */
export function getPublicNft(mint: string): Promise<CollectorCryptCard | null> {
  return get<CollectorCryptCard>(`/cards/publicNft/${encodeURIComponent(mint)}`);
}

/**
 * Market state of a card. Collateral must be rejected when it is listed, in a swap,
 * burned or redeemed — read-only in the MVP.
 */
export function getCardMarket(mint: string): Promise<CollectorCryptMarket | null> {
  return get<CollectorCryptMarket>(`/cards/publicNft/${encodeURIComponent(mint)}/market`);
}

interface MarketplaceResponse {
  cards?: CollectorCryptCard[];
  items?: CollectorCryptCard[];
}

/** Cards owned by a wallet, for the "Eligible soon" list on the Assets screen. */
export async function getCardsByOwner(ownerAddress: string): Promise<CollectorCryptCard[]> {
  const res = await get<MarketplaceResponse | CollectorCryptCard[]>(
    `/marketplace?ownerAddress=${encodeURIComponent(ownerAddress)}`,
  );
  if (!res) return [];
  if (Array.isArray(res)) return res;
  return res.cards ?? res.items ?? [];
}

/** insuredValue (USD string) → number, or null. */
export function insuredValueUsd(card: CollectorCryptCard | null): number | null {
  const n = Number(card?.insuredValue);
  return Number.isFinite(n) && n > 0 ? n : null;
}
