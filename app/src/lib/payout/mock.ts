/**
 * Mock SEPA payout provider (US9). The on-chain leg is real: the user transfers devnet USDC
 * to PAYOUT_ADDRESS and we verify it. The bank leg is simulated: Processing → Arrived after 10 s,
 * and every row is labelled "Simulated SEPA payout".
 */
import { randomUUID, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { kvGet, kvListPush, kvListRead, kvSet } from "../kv";
import { serverConnection, usdcMint } from "../solana";
import { validateIban } from "../iban";
import {
  MIN_EUR_CENTS,
  MAX_EUR_CENTS,
  QUOTE_TTL_MS,
  eurToUsdc6,
  fetchEurRate,
  sepaReference,
  stockcardFeeCents,
  type BankAccount,
  type Payout,
  type PayoutProvider,
  type PayoutQuote,
  type Tier,
} from "./provider";

const ARRIVAL_DELAY_MS = 10_000;
const RATE_CACHE_SEC = 600;

function encryptionKey(): Buffer | null {
  const raw = process.env.BANK_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

/** AES-256-GCM: iv.tag.ciphertext, base64. Falls back to storing nothing if no key is set. */
export function encryptIban(iban: string): string {
  const key = encryptionKey();
  if (!key) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(iban, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptIban(payload: string): string | null {
  const key = encryptionKey();
  if (!key || !payload) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function payoutAddress(): string {
  const addr = process.env.PAYOUT_ADDRESS;
  if (!addr) throw new Error("PAYOUT_ADDRESS is not set");
  return addr;
}

async function cachedRate(): Promise<{ rate: number; rateAt: string }> {
  const cached = await kvGet<{ rate: number; rateAt: string }>("fx:usd-eur").catch(() => null);
  if (cached) return cached;
  const fresh = await fetchEurRate();
  await kvSet("fx:usd-eur", fresh, { ttlSec: RATE_CACHE_SEC }).catch(() => {});
  return fresh;
}

/** Confirms the transfer really happened: right mint, right destination owner, right amount, signed by the user. */
export async function verifyUsdcTransfer(input: {
  signature: string;
  from: string;
  to: string;
  minAmount6: bigint;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const connection = serverConnection();
  let tx: Awaited<ReturnType<typeof connection.getParsedTransaction>> = null;
  try {
    tx = await connection.getParsedTransaction(input.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  } catch {
    return { ok: false, reason: "That doesn't look like a Solana transaction signature." };
  }
  if (!tx) return { ok: false, reason: "We can't find that transaction on devnet yet. Wait a few seconds and try again." };
  if (tx.meta?.err) return { ok: false, reason: "That transaction failed on-chain." };

  const signers = tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey.toBase58());
  if (!signers.includes(input.from)) return { ok: false, reason: "That transaction wasn't signed by your wallet." };

  const mint = usdcMint().toBase58();
  type TokenBalance = { mint: string; owner?: string; uiTokenAmount: { amount: string } };
  const owned = (list: TokenBalance[] | null | undefined) =>
    (list ?? []).filter((b) => b.mint === mint && b.owner === input.to);
  const before = owned(tx.meta?.preTokenBalances).reduce((sum, b) => sum + BigInt(b.uiTokenAmount.amount), 0n);
  const after = owned(tx.meta?.postTokenBalances).reduce((sum, b) => sum + BigInt(b.uiTokenAmount.amount), 0n);
  const delta = after - before;
  if (delta < input.minAmount6) {
    return { ok: false, reason: `That transfer moved ${delta} USDC units, we expected at least ${input.minAmount6}.` };
  }
  return { ok: true };
}

export const mockPayoutProvider: PayoutProvider = {
  name: "mock",

  async addBankAccount({ owner, holderName, iban, bic }) {
    const check = validateIban(iban);
    if (!check.ok) throw new Error(check.message);
    if (!holderName?.trim()) throw new Error("Add the account holder's name, exactly as your bank has it.");

    const existing = await this.listBankAccounts(owner);
    if (existing.length >= 3) throw new Error("You can save up to 3 bank accounts. Remove one first.");

    const account: BankAccount = {
      id: randomUUID(),
      holderName: holderName.trim(),
      last4: check.last4!,
      country: check.country!,
      bic: bic?.trim() || undefined,
      provider: "mock",
      payoutAddress: payoutAddress(),
      createdAt: Date.now(),
    };
    await kvSet(`bank:${owner}:${account.id}`, { ...account, ibanEnc: encryptIban(check.normalized!) });
    await kvSet(`bank:${owner}`, [...existing.map((a) => a.id), account.id]);
    return account;
  },

  async listBankAccounts(owner) {
    const ids = (await kvGet<string[]>(`bank:${owner}`)) ?? [];
    const rows = await Promise.all(ids.map((id) => kvGet<BankAccount & { ibanEnc?: string }>(`bank:${owner}:${id}`)));
    return rows
      .filter((row): row is BankAccount & { ibanEnc?: string } => Boolean(row))
      .map(({ id, holderName, last4, country, bic, provider, providerAccountId, payoutAddress: addr, createdAt }) => ({
        id, holderName, last4, country, bic, provider, providerAccountId, payoutAddress: addr, createdAt,
      }));
  },

  async removeBankAccount(owner, id) {
    const ids = (await kvGet<string[]>(`bank:${owner}`)) ?? [];
    if (!ids.includes(id)) return false;
    await kvSet(`bank:${owner}`, ids.filter((x) => x !== id));
    await kvSet(`bank:${owner}:${id}`, null);
    return true;
  },

  async quote({ owner, bankAccountId, eurCents, tier = "standard" as Tier }) {
    if (!Number.isInteger(eurCents) || eurCents < MIN_EUR_CENTS) throw new Error("The smallest transfer is €10.00.");
    if (eurCents > MAX_EUR_CENTS) throw new Error("The largest transfer in the demo is €50,000.00.");
    const account = (await this.listBankAccounts(owner)).find((a) => a.id === bankAccountId);
    if (!account) throw new Error("Pick one of your saved bank accounts.");

    const { rate, rateAt } = await cachedRate();
    const fee = stockcardFeeCents(eurCents, tier);
    const quote: PayoutQuote = {
      quoteId: randomUUID(),
      bankAccountId,
      eurCents,
      usdc6: eurToUsdc6(eurCents, rate).toString(),
      rate,
      rateAt,
      providerFeeCents: 0,
      stockcardFeeCents: fee,
      receiveCents: eurCents - fee,
      payoutAddress: account.payoutAddress,
      rail: "sepa_instant",
      eta: "Usually seconds (simulated on devnet)",
      expiresAt: Date.now() + QUOTE_TTL_MS,
    };
    await kvSet(`quote:${owner}:${quote.quoteId}`, quote, { ttlSec: 120 });
    return quote;
  },

  async confirm({ owner, quoteId, transferSig, purpose, borrowed = true }) {
    const quote = await kvGet<PayoutQuote>(`quote:${owner}:${quoteId}`);
    if (!quote) throw new Error("That quote expired. Get a new one and try again.");

    const existing = (await this.list(owner)).find((p) => p.transferSig === transferSig);
    if (existing) return existing; // idempotent by signature

    const payoutOwner = new PublicKey(quote.payoutAddress).toBase58();
    const verified = await verifyUsdcTransfer({
      signature: transferSig,
      from: owner,
      to: payoutOwner,
      minAmount6: BigInt(quote.usdc6),
    });
    if (!verified.ok) throw new Error(verified.reason);

    const now = Date.now();
    const account = (await this.listBankAccounts(owner)).find((a) => a.id === quote.bankAccountId);
    const payout: Payout = {
      id: randomUUID(),
      bankAccountId: quote.bankAccountId,
      bankLast4: account?.last4 ?? "----",
      eurCents: quote.eurCents,
      usdc6: quote.usdc6,
      rate: quote.rate,
      providerFeeCents: quote.providerFeeCents,
      stockcardFeeCents: quote.stockcardFeeCents,
      receiveCents: quote.receiveCents,
      borrowed,
      transferSig,
      sepaReference: sepaReference(),
      rail: quote.rail,
      status: "processing",
      purpose,
      simulated: true,
      createdAt: now,
      updatedAt: now,
    };
    await kvListPush(`payouts:${owner}`, payout, { maxLen: 100 });
    await kvSet(`quote:${owner}:${quoteId}`, null);
    return payout;
  },

  async list(owner) {
    const rows = await kvListRead<Payout>(`payouts:${owner}`, 100);
    // The simulated bank leg "arrives" 10 s after the transfer.
    return rows.map((p) =>
      p.status === "processing" && Date.now() - p.createdAt > ARRIVAL_DELAY_MS
        ? { ...p, status: "arrived" as const, updatedAt: Date.now() }
        : p,
    );
  },
};
