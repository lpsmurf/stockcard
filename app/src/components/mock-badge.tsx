export function MockBadge({ label = "Devnet mock" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-brass/60 px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.08em] text-brass">
      {label}
    </span>
  );
}
