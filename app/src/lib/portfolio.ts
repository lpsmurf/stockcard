/**
 * Portfolio aggregation hook: for every market in config.ts, fetch the market account,
 * signed price, the connected wallet's position and token balance, and derive USD values.
 */
"use client";

import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { MARKETS, marketMint, PROGRAM_ID, type MarketInfo } from "./config";
import { collateralValue, ltvBps } from "./risk";
import { collateralVaultPda, marketPda, positionPda, pricePda, useReadProgram } from "./program";

export interface PortfolioAsset {
  info: MarketInfo;
  mint: PublicKey;
  marketKey: PublicKey;
  priceUsd6: bigint;
  pricePublishTime: number;
  source: string;
  walletBalance: bigint;
  deposited: bigint;
  debt: bigint;
  aprBps: number;
  valueUsd6: bigint; // deposited collateral value after haircut
  ltv: bigint;
  tokenProgram: PublicKey;
}

export function usePortfolio() {
  const program = useReadProgram();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["portfolio", publicKey?.toBase58() ?? "anon"],
    enabled: !!PROGRAM_ID,
    refetchInterval: 15_000,
    queryFn: async (): Promise<PortfolioAsset[]> => {
      const assets: PortfolioAsset[] = [];
      for (const info of MARKETS) {
        const mintStr = marketMint(info);
        if (!mintStr) continue;
        const mint = new PublicKey(mintStr);
        const marketKey = marketPda(mint);
        const priceKey = pricePda(marketKey);
        const tokenProgram = info.token2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

        const [marketAcct, priceAcct] = await Promise.all([
          program.account.market.fetchNullable(marketKey),
          program.account.signedPrice.fetchNullable(priceKey),
        ]);
        if (!marketAcct) continue;

        let walletBalance = 0n;
        let deposited = 0n;
        let debt = 0n;
        let aprBps = 0;
        if (publicKey) {
          const ata = getAssociatedTokenAddressSync(mint, publicKey, false, tokenProgram);
          const [bal, pos] = await Promise.all([
            connection.getTokenAccountBalance(ata).catch(() => null),
            program.account.position.fetchNullable(positionPda(marketKey, publicKey)),
          ]);
          walletBalance = BigInt(bal?.value.amount ?? "0");
          if (pos) {
            deposited = BigInt(pos.collateralAmount.toString());
            debt = BigInt(pos.debtPrincipal.toString());
            aprBps = pos.aprBps;
          }
        }

        const priceUsd6 = priceAcct ? BigInt(priceAcct.price.toString()) : 0n; // expo is always -6 in the MVP
        const haircut = BigInt(marketAcct.haircutBps);
        const valueUsd6 = collateralValue(deposited, info.decimals, priceUsd6, haircut, info.multiplierMicro);
        assets.push({
          info,
          mint,
          marketKey,
          priceUsd6,
          pricePublishTime: priceAcct ? Number(priceAcct.publishTime) : 0,
          source: priceAcct ? Object.keys(priceAcct.source)[0] : "market",
          walletBalance,
          deposited,
          debt,
          aprBps,
          valueUsd6,
          ltv: ltvBps(debt, valueUsd6),
          tokenProgram,
        });
      }
      return assets;
    },
  });
}

export interface PortfolioTotals {
  collateralUsd6: bigint;
  debtUsd6: bigint;
  creditLineUsd6: bigint;
  availableUsd6: bigint;
  worstLtv: bigint;
}

export function totals(assets: PortfolioAsset[]): PortfolioTotals {
  let collateral = 0n;
  let debt = 0n;
  let line = 0n;
  let worst = 0n;
  for (const a of assets) {
    collateral += a.valueUsd6;
    debt += a.debt;
    line += (a.valueUsd6 * BigInt(a.info.maxLtvBps)) / 10_000n;
    if (a.ltv > worst && a.debt > 0n) worst = a.ltv;
  }
  return {
    collateralUsd6: collateral,
    debtUsd6: debt,
    creditLineUsd6: line,
    availableUsd6: line > debt ? line - debt : 0n,
    worstLtv: worst,
  };
}

export { collateralVaultPda };
