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
/** Equity prints are slower than crypto; a Pyth reading older than this counts as closed/stale. */
export const MAX_PYTH_AGE_MS = 5 * 60 * 1000;
/** Pyth's confidence band. Wider than 1% means its publishers disagree; don't lend against it. */
export const MAX_PYTH_CONF_BPS = 100;

export interface PythReading {
  feedId: string;
  price: number;
  confBps: number;
  publishTime: number;
}

/** A Pyth reading we're willing to lend against: fresh enough and tight enough. */
export function usablePyth(r: PythReading | null, now: number): boolean {
  if (!r || !(r.price > 0)) return false;
  if (now - r.publishTime > MAX_PYTH_AGE_MS) return false;
  return r.confBps <= MAX_PYTH_CONF_BPS;
}

/** Mainnet mints used only to look up prices; devnet collateral mints are mocks. */
export const MAINNET_MINTS: Record<string, string> = {
  NVDAx: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  SPYx: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  TSLAx: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
  SPCX: "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb",
  // Pre-IPO (Tessera, PreStocks). Their own APIs are the primary source; Jupiter is the cross-check.
  "T-OPENAI": "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
  "T-KALSHI": "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ",
  "PRE-ANTHROPIC": "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
  "PRE-SPACEX": "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
};

export interface JupiterPrice {
  usdPrice: number;
  liquidity: number;
  stockData?: { id: string; price: number; updatedAt: string };
}

export type PrimarySource = "xstocks" | "backpack" | "tessera" | "prestocks";

export interface SourceReading {
  symbol: string;
  primary: { name: PrimarySource; price: number } | null;
  jupiter: JupiterPrice | null;
  pyth: PythReading | null;
  marketOpen: boolean | null;
  halted: boolean;
}

export type SignerDecision =
  | {
      action: "post";
      symbol: string;
      price: number;
      priceE6: number;
      spreadBps: number | null;
      sources: string[];
      note?: string;
    }
  | { action: "skip"; symbol: string; reason: string };

export function spreadBps(a: number, b: number): number {
  return Math.round((Math.abs(a - b) / ((a + b) / 2)) * 10_000);
}

type Candidate = { name: string; price: number };

/** Widest disagreement across the candidates we're about to average. */
function maxSpread(candidates: Candidate[]): number {
  let worst = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      worst = Math.max(worst, spreadBps(candidates[i].price, candidates[j].price));
    }
  }
  return worst;
}

function mean(candidates: Candidate[]): number {
  return candidates.reduce((sum, c) => sum + c.price, 0) / candidates.length;
}

/**
 * With three sources we can drop a single outlier instead of skipping the whole post:
 * if exactly one pair agrees within the limit and the third disagrees with both, that third
 * source is the odd one out. Returns null when the readings are genuinely irreconcilable.
 */
function agreeingPair(candidates: Candidate[]): { kept: Candidate[]; dropped: Candidate; bps: number } | null {
  let best: { kept: Candidate[]; dropped: Candidate; bps: number } | null = null;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const bps = spreadBps(candidates[i].price, candidates[j].price);
      if (bps > AGREEMENT_BPS) continue;
      if (best && bps >= best.bps) continue;
      const dropped = candidates.find((_, k) => k !== i && k !== j);
      if (!dropped) continue;
      best = { kept: [candidates[i], candidates[j]], dropped, bps };
    }
  }
  return best;
}

/**
 * Decide whether to post a Market price for one symbol. `lastSource` is the on-chain SignedPrice source.
 *
 * Sources are xStocks (or Backpack for SPCX), Jupiter and — when `PYTH_API_KEY` is configured —
 * Pyth. Two sources must agree within 200 bps; a third lets us drop one outlier instead of going
 * dark, and lets us keep pricing when the primary issuer API is down.
 */
