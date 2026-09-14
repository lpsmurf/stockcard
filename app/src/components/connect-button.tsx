"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function ConnectButton({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const base =
    size === "lg"
      ? "h-12 px-6 text-base w-full sm:w-auto"
      : "h-9 px-3.5 text-sm";

  if (publicKey) {
    const short = `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`;
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className={`${base} rounded-full border border-rule bg-raised font-mono text-ink-2 hover:border-brass`}
        title="Disconnect wallet"
      >
        {short}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      disabled={connecting}
      className={`${base} rounded-full bg-brass font-semibold text-on-brass hover:opacity-90 disabled:opacity-60`}
    >
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
