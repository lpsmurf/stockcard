import { formatUsd } from "@/lib/risk";

export function PreviewRow({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" | "brass" }) {
  const color =
    tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "brass" ? "text-brass" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-2">{label}</span>
      <span className={`font-mono text-sm tabular ${color}`}>{value}</span>
    </div>
  );
}

export const usd = (v: bigint) => formatUsd(v);
