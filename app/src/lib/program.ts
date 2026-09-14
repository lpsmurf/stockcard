/**
 * Anchor client + PDA helpers + react-query hooks for the stockcard program.
 * Program ID from NEXT_PUBLIC_PROGRAM_ID; IDL synced by scripts/sync-idl.sh.
 */
import * as anchor from "@anchor-lang/core";
import { Program, AnchorProvider } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import idlJson from "./idl/stockcard.json";
import type { Stockcard } from "./idl/stockcard";
import { PROGRAM_ID, RPC_URL } from "./config";

export const PROGRAM_PUBKEY = new PublicKey(PROGRAM_ID || "HsXyxfSvp7mha6bxgh3Qr9NoVmMVe6HmynVguRfBLWrY");

const idl = idlJson as unknown as Stockcard;

export const pda = (...seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, PROGRAM_PUBKEY)[0];

export const configPda = () => pda(Buffer.from("config"));
export const usdcVaultPda = () => pda(Buffer.from("usdc_vault"));
export const marketPda = (mint: PublicKey) => pda(Buffer.from("market"), mint.toBuffer());
export const collateralVaultPda = (market: PublicKey) => pda(Buffer.from("collateral_vault"), market.toBuffer());
export const pricePda = (market: PublicKey) => pda(Buffer.from("price"), market.toBuffer());
export const positionPda = (market: PublicKey, owner: PublicKey) =>
  pda(Buffer.from("position"), market.toBuffer(), owner.toBuffer());
export const savingsPda = (owner: PublicKey) => pda(Buffer.from("savings"), owner.toBuffer());

export function getProgram(connection: Connection, wallet?: anchor.Wallet): Program<Stockcard> {
  const provider = new AnchorProvider(
    connection,
    wallet ?? ({ publicKey: PublicKey.default } as unknown as anchor.Wallet),
    { commitment: "confirmed" },
  );
  return new Program<Stockcard>(idl, provider);
}

/** Read-only program for queries (no wallet needed). */
export function useReadProgram() {
  const { connection } = useConnection();
  return useMemo(() => getProgram(connection), [connection]);
}

/** Signing program bound to the connected wallet. */
export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  return useMemo(() => {
    const w = {
      publicKey: wallet.publicKey ?? PublicKey.default,
      signTransaction: wallet.signTransaction!,
      signAllTransactions: wallet.signAllTransactions!,
    } as anchor.Wallet;
    return getProgram(connection, w);
  }, [connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);
}

export function useConfig() {
  const program = useReadProgram();
  return useQuery({
    queryKey: ["config", PROGRAM_ID],
    queryFn: () => program.account.config.fetch(configPda()),
    enabled: !!PROGRAM_ID,
    refetchInterval: 15_000,
  });
}

export function useMarket(mint?: PublicKey) {
  const program = useReadProgram();
  return useQuery({
    queryKey: ["market", mint?.toBase58()],
    queryFn: () => program.account.market.fetch(marketPda(mint!)),
    enabled: !!mint && !!PROGRAM_ID,
    refetchInterval: 15_000,
  });
}

export function useSignedPrice(market?: PublicKey) {
  const program = useReadProgram();
  return useQuery({
    queryKey: ["price", market?.toBase58()],
    queryFn: () => program.account.signedPrice.fetch(pricePda(market!)),
    enabled: !!market && !!PROGRAM_ID,
    refetchInterval: 15_000,
  });
}

export function usePosition(market?: PublicKey, owner?: PublicKey | null) {
  const program = useReadProgram();
  return useQuery({
    queryKey: ["position", market?.toBase58(), owner?.toBase58()],
    queryFn: async () => {
      try {
        return await program.account.position.fetch(positionPda(market!, owner!));
      } catch {
        return null; // no position yet
      }
    },
    enabled: !!market && !!owner && !!PROGRAM_ID,
    refetchInterval: 10_000,
  });
}

export function useAllPositions(owner?: PublicKey | null) {
  const program = useReadProgram();
  return useQuery({
    queryKey: ["positions", owner?.toBase58()],
    queryFn: () =>
      program.account.position.all([
        { memcmp: { offset: 8, bytes: owner!.toBase58() } },
      ]),
    enabled: !!owner && !!PROGRAM_ID,
    refetchInterval: 10_000,
  });
}

export function useSavingsPosition(owner?: PublicKey | null) {
  const program = useReadProgram();
  return useQuery({
    queryKey: ["savings", owner?.toBase58()],
    queryFn: async () => {
      try {
        return await program.account.savingsPosition.fetch(savingsPda(owner!));
      } catch {
        return null;
      }
    },
    enabled: !!owner && !!PROGRAM_ID,
    refetchInterval: 15_000,
  });
}

export const connection = new Connection(RPC_URL, "confirmed");
