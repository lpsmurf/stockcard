import { err, ok } from "@/lib/api";
import { kvGet, kvSet } from "@/lib/kv";
import { readPreIpo, type PreIpoReading } from "@/lib/prices/preipo";

export const dynamic = "force-dynamic";

const CACHE_TTL_SEC = 300;

/** GET /api/preipo?symbol=T-OPENAI — provider NAV reading (mark price, token price, premium) for
 *  the Asset detail "we lend against the lower figure" line. Keyless public provider APIs, cached 5 min. */
export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "";
  if (!symbol) return err("BAD_REQUEST", "Pass ?symbol=.", 400);

  const cacheKey = `preipo:${symbol}`;
  const cached = await kvGet<PreIpoReading>(cacheKey).catch(() => null);
  if (cached) return ok(cached);

  const readings = await readPreIpo([symbol]).catch(() => ({} as Record<string, PreIpoReading>));
  const reading = readings[symbol];
  if (!reading) return err("NOT_FOUND", `No pre-IPO reading for ${symbol}.`, 404);
  await kvSet(cacheKey, reading, { ttlSec: CACHE_TTL_SEC }).catch(() => {});
  return ok(reading);
}
