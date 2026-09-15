export function ExplorerLink({ sig, cluster = "devnet", className }: { sig: string; cluster?: string; className?: string }) {
  return (
    <a
      href={`https://explorer.solana.com/tx/${sig}?cluster=${cluster}`}
      target="_blank"
      rel="noreferrer"
      className={`font-mono text-xs text-brass underline decoration-brass/40 underline-offset-2 ${className ?? ""}`}
    >
      View on explorer ↗
    </a>
  );
}
