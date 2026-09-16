"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HistorySeries } from "@/lib/prices/history";

const RANGE_DAYS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_DAYS)[number];

const PAD = { top: 14, right: 8, bottom: 22, left: 46 };

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** T077 — small SVG area chart for price history. Brass line + soft fill, crosshair/tooltip, keyboard support. */
export function PriceChart({
  symbol,
  liquidationPriceUsd = null,
  defaultDays = 90,
  compact = false,
}: {
  symbol: string;
  liquidationPriceUsd?: number | null;
  defaultDays?: RangeDays;
  compact?: boolean;
}) {
  const [days, setDays] = useState<RangeDays>(defaultDays);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const height = compact ? 140 : 200;

  const query = useQuery({
    queryKey: ["priceHistory", symbol, days],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/prices/history?symbol=${encodeURIComponent(symbol)}&days=${days}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Failed to load price history");
      return json.data as HistorySeries;
    },
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(() => {
    const data = query.data;
    if (!data) return null;
    const demoSet = new Set(data.demoPoints.map((p) => p[0]));
    const merged = [...data.points, ...data.demoPoints].sort((a, b) => a[0] - b[0]);
    return { merged, demoSet, data };
  }, [query.data]);

  const geo = useMemo(() => {
    if (!series || series.merged.length < 2) return null;
    const pts = series.merged;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    const span = maxY - minY || maxY * 0.02 || 1;
    minY -= span * 0.08;
    maxY += span * 0.08;
    const w = width - PAD.left - PAD.right;
    const h = height - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - minX) / (maxX - minX || 1)) * w;
    const y = (v: number) => PAD.top + (1 - (v - minY) / (maxY - minY)) * h;
    return { pts, minX, maxX, minY, maxY, x, y, w, h };
  }, [series, width, height]);

  const linePath = useMemo(() => {
    if (!geo) return null;
    const { pts, x, y } = geo;
    const step = series?.data.source === "signed";
    let d = `M ${x(pts[0][0])} ${y(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
      if (step) d += ` L ${x(pts[i][0])} ${y(pts[i - 1][1])} L ${x(pts[i][0])} ${y(pts[i][1])}`;
      else d += ` L ${x(pts[i][0])} ${y(pts[i][1])}`;
    }
    const area = `${d} L ${x(pts[pts.length - 1][0])} ${height - PAD.bottom} L ${x(pts[0][0])} ${height - PAD.bottom} Z`;
    return { d, area };
  }, [geo, series, height]);

  // Y ticks: 3–4, fitted to series
  const yTicks = useMemo(() => {
    if (!geo) return [];
    const out: { v: number; y: number }[] = [];
    for (let i = 0; i <= 3; i++) {
      const v = geo.minY + ((geo.maxY - geo.minY) * i) / 3;
      out.push({ v, y: geo.y(v) });
    }
    return out;
  }, [geo]);

  const xTicks = useMemo(() => {
    if (!geo) return [];
    const { minX, maxX } = geo;
    const uniq = [minX, minX + (maxX - minX) / 2, maxX];
    return uniq.map((t, i) => ({ t, x: geo.x(t), anchor: i === 0 ? "start" : i === 2 ? "end" : "middle" }) as const);
  }, [geo]);

  const data = query.data;
  const last = series?.merged[series.merged.length - 1];

  function move(delta: number) {
    if (!series || series.merged.length === 0) return;
    setActiveIdx((i) => {
      const next = i === null ? series.merged.length - 1 : i + delta;
      return Math.max(0, Math.min(series.merged.length - 1, next));
    });
  }

  const changeText =
    data?.changePct != null ? `${data.changePct >= 0 ? "+" : ""}${data.changePct.toFixed(1)}% in ${days} days` : null;

  return (
    <section aria-label={`${symbol} price history`}>
      {/* Header: latest price + change */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-lg tabular">{last ? fmtUsd(last[1]) : "—"}</p>
        {changeText ? (
          <p className={`font-mono text-sm tabular ${data!.changePct! >= 0 ? "text-good" : "text-bad"}`}>{changeText}</p>
        ) : null}
      </div>

      <div ref={wrapRef} className="mt-1 w-full">
        {query.isLoading ? (
          <div className="w-full animate-pulse rounded-xl bg-surface" style={{ height }} />
        ) : query.isError ? (
          <div className="flex items-center gap-3 py-4 text-sm text-ink-3">
            Couldn&apos;t load price history.
            <button onClick={() => void query.refetch()} className="min-h-[44px] font-semibold text-brass">
              Retry
            </button>
          </div>
        ) : !data || data.source === "none" || series!.merged.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">No price history yet</p>
        ) : series!.merged.length === 1 ? (
          <p className="py-4 text-sm text-ink-2">
            Valued once on {fmtDate(series!.merged[0][0])} · {fmtUsd(series!.merged[0][1])}
          </p>
        ) : geo && linePath ? (
          <div className="relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              height={height}
              role="img"
              tabIndex={0}
              aria-label={`${symbol} price over the last ${days} days${changeText ? `, ${changeText}` : ""}`}
              className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-brass"
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  move(-1);
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  move(1);
                } else if (e.key === "Escape") {
                  setActiveIdx(null);
                }
              }}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * width;
                let best = 0;
                let bestDist = Infinity;
                geo.pts.forEach((p, i) => {
                  const d = Math.abs(geo.x(p[0]) - px);
                  if (d < bestDist) {
                    bestDist = d;
                    best = i;
                  }
                });
                setActiveIdx(best);
              }}
              onPointerLeave={() => setActiveIdx(null)}
            >
              {/* Y ticks */}
              {yTicks.map((t, i) => (
                <g key={i}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={t.y} y2={t.y} stroke="var(--color-rule)" strokeWidth={i === 0 || i === yTicks.length - 1 ? 0 : 0.5} />
                  <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize={10} fill="var(--color-ink-3)" fontFamily="var(--font-plex-mono), monospace">
                    {fmtUsd(t.v)}
                  </text>
                </g>
              ))}
              {/* X ticks */}
              {xTicks.map((t, i) => (
                <text key={i} x={t.x} y={height - 6} textAnchor={t.anchor} fontSize={10} fill="var(--color-ink-3)" fontFamily="var(--font-plex-mono), monospace">
                  {fmtDate(t.t)}
                </text>
              ))}

              {/* Area + line */}
              <path d={linePath.area} fill="var(--color-brass)" opacity={0.12} />
              <path d={linePath.d} fill="none" stroke="var(--color-brass)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

              {/* Liquidation overlay */}
              {liquidationPriceUsd != null && liquidationPriceUsd > 0 ? (
                liquidationPriceUsd >= geo.minY && liquidationPriceUsd <= geo.maxY ? (
                  <g>
                    <line
                      x1={PAD.left}
                      x2={width - PAD.right}
                      y1={geo.y(liquidationPriceUsd)}
                      y2={geo.y(liquidationPriceUsd)}
                      stroke="var(--color-bad)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    <text x={width - PAD.right} y={geo.y(liquidationPriceUsd) - 4} textAnchor="end" fontSize={10} fill="var(--color-bad)" fontFamily="var(--font-plex-mono), monospace">
                      Liquidation {fmtUsd(liquidationPriceUsd)}
                    </text>
                  </g>
                ) : liquidationPriceUsd < geo.minY && last ? (
                  <text x={width - PAD.right} y={height - PAD.bottom - 4} textAnchor="end" fontSize={10} fill="var(--color-bad)" fontFamily="var(--font-plex-mono), monospace">
                    Liquidation {fmtUsd(liquidationPriceUsd)} (−{(100 - (liquidationPriceUsd / last[1]) * 100).toFixed(1)}%) ↓
                  </text>
                ) : null
              ) : null}

              {/* Demo points */}
              {geo.pts.map((p, i) =>
                series!.demoSet.has(p[0]) ? (
                  <circle key={`demo-${i}`} cx={geo.x(p[0])} cy={geo.y(p[1])} r={3} fill="var(--color-raised)" stroke="var(--color-ink-2)" strokeWidth={1.5} />
                ) : null,
              )}

              {/* Current price dot */}
              <circle cx={geo.x(geo.pts[geo.pts.length - 1][0])} cy={geo.y(geo.pts[geo.pts.length - 1][1])} r={3.5} fill="var(--color-brass)" />

              {/* Crosshair */}
              {activeIdx !== null ? (
                <g>
                  <line
                    x1={geo.x(geo.pts[activeIdx][0])}
                    x2={geo.x(geo.pts[activeIdx][0])}
                    y1={PAD.top}
                    y2={height - PAD.bottom}
                    stroke="var(--color-ink-3)"
                    strokeWidth={0.75}
                  />
                  <circle cx={geo.x(geo.pts[activeIdx][0])} cy={geo.y(geo.pts[activeIdx][1])} r={4} fill="var(--color-brass)" stroke="var(--color-raised)" strokeWidth={1.5} />
                </g>
              ) : null}
            </svg>

            {/* Tooltip */}
            {activeIdx !== null ? (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-rule bg-raised px-2.5 py-1.5 text-xs shadow-md"
                style={{
                  left: Math.min(Math.max((geo.x(geo.pts[activeIdx][0]) / width) * 100, 15), 85) + "%",
                  top: 0,
                }}
                role="status"
              >
                <p className="font-mono tabular text-ink">{fmtUsd(geo.pts[activeIdx][1])}</p>
                <p className="text-ink-3">
                  {fmtDate(geo.pts[activeIdx][0])}
                  {series!.demoSet.has(geo.pts[activeIdx][0]) ? " · Demo price" : ""}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Range chips */}
      <div className="mt-2 flex gap-1" role="group" aria-label="Chart range">
        {RANGE_DAYS.map((d) => (
          <button
            key={d}
            aria-pressed={days === d}
            onClick={() => {
              setDays(d);
              setActiveIdx(null);
            }}
            className={`min-h-[36px] rounded-full px-3 text-xs font-semibold ${days === d ? "bg-brass-soft text-brass" : "text-ink-3"}`}
          >
            {d}D
          </button>
        ))}
      </div>

      {data?.label ? <p className="mt-1 text-xs text-ink-3">{data.label}</p> : null}
    </section>
  );
}
