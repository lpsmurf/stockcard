/**
 * Savings (US7): pool stats + deposit/withdraw via the stockcard program.
 */
"use client";

import * as anchor from "@anchor-lang/core";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import type { Program } from "@anchor-lang/core";
import type { Stockcard } from "./idl/stockcard";
import { configPda, usdcVaultPda } from "./program";
import { USDC_MINT } from "./config";

const bn = (v: bigint) => new anchor.BN(v.toString());
const usdcMintKey = () => new anchor.web3.PublicKey(USDC_MINT);

export async function depositSavings(program: Program<Stockcard>, owner: PublicKey, amountUsd6: bigint) {
  return program.methods
    .depositSavings(bn(amountUsd6))
    .accounts({
      saver: owner,
      config: configPda(),
      usdcVault: usdcVaultPda(),
      saverUsdc: getAssociatedTokenAddressSync(usdcMintKey(), owner),
      usdcMint: usdcMintKey(),
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function withdrawSavings(program: Program<Stockcard>, owner: PublicKey, shares: bigint) {
  return program.methods
    .withdrawSavings(bn(shares))
    .accounts({
      saver: owner,
      config: configPda(),
      usdcVault: usdcVaultPda(),
      saverUsdc: getAssociatedTokenAddressSync(usdcMintKey(), owner),
      usdcMint: usdcMintKey(),
      usdcTokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}
