/**
 * MockCardProvider — the default CardProvider (parameters.md §3).
 * Settles purchases on devnet: transferChecked from the owner's dUSDC ATA to
 * the merchant settlement ATA, with CARD_AUTHORITY as the SPL delegate.
 */
import { randomInt, randomUUID } from "node:crypto";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createTransferCheckedInstruction } from "@solana/spl-token";
import { kvGet, kvListPush, kvListRead, kvSet } from "../kv";
import { ensureAta, keypairFromEnv, serverConnection, usdcBalanceAndDelegate, usdcMint } from "../solana";
import { CardError, type Card, type CardProvider, type CardTransaction, type DeclineReason } from "./provider";

const cardKey = (owner: string) => `card:${owner}`;
const txsKey = (owner: string) => `txs:${owner}`;

function cardNumber(network: "VISA" | "MASTERCARD"): string {
  let digits = network === "VISA" ? "4" : "5";
  for (let i = 0; i < 15; i++) digits += String(randomInt(10));
  return digits;
}

export class MockCardProvider implements CardProvider {
  name = "mock" as const;

  async createCard(input: { owner: string; holderName: string; network: "VISA" | "MASTERCARD" }): Promise<Card> {
    const existing = await this.getCard(input.owner);
    if (existing) return existing;
    const number = cardNumber(input.network);
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 3);
    const card: Card = {
      id: randomUUID(),
      owner: input.owner,
      last4: number.slice(-4),
      expMonth: expiry.getMonth() + 1,
      expYear: expiry.getFullYear(),
      holderName: input.holderName,
      network: input.network,
      provider: "mock",
      status: "active",
      tier: "standard",
      cashbackMint: process.env.NEXT_PUBLIC_MINT_NVDAX ?? "",
      createdAt: Date.now(),
    };
    await kvSet(cardKey(input.owner), card);
    return card;
  }

  async getCard(owner: string): Promise<Card | null> {
    return kvGet<Card>(cardKey(owner));
  }

  async saveCard(card: Card): Promise<void> {
    await kvSet(cardKey(card.owner), card);
  }

  async simulatePurchase(input: {
    owner: string;
    merchant: string;
    category: string;
    amountUsd6: bigint;
  }): Promise<CardTransaction> {
    const card = await this.getCard(input.owner);
    if (!card) throw new CardError("NO_CARD", "Create your card first.");

    const base: CardTransaction = {
      id: randomUUID(),
      merchant: input.merchant,
      category: input.category,
      amountUsd6: input.amountUsd6.toString(),
      status: "pending",
      cashback: null,
      createdAt: Date.now(),
    };

    const decline = async (reason: DeclineReason): Promise<CardTransaction> => {
      const tx: CardTransaction = { ...base, status: "declined", declineReason: reason };
      await kvListPush(txsKey(input.owner), tx, { maxLen: 100 });
      return tx;
    };

    if (card.status === "frozen") return decline("FROZEN");

    const owner = new PublicKey(input.owner);
    const { balance, delegate, delegatedAmount } = await usdcBalanceAndDelegate(owner);
    const cardAuthority = keypairFromEnv("CARD_AUTHORITY_SECRET");

    if (!delegate || !delegate.equals(cardAuthority.publicKey) || delegatedAmount < input.amountUsd6) {
      return decline("LIMIT");
    }
    if (balance < input.amountUsd6) return decline("FUNDS");

    const settlementOwner = new PublicKey(process.env.MERCHANT_SETTLEMENT_ADDRESS ?? "");
    const connection = serverConnection();
    const mint = usdcMint();
    const source = (await usdcBalanceAndDelegate(owner)).ata;
    const { ata: destination, createIx } = await ensureAta(
      connection,
      cardAuthority.publicKey,
      mint,
      settlementOwner,
      TOKEN_PROGRAM_ID,
    );

    const transaction = new Transaction();
    if (createIx) transaction.add(createIx);
    transaction.add(
      createTransferCheckedInstruction(
        source,
        mint,
        destination,
        cardAuthority.publicKey, // delegate signs for the owner's ATA
        input.amountUsd6,
        6,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    transaction.feePayer = cardAuthority.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    transaction.sign(cardAuthority);
    const settlementSig = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(settlementSig, "confirmed");

    const tx: CardTransaction = { ...base, status: "settled", settlementSig };
    await kvListPush(txsKey(input.owner), tx, { maxLen: 100 });
    return tx;
  }

  async listTransactions(owner: string): Promise<CardTransaction[]> {
    return kvListRead<CardTransaction>(txsKey(owner), 100);
  }
}
