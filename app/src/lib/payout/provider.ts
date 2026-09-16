/**
 * Send to bank (SEPA) — provider interface and shared types (US9, contracts/api.md).
 * `mock` moves real devnet USDC to PAYOUT_ADDRESS and simulates the SEPA leg;
 * `bridge` will route the same transfer through a Bridge liquidation address.
 */

export interface BankAccount {
  id: string;
  holderName: string;
  last4: string;
  country: string;
  bic?: string;
  provider: "mock" | "bridge";
  providerAccountId?: string;
  payoutAddress: string;
  createdAt: number;
}

export interface PayoutQuote {
  quoteId: string;
  bankAccountId: string;
  eurCents: number;
  /** USDC base units (6 decimals) the user must transfer. */
  usdc6: string;
  rate: number;
  rateAt: string;
  providerFeeCents: number;
  stockcardFeeCents: number;
  receiveCents: number;
  payoutAddress: string;
  rail: "sepa_instant" | "sepa";
  eta: string;
  expiresAt: number;
}

export type PayoutStatus = "processing" | "arrived" | "failed" | "returned";

export interface Payout {
  id: string;
  bankAccountId: string;
  bankLast4: string;
  eurCents: number;
  usdc6: string;
  rate: number;
  providerFeeCents: number;
  stockcardFeeCents: number;
  receiveCents: number;
  borrowed: boolean;
  transferSig: string;
  providerTransferId?: string;
  sepaReference: string;
  rail: "sepa_instant" | "sepa";
  status: PayoutStatus;
  purpose?: string;
  simulated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PayoutProvider {
  name: "mock" | "bridge";
  addBankAccount(input: { owner: string; holderName: string; iban: string; bic?: string }): Promise<BankAccount>;
  listBankAccounts(owner: string): Promise<BankAccount[]>;
  removeBankAccount(owner: string, id: string): Promise<boolean>;
  quote(input: { owner: string; bankAccountId: string; eurCents: number; tier?: Tier }): Promise<PayoutQuote>;
  confirm(input: { owner: string; quoteId: string; transferSig: string; purpose?: string; borrowed?: boolean }): Promise<Payout>;
  list(owner: string): Promise<Payout[]>;
}

export type Tier = "standard" | "plus" | "black";

/** parameters.md §3d: 0.50% Standard · 0.25% Plus · 0% Black, minimum €1 when charged. */
export function stockcardFeeCents(eurCents: number, tier: Tier = "standard"): number {
  const bps = tier === "black" ? 0 : tier === "plus" ? 25 : 50;
  if (bps === 0) return 0;
  return Math.max(100, Math.round((eurCents * bps) / 10_000));
}

export const MIN_EUR_CENTS = 1_000; // €10
export const MAX_EUR_CENTS = 5_000_000; // €50,000
export const PURPOSE_REQUIRED_ABOVE_CENTS = 1_000_000; // €10,000
export const QUOTE_TTL_MS = 60_000;

export function eurToUsdc6(eurCents: number, rateEurPerUsd: number): bigint {
  // rate is EUR per 1 USD (ECB style), so USD = EUR / rate.
  const usd = eurCents / 100 / rateEurPerUsd;
  return BigInt(Math.ceil(usd * 1e6));
}

export function sepaReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `SC-${out}`;
}

/** ECB reference rate via Frankfurter (free, no key). Cached by the caller. */
export async function fetchEurRate(f: typeof fetch = fetch): Promise<{ rate: number; rateAt: string }> {
  const res = await f("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR", { cache: "no-store" });
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
  const body = (await res.json()) as { date: string; rates: { EUR: number } };
  return { rate: body.rates.EUR, rateAt: body.date };
}
