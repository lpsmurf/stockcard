import type { MarketInfo } from "@/lib/config";

/**
 * T041 — lightweight CSS/SVG visuals for non-equity markets on the asset detail
 * screen (S8/D8): a generative "oil on linen" canvas for ArtNote markets and a
 * graded-slab render for Collectible markets. No image dependencies; everything
 * is derived deterministically from the symbol. Equities render nothing.
 */
export function AssetVisual({ info }: { info: MarketInfo }) {
  if (info.assetClass === "ArtNote") return <ArtCanvas symbol={info.symbol} />;
  if (info.assetClass === "Collectible") return <GradedSlab info={info} />;
  return null;
}

/** Tiny deterministic hash so the canvas is stable per symbol. */
function seed(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return h;
}

/** Generative tidal-stroke canvas in brand tokens — stands in for the artwork photo. */
function ArtCanvas({ symbol }: { symbol: string }) {
  const s = seed(symbol);
  const strokes = Array.from({ length: 5 }, (_, i) => {
    const y = 24 + i * 14 + ((s >> (i * 3)) % 7);
    const a = 8 + ((s >> (i * 2)) % 6);
    return `M0 ${y} C 40 ${y - a}, 80 ${y + a}, 120 ${y - a / 2} S 200 ${y + a}, 240 ${y - a}`;
  });
  return (
    <div className="overflow-hidden rounded-2xl border border-rule bg-plaster">
      <svg viewBox="0 0 240 110" className="block h-32 w-full" role="img" aria-label={`Generative artwork for ${symbol}`}>
        <rect width="240" height="110" fill="var(--surface)" />
        {strokes.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 2 === 0 ? "var(--brass)" : "var(--ink-2)"}
            strokeOpacity={i % 2 === 0 ? 0.85 : 0.35}
            strokeWidth={i === 2 ? 5 : 2.5}
            strokeLinecap="round"
          />
        ))}
        <rect x="1" y="1" width="238" height="108" fill="none" stroke="var(--rule)" />
      </svg>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Lot 01 · Oil on linen</span>
        <span className="font-mono text-[11px] text-ink-3">Generative preview</span>
      </div>
    </div>
  );
}

/** CSS graded slab: label bar with grader/grade + cert, inner window with the item. */
function GradedSlab({ info }: { info: MarketInfo }) {
  const cert = String(40_000_000 + (seed(info.symbol) % 9_999_999));
  const isWatch = info.shopKind === "watch";
  return (
    <div className="rounded-2xl border border-rule bg-raised p-2 shadow-sm">
      <div className="flex items-center justify-between rounded-t-lg bg-ink px-3 py-2 text-plaster">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">
          {isWatch ? "Vault" : (info.grade ?? "Graded").split(" ")[0]}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em]">Cert {cert}</span>
        <span className="rounded bg-brass px-1.5 py-0.5 font-mono text-[11px] font-semibold text-on-brass">
          {info.grade ?? "Authentic"}
        </span>
      </div>
      <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-b-lg border border-t-0 border-rule bg-surface px-3 text-center">
        <span className="font-display text-lg leading-tight text-ink">{info.name}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {isWatch ? "Sealed vault capsule" : "Sealed slab"} · mirrored item
        </span>
      </div>
    </div>
  );
}
