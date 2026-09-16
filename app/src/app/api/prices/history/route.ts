import { err, ok } from "@/lib/api";
import { kvGet, kvSet } from "@/lib/kv";
import { MARKETS } from "@/lib/config";
import {
  COINGECKO_IDS,
  changePct,
  fetchCoingecko,
  labelFor,
  normalizeDays,
  withinWindow,
  type HistorySeries,
} from "@/lib/prices/history";

/**
 * GET /api/prices/history?symbol=NVDAx&days=90  (T077, contracts/api.md)
 * Public read. Cached in Redis for 1 hour so the client never hits CoinGecko directly.
 */

export const dynamic = "force-dynamic";

const CACHE_TTL_SEC = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  const days = normalizeDays(url.searchParams.get("days"));

  const market = MARKETS.find((m) => m.symbol.toLowerCase() === symbol.toLowerCase());
  if (!market) return err("NOT_FOUND", `We don't have a market called "${symbol}".`, 404);

  const cacheKey = `hist:${market.symbol}:${days}`;
  const cached = await kvGet<HistorySeries>(cacheKey).catch(() => null);
  if (cached) return ok(cached);

  // Our own posted valuations (art notes, collectibles) and any demo crash points.
  const posted = (await kvGet<[number, number][]>(`pricehist:${market.symbol}`).catch(() => null)) ?? [];
  const demoPoints = withinWindow((await kvGet<[number, number][]>(`pricedemo:${market.symbol}`).catch(() => null)) ?? [], days);

  let points: [number, number][] = [];
  let source: HistorySeries["source"] = "none";

  const cgId = COINGECKO_IDS[market.symbol];
  if (cgId) {
    try {
      points = withinWindow(await fetchCoingecko(cgId, days, fetch, process.env.COINGECKO_DEMO_API_KEY), days);
      source = points.length ? "coingecko" : "none";
    } catch {
      source = "none";
    }
  }
  if (!points.length && posted.length) {
    points = withinWindow(posted, days);
    source = points.length ? "signed" : "none";
  }

  const series: HistorySeries = {
    symbol: market.symbol,
    source,
    label: labelFor(market.symbol, source),
    points,
    demoPoints,
    changePct: changePct(points),
  };

  // Only cache a series we actually got data for; a failed upstream shouldn't stick for an hour.
  if (points.length) await kvSet(cacheKey, series, { ttlSec: CACHE_TTL_SEC }).catch(() => {});
  return ok(series);
}
