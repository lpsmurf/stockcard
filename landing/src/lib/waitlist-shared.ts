// Shared constants — safe to import from client components (no server deps).
export const REFERRAL_SPOTS_PER_FRIEND = 10;
export const REFERRAL_REWARD = "Plus cashback 3 months";
export const RATE_LIMIT_PER_HOUR = 5;

export const ASSET_TO_LOCK_OPTIONS = ["Stocks", "Graded cards", "Watches", "Art", "Not sure"] as const;
export const CASHBACK_ASSET_OPTIONS = ["NVDAx", "SPYx", "Art note", "Not sure"] as const;
