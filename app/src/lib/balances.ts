/**
 * `useBalances()` — Home balances (T076). Computed client-side, which contracts/api.md allows for
 * `GET /api/wallet/balances` ("same shape"). The maths lives in `balances-core.ts`.
 *
 * Reuses `usePortfolio()` for everything on our markets (locked + wallet amounts, SignedPrice,
 * haircut value, debt), then adds the card USDC, SOL, and any other token in the wallet.
 */
"use client";

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { USDC_MINT } from "./config";
import { usePortfolio } from "./portfolio";
import { SOL_MINT, buildBalances, type Balances } from "./balances-core";

export type { Balances, Holding } from "./balances-core";

const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v3";

async function solPriceUsd6(): Promise<bigint | null> {
  try {
    const res = await fetch(`${JUPITER_PRICE_URL}?ids=${SOL_MINT}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, { usdPrice?: number }>;
    const price = body[SOL_MINT]?.usdPrice;
    return typeof price === "number" && price > 0 ? BigInt(Math.round(price * 1e6)) : null;
  } catch {
    return null; // SOL shows "No price" and drops out of the total; nothing else breaks
  }
}

export function useBalances() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const portfolio = usePortfolio();

  const extras = useQuery({
    queryKey: ["wallet-extras", publicKey?.toBase58() ?? "anon"],
    enabled: !!publicKey,
    refetchInterval: 15_000, // parameters.md: cache 15 s client-side
    queryFn: async () => {
      const owner = publicKey!;
      const [lamports, classic, t22, solPrice] = await Promise.all([
        connection.getBalance(owner).catch(() => 0),
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }).catch(() => null),
        connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }).catch(() => null),
        solPriceUsd6(),
      ]);

      const tokens = [...(classic?.value ?? []), ...(t22?.value ?? [])].map((acc) => {
        const info = (acc.account.data as { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number } } } }).parsed.info;
        return { mint: info.mint, amount: BigInt(info.tokenAmount.amount), decimals: info.tokenAmount.decimals };
      });
      return { lamports: BigInt(lamports), solPrice, tokens };
    },
  });

  const data: Balances | undefined = (() => {
    if (!portfolio.data || !extras.data) return undefined;
    const marketMints = new Set(portfolio.data.map((a) => a.mint.toBase58()));

    // The card spends from the wallet's USDC; count it once, as the card balance.
    const cardUsdc6 = extras.data.tokens.filter((t) => t.mint === USDC_MINT).reduce((sum, t) => sum + t.amount, 0n);

    return buildBalances({
      markets: portfolio.data.map((a) => ({
        mint: a.mint.toBase58(),
        symbol: a.info.symbol,
        decimals: a.info.decimals,
        multiplierMicro: a.info.multiplierMicro,
        priceUsd6: a.priceUsd6,
        source: a.source,
        walletAmount: a.walletBalance,
        lockedAmount: a.deposited,
        lockedValueAfterHaircutUsd6: a.valueUsd6,
        debtUsd6: a.debt,
      })),
      cardUsdc6,
      sol: { lamports: extras.data.lamports, priceUsd6: extras.data.solPrice },
      otherTokens: extras.data.tokens.filter((t) => t.mint !== USDC_MINT && !marketMints.has(t.mint)),
    });
  })();

  return {
    data,
    isLoading: portfolio.isLoading || extras.isLoading,
    error: portfolio.error ?? extras.error ?? null,
    refetch: () => Promise.all([portfolio.refetch(), extras.refetch()]),
  };
}
