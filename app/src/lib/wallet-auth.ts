"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback } from "react";

/**
 * Signed headers for wallet-mutating API routes (contracts/api.md):
 * x-wallet, x-timestamp, x-signature = ed25519 over `stockcard:{route}:{timestamp}`.
 */
export function useWalletAuth() {
  const { publicKey, signMessage } = useWallet();
  return useCallback(
    async (route: string): Promise<Record<string, string>> => {
      if (!publicKey || !signMessage) throw new Error("Connect wallet");
      const timestamp = Date.now().toString();
      const sig = await signMessage(new TextEncoder().encode(`stockcard:${route}:${timestamp}`));
      return {
        "content-type": "application/json",
        "x-wallet": publicKey.toBase58(),
        "x-timestamp": timestamp,
        "x-signature": Buffer.from(sig).toString("base64"),
      };
    },
    [publicKey, signMessage],
  );
}
