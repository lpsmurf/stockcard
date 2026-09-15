/**
 * CardProvider interface (contracts/api.md) and the off-chain record shapes
 * from data-model.md. Base-unit amounts are decimal strings (JSON-safe bigint).
 */

export interface Card {
  id: string;
  owner: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  network: "VISA" | "MASTERCARD";
  provider: "mock" | "bridge";
  providerRef?: string;
  status: "active" | "frozen";
  tier: "standard" | "plus" | "black";
  cashbackMint: string;
  createdAt: number;
}

export type DeclineReason = "FROZEN" | "LIMIT" | "FUNDS";

export interface CardTransaction {
  id: string;
  merchant: string;
  category: string;
  amountUsd6: string;
  status: "pending" | "settled" | "declined";
  declineReason?: DeclineReason;
  settlementSig?: string;
  cashback: {
    mint: string;
    amount: string;
    usd6: string;
    sig?: string;
    status: "queued" | "sent" | "failed";
  } | null;
  createdAt: number;
}

export interface CardProvider {
  name: "mock" | "bridge";
  createCard(input: { owner: string; holderName: string; network: "VISA" | "MASTERCARD" }): Promise<Card>;
  getCard(owner: string): Promise<Card | null>;
  simulatePurchase(input: { owner: string; merchant: string; category: string; amountUsd6: bigint }): Promise<CardTransaction>;
  listTransactions(owner: string): Promise<CardTransaction[]>;
}

export class CardError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
