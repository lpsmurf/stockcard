/** Active payout provider, chosen by PAYOUT_PROVIDER (parameters.md §3d). */
import { mockPayoutProvider } from "./mock";
import { bridgePayoutProvider } from "./bridge";
import type { PayoutProvider } from "./provider";

export function payoutProvider(): PayoutProvider {
  return process.env.PAYOUT_PROVIDER === "bridge" ? bridgePayoutProvider : mockPayoutProvider;
}

export * from "./provider";
