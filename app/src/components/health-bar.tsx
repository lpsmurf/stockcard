import { formatPct, health, type Health } from "@/lib/risk";

const LABEL: Record<Health, string> = { healthy: "Healthy", watch: "Above max LTV", atRisk: "At risk of liquidation" };
const COLOR: Record<Health, string> = { healthy: "var(--good)", watch: "var(--warn)", atRisk: "var(--bad)" };

/** Segmented LTV bar with max-LTV and liquidation markers. State is shown as text as well as color. */
export function HealthBar({ ltvBps, maxLtvBps, liqThresholdBps }: { ltvBps: bigint; maxLtvBps: bigint; liqThresholdBps: bigint }) {
  const state = health(ltvBps, maxLtvBps, liqThresholdBps);
  const pct = (v: bigint) => `${Math.min(100, Number(v) / 100)}%`;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold" style={{ color: COLOR[state] }}>{LABEL[state]}</span>
        <span className="font-mono text-ink-2 tabular">LTV {formatPct(ltvBps)}</span>
      </div>
      <div
        className="relative h-2.5 rounded-full bg-rule"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Number(ltvBps) / 100)}
        aria-label="Loan to value"
      >
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(ltvBps), background: COLOR[state] }} />
        <span className="absolute -top-1 h-4.5 w-px bg-ink-2" style={{ left: pct(maxLtvBps) }} />
        <span className="absolute -top-1 h-4.5 w-px bg-bad" style={{ left: pct(liqThresholdBps) }} />
      </div>
      <div className="relative h-4 font-mono text-[11px] text-ink-3">
        <span className="absolute -translate-x-1/2" style={{ left: pct(maxLtvBps) }}>max {formatPct(maxLtvBps)}</span>
        <span className="absolute -translate-x-1/2 text-bad" style={{ left: pct(liqThresholdBps) }}>liq. {formatPct(liqThresholdBps)}</span>
      </div>
    </div>
  );
}
