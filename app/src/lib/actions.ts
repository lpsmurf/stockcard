/**
 * Client-side transaction actions. The program enforces all safety; these only sign and send.
 * PDA accounts marked in the IDL (position on deposit, signed_price, savings_position)
 * are auto-resolved by the Anchor client and omitted here.
 */
"use client";

import * as anchor from "@anchor-lang/core";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import type { Program } from "@anchor-lang/core";
import type { Stockcard } from "./idl/stockcard";
import type { PortfolioAsset } from "./portfolio";
import { collateralVaultPda, configPda, positionPda, usdcVaultPda } from "./program";
import { USDC_MINT } from "./config";

const bn = (v: bigint) => new anchor.BN(v.toString());
const usdcMintKey = () => new anchor.web3.PublicKey(USDC_MINT);

export async function depositCollateral(program: Program<Stockcard>, owner: PublicKey, asset: PortfolioAsset, amount: bigint) {
  return program.methods
    .depositCollateral(bn(amount))
    .accounts({
      owner,
      config: configPda(),
      market: asset.marketKey,
      collateralMint: asset.mint,
      ownerToken: getAssociatedTokenAddressSync(asset.mint, owner, false, asset.tokenProgram),
      collateralVault: collateralVaultPda(asset.marketKey),
      tokenProgram: asset.tokenProgram,
    })
    .rpc();
}

export async function withdrawCollateral(program: Program<Stockcard>, owner: PublicKey, asset: PortfolioAsset, amount: bigint) {
  return program.methods
    .withdrawCollateral(bn(amount))
    .accounts({
      owner,
      config: configPda(),
      market: asset.marketKey,
      position: positionPda(asset.marketKey, owner),
      collateralMint: asset.mint,
      ownerToken: getAssociatedTokenAddressSync(asset.mint, owner, false, asset.tokenProgram),
      collateralVault: collateralVaultPda(asset.marketKey),
      tokenProgram: asset.tokenProgram,
    })
    .rpc();
}

export async function borrow(program: Program<Stockcard>, owner: PublicKey, asset: PortfolioAsset, amountUsd6: bigint) {
  return program.methods
    .borrow(bn(amountUsd6))
    .accounts({
      owner,
      config: configPda(),
      market: asset.marketKey,
      position: positionPda(asset.marketKey, owner),
      collateralMint: asset.mint,
      usdcVault: usdcVaultPda(),
      usdcMint: usdcMintKey(),
      destinationUsdc: getAssociatedTokenAddressSync(usdcMintKey(), owner),
      collateralVault: collateralVaultPda(asset.marketKey),
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function repay(program: Program<Stockcard>, owner: PublicKey, asset: PortfolioAsset, amountUsd6: bigint) {
  return program.methods
    .repay(bn(amountUsd6))
    .accounts({
      payer: owner,
      config: configPda(),
      market: asset.marketKey,
      position: positionPda(asset.marketKey, owner),
      collateralMint: asset.mint,
      payerUsdc: getAssociatedTokenAddressSync(usdcMintKey(), owner),
      usdcVault: usdcVaultPda(),
      usdcMint: usdcMintKey(),
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export const REPAY_ALL = 2n ** 64n - 1n;
