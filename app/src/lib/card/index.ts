/** Active CardProvider, selected by CARD_PROVIDER (parameters.md §3). */
import { BridgeCardProvider } from "./bridge";
import { MockCardProvider } from "./mock";
import type { CardProvider } from "./provider";

let cached: CardProvider | null = null;

export function getCardProvider(): CardProvider {
  if (!cached) {
    cached = (process.env.CARD_PROVIDER ?? "mock") === "bridge" ? new BridgeCardProvider() : new MockCardProvider();
  }
  return cached;
}

export type { Card, CardProvider, CardTransaction, DeclineReason } from "./provider";
export { CardError } from "./provider";
