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
  market_hours?: { is_open?: boolean; next_open?: number; next_close?: number };
}

/**
 * What Pyth can tell us about one market. `reading` needs a Pyth Pro grant for equities
 * (the free tier answers 403 "Not entitled" for asset type 'equity'), but `marketOpen` comes
 * from the feed metadata, which is free — so the trading calendar works with or without Pro.
 */
export interface PythFeedStatus {
  feedId: string;
  reading: PythReading | null;
  /** Pyth's own NYSE calendar: holidays and half-days included. Null when unknown. */
  marketOpen: boolean | null;
  nextOpen?: number;
  /** False when the key can read metadata but not prices for this asset class. */
  entitled: boolean;
}

interface FeedMeta {
  id: string;
  marketOpen: boolean | null;
  nextOpen?: number;
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

/**
 * Feed ids change rarely, so they're cached for a day. Market hours are re-read every
 * MARKET_HOURS_TTL_MS — an open/closed flag we cached for a day would be worse than useless.
 */
const feedCache = new Map<string, { id: string; at: number }>();
const hoursCache = new Map<string, { marketOpen: boolean | null; nextOpen?: number; at: number }>();
const MARKET_HOURS_TTL_MS = 60 * 1000;

export function parseFeedOverrides(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, normalizeFeedId(String(v))]));
  } catch {
    return {};
  }
}

/**
 * Resolve our symbols to Hermes feed ids and their trading calendar.
 * Unknown symbols are dropped, never guessed. The `Equity.Index.<T>/USD` 24/7 variant is not
 * the listed market and is deliberately not matched.
 */
export async function resolveFeedIds(
  symbols: string[],
  f: Fetch = fetch,
  apiKey?: string,
  overrides: Record<string, string> = {},
  now = Date.now(),
): Promise<Record<string, FeedMeta>> {
  const out: Record<string, FeedMeta> = {};
  if (!apiKey) return out;

  for (const symbol of symbols) {
    const feedSymbol = PYTH_SYMBOLS[symbol];
    if (!feedSymbol) continue;

    const cachedId = overrides[symbol] ?? feedCache.get(symbol)?.id;
    const cachedIdFresh = Boolean(overrides[symbol]) || (feedCache.get(symbol) && now - feedCache.get(symbol)!.at < FEED_CACHE_TTL_MS);
    const cachedHours = hoursCache.get(symbol);
    if (cachedId && cachedIdFresh && cachedHours && now - cachedHours.at < MARKET_HOURS_TTL_MS) {
      out[symbol] = { id: cachedId, marketOpen: cachedHours.marketOpen, nextOpen: cachedHours.nextOpen };
      continue;
    }

    const ticker = feedSymbol.split(".")[2]?.split("/")[0] ?? symbol;
    try {
      const res = await f(`${PYTH_HERMES_BASE}/v2/price_feeds?query=${encodeURIComponent(ticker)}&asset_type=equity`, {
        headers: headers(apiKey),
        cache: "no-store",
      });
      if (!res.ok) {
        if (cachedId) out[symbol] = { id: cachedId, marketOpen: null };
        continue;
      }
      const feeds = (await res.json()) as HermesFeed[];
      const match = feeds.find((feed) => feed.attributes?.symbol === feedSymbol);
      if (!match?.id) continue;
      const id = normalizeFeedId(match.id);
      const marketOpen = typeof match.market_hours?.is_open === "boolean" ? match.market_hours.is_open : null;
      const nextOpen = match.market_hours?.next_open ? match.market_hours.next_open * 1000 : undefined;
      feedCache.set(symbol, { id, at: now });
      hoursCache.set(symbol, { marketOpen, nextOpen, at: now });
      out[symbol] = { id, marketOpen, nextOpen };
    } catch {
      // Pyth is an extra source, never a hard dependency: fall through to the other sources.
      if (cachedId) out[symbol] = { id: cachedId, marketOpen: null };
    }
  }
  return out;
}

/** Thrown when the key is valid but has no grant for this asset class (free tier on equities). */
export class PythNotEntitledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythNotEntitledError";
  }
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
  if (res.status === 403) {
    throw new PythNotEntitledError("Pyth key has no grant for these feeds (equities need Pyth Pro)");
  }
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

/**
 * One call for the signer: symbols in, price + trading calendar out.
 * Returns `{}` when no API key is configured. On a free-tier key the prices come back null and
 * `entitled: false`, but the market-hours flags are still populated and still useful.
 */
export async function readPyth(
  symbols: string[],
  f: Fetch = fetch,
  apiKey?: string,
  overrides: Record<string, string> = {},
): Promise<Record<string, PythFeedStatus>> {
  const metas = await resolveFeedIds(symbols, f, apiKey, overrides);
  const entries = Object.entries(metas);
  if (entries.length === 0) return {};

  let entitled = true;
  const byFeed = await fetchPythLatest(
    entries.map(([, meta]) => meta.id),
    f,
    apiKey,
  ).catch((e: unknown) => {
    if (e instanceof PythNotEntitledError) entitled = false;
    return {} as Record<string, PythReading>;
  });

  const out: Record<string, PythFeedStatus> = {};
  for (const [symbol, meta] of entries) {
    out[symbol] = {
      feedId: meta.id,
      reading: byFeed[meta.id] ?? null,
      marketOpen: meta.marketOpen,
      nextOpen: meta.nextOpen,
      entitled,
    };
  }
  return out;
}
