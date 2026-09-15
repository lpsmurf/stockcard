/**
 * BridgeCardProvider — issuer-agnostic seam for a real card program
 * (constitution IV). Honest stub for the MVP: not configured unless
 * BRIDGE_API_KEY is set, and not implemented even then.
 */
import { CardError, type Card, type CardProvider, type CardTransaction } from "./provider";

export class BridgeCardProvider implements CardProvider {
  name = "bridge" as const;

  private guard(): never {
    if (!process.env.BRIDGE_API_KEY) {
      throw new CardError("BRIDGE_NOT_CONFIGURED", "Bridge sandbox not configured.");
    }
    throw new CardError("NOT_IMPLEMENTED", "Bridge card issuing isn't implemented in the MVP demo.");
  }

  createCard(): Promise<never> {
    this.guard();
  }

  getCard(): Promise<Card | null> {
    this.guard();
  }

  simulatePurchase(): Promise<CardTransaction> {
    this.guard();
  }

  listTransactions(): Promise<CardTransaction[]> {
    this.guard();
  }
}
