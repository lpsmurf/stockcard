"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";
import { APP_URL, CLUSTER, RPC_URL } from "@/lib/config";

let mwaRegistered = false;

/** Registers Mobile Wallet Adapter so Android Chrome and the webshell APK can talk to native wallets. */
function useRegisterMwa() {
  useEffect(() => {
    if (mwaRegistered || typeof window === "undefined") return;
    mwaRegistered = true;
    registerMwa({
      appIdentity: { name: "StockCard", uri: APP_URL, icon: "favicon.ico" },
      authorizationCache: createDefaultAuthorizationCache(),
      chains: [CLUSTER === "localnet" ? "solana:localnet" : "solana:devnet"],
      chainSelector: createDefaultChainSelector(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useRegisterMwa();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }));
  // Wallet Standard wallets (Phantom, Solflare, Backpack, MWA) register themselves; no adapters needed.
  const wallets = useMemo(() => [], []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={RPC_URL}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
