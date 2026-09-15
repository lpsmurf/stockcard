import { clusterApiUrl } from "@solana/web3.js";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as "devnet" | "localnet";
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet");
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "";
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT ?? "";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stockcard.vercel.app";

/** True until the program is deployed and seeded; screens show labeled preview data. */
export const PREVIEW_MODE = !PROGRAM_ID;

export type AssetClass = "Equity" | "ArtNote" | "Collectible";
export type PriceSource = "Market" | "Switchboard" | "Appraisal" | "PartnerFmv" | "Demo";
export type ShopKind = "stock" | "art" | "card" | "watch";

export interface MarketInfo {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  priceSource: PriceSource;
  maxLtvBps: number;
  liqThresholdBps: number;
  liqBonusBps: number;
  haircutBps: number;
  decimals: number;
  /** Token-2022 Scaled UI Amount multiplier, scaled by 1e6 (1e6 = 1.0). */
  multiplierMicro: bigint;
  mintEnvKey: string;
  aprBands: { maxLtvBps: number; aprBps: number }[];
  shopKind: ShopKind;
  /** Token-2022 mint (equities) vs legacy SPL (TIDE, items). */
  token2022: boolean;
  /** Mirrored-item metadata (US8), filled by seed for CC-* markets. */
  grade?: string;
  insuredValueUsd6?: bigint;
}

const EQUITY_BANDS = [
  { maxLtvBps: 2000, aprBps: 990 },
  { maxLtvBps: 3500, aprBps: 1290 },
  { maxLtvBps: 5000, aprBps: 1490 },
];
const COLLECTIBLE_BANDS = [
  { maxLtvBps: 2000, aprBps: 1190 },
  { maxLtvBps: 4000, aprBps: 1590 },
];
const ART_BANDS = [
  { maxLtvBps: 1500, aprBps: 1190 },
  { maxLtvBps: 3000, aprBps: 1590 },
];

// Risk parameters mirror parameters.md §2 + §3c. Mints come from the seed script.
export const MARKETS: MarketInfo[] = [
  { symbol: "NVDAx", name: "NVIDIA (xStock)", assetClass: "Equity", priceSource: "Market", maxLtvBps: 5000, liqThresholdBps: 6500, liqBonusBps: 500, haircutBps: 0, decimals: 8, multiplierMicro: 1_001_701n, mintEnvKey: "NEXT_PUBLIC_MINT_NVDAX", aprBands: EQUITY_BANDS, shopKind: "stock", token2022: true },
  { symbol: "SPYx", name: "S&P 500 ETF (xStock)", assetClass: "Equity", priceSource: "Market", maxLtvBps: 5000, liqThresholdBps: 6500, liqBonusBps: 500, haircutBps: 0, decimals: 8, multiplierMicro: 1_005_715n, mintEnvKey: "NEXT_PUBLIC_MINT_SPYX", aprBands: EQUITY_BANDS, shopKind: "stock", token2022: true },
  { symbol: "TSLAx", name: "Tesla (xStock)", assetClass: "Equity", priceSource: "Market", maxLtvBps: 5000, liqThresholdBps: 6500, liqBonusBps: 500, haircutBps: 0, decimals: 8, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_TSLAX", aprBands: EQUITY_BANDS, shopKind: "stock", token2022: true },
  { symbol: "SPCX", name: "SpaceX (Backpack)", assetClass: "Equity", priceSource: "Market", maxLtvBps: 5000, liqThresholdBps: 6500, liqBonusBps: 500, haircutBps: 1000, decimals: 6, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_SPCX", aprBands: EQUITY_BANDS, shopKind: "stock", token2022: true },
  { symbol: "TIDE", name: "Tidewater · Lot 01 note", assetClass: "ArtNote", priceSource: "Appraisal", maxLtvBps: 3000, liqThresholdBps: 4500, liqBonusBps: 1000, haircutBps: 2000, decimals: 6, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_TIDE", aprBands: ART_BANDS, shopKind: "art", token2022: false },
  { symbol: "CC-LUGIA", name: "2002 #090 Lugia-Holo 1st Edition", assetClass: "Collectible", priceSource: "PartnerFmv", maxLtvBps: 4000, liqThresholdBps: 5500, liqBonusBps: 800, haircutBps: 2500, decimals: 0, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_CC_LUGIA", aprBands: COLLECTIBLE_BANDS, token2022: false, shopKind: "card", grade: "PSA 10", insuredValueUsd6: 54_000_000_000n },
  { symbol: "CC-RAYQUAZA", name: "2006 #3 Rayquaza-Holo Pop Series 1", assetClass: "Collectible", priceSource: "PartnerFmv", maxLtvBps: 4000, liqThresholdBps: 5500, liqBonusBps: 800, haircutBps: 2500, decimals: 0, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_CC_RAYQUAZA", aprBands: COLLECTIBLE_BANDS, token2022: false, shopKind: "card", grade: "PSA 10", insuredValueUsd6: 13_000_000_000n },
  { symbol: "CC-MEW", name: "2006 #101 Mew Gold Star HOLO R", assetClass: "Collectible", priceSource: "PartnerFmv", maxLtvBps: 4000, liqThresholdBps: 5500, liqBonusBps: 800, haircutBps: 2500, decimals: 0, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_CC_MEW", aprBands: COLLECTIBLE_BANDS, token2022: false, shopKind: "card", grade: "BGS 8", insuredValueUsd6: 5_500_000_000n },
  { symbol: "CC-DAYTONA", name: "Rolex \"Pikachu\" Daytona", assetClass: "Collectible", priceSource: "PartnerFmv", maxLtvBps: 4000, liqThresholdBps: 5500, liqBonusBps: 800, haircutBps: 2500, decimals: 0, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_CC_DAYTONA", aprBands: COLLECTIBLE_BANDS, token2022: false, shopKind: "watch", grade: "Watch", insuredValueUsd6: 74_200_000_000n },
  { symbol: "CC-ROYALOAK", name: "Audemars Piguet Royal Oak · Silver Dial", assetClass: "Collectible", priceSource: "PartnerFmv", maxLtvBps: 4000, liqThresholdBps: 5500, liqBonusBps: 800, haircutBps: 2500, decimals: 0, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_CC_ROYALOAK", aprBands: COLLECTIBLE_BANDS, token2022: false, shopKind: "watch", grade: "Watch", insuredValueUsd6: 51_315_000_000n },
  { symbol: "CC-SEAMASTER", name: "Omega Seamaster Diver 300M 007 Edition", assetClass: "Collectible", priceSource: "PartnerFmv", maxLtvBps: 4000, liqThresholdBps: 5500, liqBonusBps: 800, haircutBps: 2500, decimals: 0, multiplierMicro: 1_000_000n, mintEnvKey: "NEXT_PUBLIC_MINT_CC_SEAMASTER", aprBands: COLLECTIBLE_BANDS, token2022: false, shopKind: "watch", grade: "Watch", insuredValueUsd6: 10_600_000_000n },
];

export function marketMint(info: MarketInfo): string {
  return process.env[info.mintEnvKey] ?? "";
}

export const CASHBACK_ASSETS = ["NVDAx", "SPYx", "TIDE"];

/** Suggested max LTV for the borrow sheet hint (parameters.md §4). */
export const SUGGESTED_MAX_LTV_BPS = 3500n;
