/**
 * Price signer sources and decision rules (parameters.md "Price signer", task T029a).
 * Pure module: no env, no path aliases, so it can be unit-checked with `node --test`.
 *
 * Units (checked Sept 15 against live data): xStocks `price-data.quote`, Jupiter `usdPrice`
 * and Backpack `lastPrice` are all per UI token, i.e. after the Token-2022 Scaled UI multiplier
 * (NVDAx: quote 213.13, usdPrice 213.24, usdPricePrescaled 213.60 = usdPrice × 1.0017).
 * The program values collateral as raw × multiplier × price, so we post the per-UI-token price.
 */

export const AGREEMENT_BPS = 200;
export const MIN_JUPITER_LIQUIDITY_USD = 100_000;
export const MAX_STOCKDATA_AGE_MS = 15 * 60 * 1000;

/** Mainnet mints used only to look up prices; devnet collateral mints are mocks. */
export const MAINNET_MINTS: Record<string, string> = {
  NVDAx: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  SPYx: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  TSLAx: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
  SPCX: "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb",
};

export interface JupiterPrice {
  usdPrice: number;
  liquidity: number;
  stockData?: { id: string; price: number; updatedAt: string };
}

export interface SourceReading {
  symbol: string;
  primary: { name: "xstocks" | "backpack"; price: number } | null;
  jupiter: JupiterPrice | null;
  marketOpen: boolean | null;
  halted: boolean;
}

export type SignerDecision =
  | { action: "post"; symbol: string; price: number; priceE6: number; spreadBps: number | null; note?: string }
  | { action: "skip"; symbol: string; reason: string };

export function spreadBps(a: number, b: number): number {
  return Math.round((Math.abs(a - b) / ((a + b) / 2)) * 10_000);
}

/** Decide whether to post a Market price for one symbol. `lastSource` is the on-chain SignedPrice source. */
export function decide(r: SourceReading, lastSource: string | null, now: number): SignerDecision {
  const skip = (reason: string): SignerDecision => ({ action: "skip", symbol: r.symbol, reason });

  if (lastSource && lastSource.toLowerCase() === "demo") return skip("demo override active; restore to resume");
  if (r.halted) return skip("trading halted at issuer");
  if (!r.primary || !(r.primary.price > 0)) return skip("primary source unavailable");

  const stockUpdated = r.jupiter?.stockData?.updatedAt ? Date.parse(r.jupiter.stockData.updatedAt) : NaN;
  if (Number.isFinite(stockUpdated) && now - stockUpdated > MAX_STOCKDATA_AGE_MS) {
    return skip("market closed or stale stock data; closed-market max-age applies");
  }
  if (r.marketOpen === false) return skip("market closed; closed-market max-age applies");

  const jup = r.jupiter;
  if (!jup || !(jup.usdPrice > 0) || jup.liquidity < MIN_JUPITER_LIQUIDITY_USD) {
    const price = r.primary.price;
    return { action: "post", symbol: r.symbol, price, priceE6: toE6(price), spreadBps: null, note: "Jupiter missing or thin liquidity; primary only (log extra 500 bps haircut flag)" };
  }

  const bps = spreadBps(r.primary.price, jup.usdPrice);
  if (bps > AGREEMENT_BPS) return skip(`sources disagree by ${bps} bps (limit ${AGREEMENT_BPS})`);
  const price = (r.primary.price + jup.usdPrice) / 2;
  return { action: "post", symbol: r.symbol, price, priceE6: toE6(price), spreadBps: bps };
}

export function toE6(price: number): number {
  return Math.round(price * 1e6);
}

type Fetch = typeof fetch;

export async function fetchJupiter(mints: string[], f: Fetch = fetch, apiKey?: string): Promise<Record<string, JupiterPrice>> {
  const base = apiKey ? "https://api.jup.ag/price/v3" : "https://lite-api.jup.ag/price/v3";
  const res = await f(`${base}?ids=${mints.join(",")}`, {
    headers: apiKey ? { "x-api-key": apiKey } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jupiter ${res.status}`);
  return (await res.json()) as Record<string, JupiterPrice>;
}

export async function fetchXStocks(symbol: string, f: Fetch = fetch): Promise<{ price: number | null; open: boolean | null; halted: boolean }> {
  const base = "https://api.backed.fi/api/v2/public/assets";
  const [priceRes, assetRes] = await Promise.all([
    f(`${base}/${symbol}/price-data`, { cache: "no-store" }),
    f(`${base}/${symbol}`, { cache: "no-store" }),
  ]);
  const price = priceRes.ok ? Number(((await priceRes.json()) as { quote?: number }).quote) : NaN;
  let open: boolean | null = null;
  let halted = false;
  if (assetRes.ok) {
    const asset = (await assetRes.json()) as { isTradingHalted?: boolean; trading?: { openNow?: boolean; isTradingHalted?: boolean } };
    halted = Boolean(asset.isTradingHalted || asset.trading?.isTradingHalted);
    open = typeof asset.trading?.openNow === "boolean" ? asset.trading.openNow : null;
  }
  return { price: Number.isFinite(price) && price > 0 ? price : null, open, halted };
}

export async function fetchBackpackSpcx(f: Fetch = fetch): Promise<number | null> {
  const res = await f("https://api.backpack.exchange/api/v1/ticker?symbol=SPCX.US_USDC&source=External", { cache: "no-store" });
  if (!res.ok) return null;
  const price = Number(((await res.json()) as { lastPrice?: string }).lastPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** Read all sources for the given symbols (subset of MAINNET_MINTS). */
export async function readSources(symbols: string[], f: Fetch = fetch, jupiterKey?: string): Promise<SourceReading[]> {
  const mints = symbols.map((s) => MAINNET_MINTS[s]).filter(Boolean);
  const jup = await fetchJupiter(mints, f, jupiterKey).catch(() => ({}) as Record<string, JupiterPrice>);
  return Promise.all(
    symbols.map(async (symbol): Promise<SourceReading> => {
      const jupiter = jup[MAINNET_MINTS[symbol]] ?? null;
      if (symbol === "SPCX") {
        const price = await fetchBackpackSpcx(f).catch(() => null);
        return { symbol, primary: price ? { name: "backpack", price } : null, jupiter, marketOpen: null, halted: false };
      }
      const x = await fetchXStocks(symbol, f).catch(() => ({ price: null, open: null, halted: false }));
      return { symbol, primary: x.price ? { name: "xstocks", price: x.price } : null, jupiter, marketOpen: x.open, halted: x.halted };
    }),
  );
}
