import { clusterApiUrl } from "@solana/web3.js";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as "devnet" | "localnet";
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet");
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "";
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stockcard.vercel.app";

/** True until the program is deployed and seeded; screens show labeled preview data. */
export const PREVIEW_MODE = !PROGRAM_ID;

export type AssetClass = "Equity" | "ArtNote" | "Collectible";
export type PriceSource = "Market" | "Switchboard" | "Appraisal" | "PartnerFmv" | "Demo";

export interface MarketInfo {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  priceSource: PriceSource;
  maxLtvBps: number;
  liqThresholdBps: number;
  haircutBps: number;
}

// Risk parameters mirror plan.md "Key risk parameters". Mints come from the seed script.
export const MARKETS: MarketInfo[] = [
  { symbol: "NVDAx", name: "NVIDIA (xStock)", assetClass: "Equity", priceSource: "Market", maxLtvBps: 5000, liqThresholdBps: 6500, haircutBps: 0 },
  { symbol: "SPYx", name: "S&P 500 ETF (xStock)", assetClass: "Equity", priceSource: "Market", maxLtvBps: 5000, liqThresholdBps: 6500, haircutBps: 0 },
  { symbol: "SPCX", name: "SpaceX (Backpack)", assetClass: "Equity", priceSource: "Market", maxLtvBps: 5000, liqThresholdBps: 6500, haircutBps: 1000 },
  { symbol: "TIDE", name: "Tidewater · Lot 01 note", assetClass: "ArtNote", priceSource: "Appraisal", maxLtvBps: 3000, liqThresholdBps: 4500, haircutBps: 2000 },
  { symbol: "PSA10", name: "PSA 10 graded Pokémon card", assetClass: "Collectible", priceSource: "PartnerFmv", maxLtvBps: 4000, liqThresholdBps: 5500, haircutBps: 2500 },
];
