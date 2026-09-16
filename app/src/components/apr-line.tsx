import { formatPct, selectAprBps, type RateBand } from "@/lib/risk";

/** "APR 12.9% · drops to 9.9% under 20% LTV" — current band at the given LTV, plus the next-lower band if one exists. */
export function AprLine({ bands, ltvBps, className }: { bands: RateBand[]; ltvBps: bigint; className?: string }) {
  const live = bands.filter((b) => b.maxLtvBps > 0 && b.aprBps > 0).sort((a, b) => a.maxLtvBps - b.maxLtvBps);
  if (live.length === 0) return null;
  const current = selectAprBps(bands, ltvBps);
  const currentIdx = live.findIndex((b) => ltvBps <= BigInt(b.maxLtvBps));
  const idx = currentIdx === -1 ? live.length - 1 : currentIdx;
  const lower = idx > 0 ? live[idx - 1] : undefined;

  return (
    <p className={className ?? "text-xs text-ink-3"}>
      APR {formatPct(BigInt(current))}
      {lower ? (
        <>
          {" · drops to "}
          {formatPct(BigInt(lower.aprBps))} under {formatPct(BigInt(lower.maxLtvBps))} LTV
        </>
      ) : null}
    </p>
  );
}
