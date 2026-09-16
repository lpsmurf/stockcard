/**
 * Pure alert copy and band rules (parameters.md §4). No storage or env imports, so this
 * module can be unit-checked directly with `node --test`.
 */
import type { AlertBand } from "./risk";

/** parameters.md §4 push copy. `add`/`repay` are preformatted strings. */
export function alertCopy(
  band: Exclude<AlertBand, "healthy" | "watch">,
  v: { symbol: string; ltvPct: string; liqPct: string; add: string; repay: string },
): { title: string; body: string } {
  switch (band) {
    case "warning":
      return {
        title: `${v.symbol} dropped`,
        body: `Your credit line is at ${v.ltvPct}. Add ${v.add} ${v.symbol} or repay ${v.repay} to stay safe.`,
      };
    case "urgent":
      return {
        title: "Close to liquidation",
        body: `At ${v.liqPct} your ${v.symbol} can be sold. Add ${v.add} ${v.symbol} or repay ${v.repay} now.`,
      };
    case "liquidatable":
      return {
        title: "Your position can be liquidated",
        body: `Repay ${v.repay} or add ${v.add} ${v.symbol} to stop it.`,
      };
  }
}

const NOTIFYING: AlertBand[] = ["warning", "urgent", "liquidatable"];
export function shouldNotify(band: AlertBand, lastNotified: AlertBand | null): boolean {
  if (!NOTIFYING.includes(band)) return false;
  if (!lastNotified) return true;
  // Only on entering a worse band; never on improvement (parameters.md §4).
  return NOTIFYING.indexOf(band) > NOTIFYING.indexOf(lastNotified);
}

