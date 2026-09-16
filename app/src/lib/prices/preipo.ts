/**
 * Pre-IPO collateral price sources (Stocklana Tessera and PreStocks bounties).
 *
 * Both sponsors publish keyless public endpoints, checked live Sept 16:
 *   Tessera   GET https://rest-api.tessera.pe/v1/public/token-details
 *             → [{ symbol: "T-OpenAI", mint, markPrice, holders, markValuation }]
 *   PreStocks GET https://prestocks.com/api/prestocks
 *             → [{ symbol: "ANTHROPIC", contract_address, markPrice, tokenPrice, supply }]
 *
 * PreStocks publishes both the SPV net asset value (`markPrice`) and what the token actually
 * trades at (`tokenPrice`, currently a ~1% premium). We lend against the lower of the two:
 * a premium is sentiment, and sentiment is the first thing to go when we need to liquidate.
 *
 * These are illiquid SPV-backed tokens, so config.ts gives them their own band
 * (30% max LTV, 25% haircut) rather than the listed-equity band.
 */

export const TESSERA_URL = "https://rest-api.tessera.pe/v1/public/token-details";
export const PRESTOCKS_URL = "https://prestocks.com/api/prestocks";

export type PreIpoProvider = "tessera" | "prestocks";

export interface PreIpoAsset {
  /** Our market symbol. */
  symbol: string;
  provider: PreIpoProvider;
  /** The symbol as the provider spells it. */
  providerSymbol: string;
  /** Mainnet mint, used for the Jupiter cross-check (devnet collateral mints are mocks). */
  mainnetMint: string;
}

export const PREIPO_ASSETS: PreIpoAsset[] = [
  { symbol: "T-OPENAI", provider: "tessera", providerSymbol: "T-OpenAI", mainnetMint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ" },
  { symbol: "T-KALSHI", provider: "tessera", providerSymbol: "T-Kalshi", mainnetMint: "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ" },
  { symbol: "PRE-ANTHROPIC", provider: "prestocks", providerSymbol: "ANTHROPIC", mainnetMint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw" },
  { symbol: "PRE-SPACEX", provider: "prestocks", providerSymbol: "SPACEX", mainnetMint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh" },
];

export interface PreIpoReading {
  provider: PreIpoProvider;
  price: number;
  /** What the token trades at, when the provider publishes it; for context only. */
  tokenPrice?: number;
  /** Positive when the token trades above NAV. */
  premiumBps?: number;
  mint?: string;
}

type Fetch = typeof fetch;

/** Lend against NAV, never against the premium. */
export function conservativePrice(markPrice: number, tokenPrice?: number): number | null {
  const mark = Number(markPrice);
  const token = Number(tokenPrice);
  const usable = [mark, token].filter((n) => Number.isFinite(n) && n > 0);
  if (usable.length === 0) return null;
  return Math.min(...usable);
}

export function premiumBps(markPrice: number, tokenPrice?: number): number | undefined {
  if (!Number.isFinite(Number(tokenPrice)) || !(markPrice > 0)) return undefined;
  return Math.round(((Number(tokenPrice) - markPrice) / markPrice) * 10_000);
}

interface TesseraToken {
  symbol?: string;
  code?: string;
  mint?: string;
  markPrice?: number;
}

interface PreStocksToken {
  symbol?: string;
  contract_address?: string;
  markPrice?: number;
  tokenPrice?: number;
}

export async function fetchTessera(f: Fetch = fetch): Promise<Record<string, PreIpoReading>> {
  const res = await f(TESSERA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Tessera ${res.status}`);
  const rows = (await res.json()) as TesseraToken[];
  const out: Record<string, PreIpoReading> = {};
  for (const row of rows) {
    const price = conservativePrice(Number(row.markPrice));
    if (!row.symbol || price === null) continue;
    out[row.symbol] = { provider: "tessera", price, mint: row.mint };
  }
  return out;
}

export async function fetchPreStocks(f: Fetch = fetch): Promise<Record<string, PreIpoReading>> {
  const res = await f(PRESTOCKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`PreStocks ${res.status}`);
  const rows = (await res.json()) as PreStocksToken[];
  const out: Record<string, PreIpoReading> = {};
  for (const row of rows) {
    const mark = Number(row.markPrice);
    const price = conservativePrice(mark, row.tokenPrice);
    if (!row.symbol || price === null) continue;
    out[row.symbol] = {
      provider: "prestocks",
      price,
      tokenPrice: Number.isFinite(Number(row.tokenPrice)) ? Number(row.tokenPrice) : undefined,
      premiumBps: premiumBps(mark, row.tokenPrice),
      mint: row.contract_address,
    };
  }
  return out;
}

/** Readings for our pre-IPO markets, keyed by our symbol. A provider being down drops only its own assets. */
export async function readPreIpo(symbols: string[], f: Fetch = fetch): Promise<Record<string, PreIpoReading>> {
  const wanted = PREIPO_ASSETS.filter((a) => symbols.includes(a.symbol));
  if (wanted.length === 0) return {};

  const providers = new Set(wanted.map((a) => a.provider));
  const none: Record<string, PreIpoReading> = {};
  const [tessera, prestocks] = await Promise.all([
    providers.has("tessera") ? fetchTessera(f).catch(() => none) : none,
    providers.has("prestocks") ? fetchPreStocks(f).catch(() => none) : none,
  ]);

  const out: Record<string, PreIpoReading> = {};
  for (const asset of wanted) {
    const source = asset.provider === "tessera" ? tessera : prestocks;
    const reading = source[asset.providerSymbol];
    if (reading) out[asset.symbol] = reading;
  }
  return out;
}