export function decide(r: SourceReading, lastSource: string | null, now: number): SignerDecision {
  const skip = (reason: string): SignerDecision => ({ action: "skip", symbol: r.symbol, reason });

  if (lastSource && lastSource.toLowerCase() === "demo") return skip("demo override active; restore to resume");
  if (r.halted) return skip("trading halted at issuer");

  const pyth = usablePyth(r.pyth, now) ? r.pyth : null;
  if (!r.primary || !(r.primary.price > 0)) {
    // Pyth can stand in for a down issuer API, but never price collateral on its own.
    if (!pyth) return skip("primary source unavailable");
  }

  const stockUpdated = r.jupiter?.stockData?.updatedAt ? Date.parse(r.jupiter.stockData.updatedAt) : NaN;
  if (Number.isFinite(stockUpdated) && now - stockUpdated > MAX_STOCKDATA_AGE_MS) {
    return skip("market closed or stale stock data; closed-market max-age applies");
  }
  if (r.marketOpen === false) return skip("market closed; closed-market max-age applies");

  const jup = r.jupiter;
  const jupiterUsable = Boolean(jup && jup.usdPrice > 0 && jup.liquidity >= MIN_JUPITER_LIQUIDITY_USD);

  const candidates: Candidate[] = [];
  if (r.primary && r.primary.price > 0) candidates.push({ name: r.primary.name, price: r.primary.price });
  if (jup && jupiterUsable) candidates.push({ name: "jupiter", price: jup.usdPrice });
  if (pyth) candidates.push({ name: "pyth", price: pyth.price });

  if (candidates.length === 0) return skip("no usable price source");

  const post = (used: Candidate[], bps: number | null, note?: string): SignerDecision => {
    const price = mean(used);
    return {
      action: "post",
      symbol: r.symbol,
      price,
      priceE6: toE6(price),
      spreadBps: bps,
      sources: used.map((c) => c.name),
      note,
    };
  };

  if (candidates.length === 1) {
    const only = candidates[0];
    const note =
      only.name === "pyth"
        ? "Pyth only; issuer and Jupiter unavailable (log extra 500 bps haircut flag)"
        : "Jupiter missing or thin liquidity; primary only (log extra 500 bps haircut flag)";
    return post([only], null, note);
  }

  const worst = maxSpread(candidates);
  if (worst <= AGREEMENT_BPS) return post(candidates, worst);

  const pair = candidates.length >= 3 ? agreeingPair(candidates) : null;
  if (pair) {
    const off = spreadBps(pair.dropped.price, mean(pair.kept));
    return post(pair.kept, pair.bps, `dropped ${pair.dropped.name} as outlier (${off} bps off the other two)`);
  }
  return skip(`sources disagree by ${worst} bps (limit ${AGREEMENT_BPS})`);
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

/**
 * Read all sources for the given symbols (subset of MAINNET_MINTS).
 * Pyth readings are passed in (see `lib/prices/pyth.ts`) so this module stays dependency-free.
 */
export async function readSources(
  symbols: string[],
  f: Fetch = fetch,
  jupiterKey?: string,
  pyth: Record<string, { reading: PythReading | null; marketOpen: boolean | null }> = {},
  preIpo: Record<string, { provider: PrimarySource; price: number }> = {},
): Promise<SourceReading[]> {
  const mints = symbols.map((s) => MAINNET_MINTS[s]).filter(Boolean);
  const jup = await fetchJupiter(mints, f, jupiterKey).catch(() => ({}) as Record<string, JupiterPrice>);
  return Promise.all(
    symbols.map(async (symbol): Promise<SourceReading> => {
      const jupiter = jup[MAINNET_MINTS[symbol]] ?? null;
      const pythReading = pyth[symbol]?.reading ?? null;
      /** Pyth's NYSE calendar knows holidays and half-days; prefer it over the issuer's flag. */
      const pythOpen = pyth[symbol]?.marketOpen ?? null;
      const pre = preIpo[symbol];
      if (pre) {
        // Pre-IPO tokens trade 24/7 and have no issuer trading calendar.
        return { symbol, primary: { name: pre.provider, price: pre.price }, jupiter, pyth: pythReading, marketOpen: null, halted: false };
      }
      if (symbol === "SPCX") {
        const price = await fetchBackpackSpcx(f).catch(() => null);
        return { symbol, primary: price ? { name: "backpack", price } : null, jupiter, pyth: pythReading, marketOpen: null, halted: false };
      }
      const x = await fetchXStocks(symbol, f).catch(() => ({ price: null, open: null, halted: false }));
      return { symbol, primary: x.price ? { name: "xstocks", price: x.price } : null, jupiter, pyth: pythReading, marketOpen: pythOpen ?? x.open, halted: x.halted };
    }),
  );
}
