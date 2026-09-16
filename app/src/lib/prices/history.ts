/**
 * 90-day price history (T077, parameters.md "Price history").
 * Equities: CoinGecko daily closes for the mainnet xStock token (our devnet mints are mocks,
 * so the chart is labelled as a reference). Art notes and collectibles: the valuations we
 * posted ourselves, stored as a step series. Demo crashes are returned separately so the
 * chart can mark them.
 */

export const COINGECKO_IDS: Record<string, string> = {
  NVDAx: "nvidia-xstock",
  SPYx: "sp500-xstock",
  TSLAx: "tesla-xstock",
};

export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export interface HistorySeries {
  symbol: string;
  source: "coingecko" | "signed" | "none";
  label: string;
  points: [number, number][]; // [msSinceEpoch, priceUsd]
  demoPoints: [number, number][];
  changePct: number | null;
}

export function normalizeDays(raw: string | null): RangeDays {
  const n = Number(raw);
  return (RANGE_DAYS as readonly number[]).includes(n) ? (n as RangeDays) : 90;
}

export function changePct(points: [number, number][]): number | null {
  if (points.length < 2) return null;
  const first = points[0][1];
  const last = points[points.length - 1][1];
  if (!first) return null;
  return ((last - first) / first) * 100;
}

/** Keep only points inside the window, oldest first. */
export function withinWindow(points: [number, number][], days: number, now = Date.now()): [number, number][] {
  const from = now - days * 86_400_000;
  return points.filter(([t]) => t >= from).sort((a, b) => a[0] - b[0]);
}

type Fetch = typeof fetch;

export async function fetchCoingecko(id: string, days: number, f: Fetch = fetch, apiKey?: string): Promise<[number, number][]> {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await f(url, {
    headers: apiKey ? { "x-cg-demo-api-key": apiKey } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const body = (await res.json()) as { prices?: [number, number][] };
  return (body.prices ?? []).map(([t, p]) => [t, Math.round(p * 100) / 100] as [number, number]);
}

/** Label under the chart, so nobody mistakes a reference price for the devnet mock's own price. */
export function labelFor(symbol: string, source: HistorySeries["source"]): string {
  if (source === "coingecko") return "Mainnet xStock price · reference";
  if (source === "signed") return "Valuations we posted on-chain";
  return "No price history yet";
}
