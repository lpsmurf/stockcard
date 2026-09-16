/**
 * Pyth Hermes as a third price source for the signer (Stocklana "Best Use of Pyth Market Data").
 * Pure module: no env, no path aliases, so it can be unit-checked with `node --test`.
 *
 * Hermes requires an API key since 26 Aug 2026: every request carries `Authorization: Bearer <key>`.
 * Without `PYTH_API_KEY` the signer simply runs on xStocks + Jupiter as before.
 *
 * US equity feeds are named `Equity.US.<TICKER>/USD`. Feed ids are resolved at runtime from
 * /v2/price_feeds rather than hard-coded, so a re-issued id can't silently mis-price collateral.
 */

import type { PythReading } from "./signer";

export const PYTH_HERMES_BASE = "https://pyth.dourolabs.app/hermes";

const FEED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Our collateral symbol → Pyth feed symbol. SPCX is pre-IPO, so Pyth has no feed for it. */
export const PYTH_SYMBOLS: Record<string, string> = {
  NVDAx: "Equity.US.NVDA/USD",
  SPYx: "Equity.US.SPY/USD",
  TSLAx: "Equity.US.TSLA/USD",
};

interface HermesPrice {
  price: string | number;
  conf: string | number;
  expo: number;
  publish_time: number;
}

interface HermesParsed {
  id: string;
  price: HermesPrice;
}

interface HermesFeed {
  id: string;
  attributes?: { symbol?: string; asset_type?: string };
}

type Fetch = typeof fetch;

/** Hermes returns ids without the `0x`; compare case-insensitively and un-prefixed. */
export function normalizeFeedId(id: string): string {
  return id.replace(/^0x/i, "").toLowerCase();
}

/** `price` is an integer scaled by `expo` (e.g. 21313450000 with expo -8 = 213.1345). */
export function normalizePythPrice(p: HermesPrice): { price: number; confBps: number; publishTime: number } | null {
  const price = Number(p.price) * 10 ** p.expo;
  const conf = Number(p.conf) * 10 ** p.expo;
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    price,
    confBps: Number.isFinite(conf) ? Math.round((conf / price) * 10_000) : Number.POSITIVE_INFINITY,
    publishTime: p.publish_time * 1000,
  };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, accept: "application/json" };
}

/** Feed ids change rarely; cache them for a day so the 60 s signer loop doesn't re-resolve. */
const feedCache = new Map<string, { id: string; at: number }>();

export function parseFeedOverrides(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, normalizeFeedId(String(v))]));
  } catch {
    return {};
  }
}

/** Resolve our symbols to Hermes feed ids. Unknown symbols are dropped, never guessed. */
export async function resolveFeedIds(
  symbols: string[],
  f: Fetch = fetch,
  apiKey?: string,
  overrides: Record<string, string> = {},
  now = Date.now(),
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!apiKey) return out;

  for (const symbol of symbols) {
    const feedSymbol = PYTH_SYMBOLS[symbol];
    if (!feedSymbol) continue;
    if (overrides[symbol]) {
      out[symbol] = overrides[symbol];
      continue;
    }
    const cached = feedCache.get(symbol);
    if (cached && now - cached.at < FEED_CACHE_TTL_MS) {
      out[symbol] = cached.id;
      continue;
    }
    const ticker = feedSymbol.split(".")[2]?.split("/")[0] ?? symbol;
    try {
      const res = await f(`${PYTH_HERMES_BASE}/v2/price_feeds?query=${encodeURIComponent(ticker)}&asset_type=equity`, {
        headers: headers(apiKey),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const feeds = (await res.json()) as HermesFeed[];
      const match = feeds.find((feed) => feed.attributes?.symbol === feedSymbol);
      if (!match?.id) continue;
      const id = normalizeFeedId(match.id);
      feedCache.set(symbol, { id, at: now });
      out[symbol] = id;
    } catch {
      // Pyth is an extra source, never a hard dependency: fall through to the other sources.
    }
  }
  return out;
}

/** Latest prices for the given feed ids, keyed by normalized feed id. */
export async function fetchPythLatest(
  feedIds: string[],
  f: Fetch = fetch,
  apiKey?: string,
): Promise<Record<string, PythReading>> {
  if (!apiKey || feedIds.length === 0) return {};
  const qs = feedIds.map((id) => `ids%5B%5D=0x${normalizeFeedId(id)}`).join("&");
  const res = await f(`${PYTH_HERMES_BASE}/v2/updates/price/latest?${qs}&parsed=true&encoding=hex`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pyth ${res.status}`);
  const body = (await res.json()) as { parsed?: HermesParsed[] };
  const out: Record<string, PythReading> = {};
  for (const row of body.parsed ?? []) {
    const norm = normalizePythPrice(row.price);
    if (!norm) continue;
    const feedId = normalizeFeedId(row.id);
    out[feedId] = { feedId, ...norm };
  }
  return out;
}

/** One call for the signer: symbols in, readings out. Returns `{}` when no API key is configured. */
export async function readPyth(
  symbols: string[],
  f: Fetch = fetch,
  apiKey?: string,
  overrides: Record<string, string> = {},
): Promise<Record<string, PythReading>> {
  const ids = await resolveFeedIds(symbols, f, apiKey, overrides);
  const entries = Object.entries(ids);
  if (entries.length === 0) return {};
  const byFeed = await fetchPythLatest(
    entries.map(([, id]) => id),
    f,
    apiKey,
  ).catch(() => ({}) as Record<string, PythReading>);
  const out: Record<string, PythReading> = {};
  for (const [symbol, id] of entries) {
    const reading = byFeed[id];
    if (reading) out[symbol] = reading;
  }
  return out;
}
