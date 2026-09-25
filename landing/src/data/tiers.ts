// Source of truth: specs/002-landing-site/brief.md §5.
// Do not invent perks or numbers. Perks flagged `planned: true` must render
// under "Planned benefits" with the footnote PLANNED_PERKS_FOOTNOTE.

export type TierId = "standard" | "plus" | "black";

export type TierPerk = {
  label: string;
  planned?: true;
};

export type Tier = {
  id: TierId;
  name: string;
  price: { monthly: string; yearly?: string; free?: boolean };
  cashbackRate: number; // top cashback rate, decimal (0.005 = 0.5%)
  cashbackCap: { shareOfCreditInUse: number; monthlyCapEur: number; fallbackRate: number };
  aprFrom: number; // lowest available APR, decimal (0.099 = 9.9%)
  savingsBoostPts: number; // extra percentage points over base savings APY
  card: string;
  perks: TierPerk[];
};

export const TIERS: Tier[] = [
  {
    id: "standard",
    name: "Standard",
    price: { monthly: "Free", free: true },
    cashbackRate: 0.005,
    cashbackCap: { shareOfCreditInUse: 0.25, monthlyCapEur: 1000, fallbackRate: 0.0025 },
    aprFrom: 0.099,
    savingsBoostPts: 0,
    card: "Virtual",
    perks: [
      { label: "Cashback 0.5%, paid in the real asset you pick" },
      { label: "Top rate applies to spend up to 25% of your credit in use, max €1,000/month (then 0.25%)" },
      { label: "Credit APR from 9.9%" },
      { label: "Savings APY ~6% variable" },
      { label: "Virtual card" },
      { label: "Lock stocks, cards, watches, art notes" },
      { label: "Alerts before liquidation: in-app + push" },
      { label: "FX markup: card network rate" },
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: { monthly: "€9.99/month", yearly: "€99/year" },
    cashbackRate: 0.015,
    cashbackCap: { shareOfCreditInUse: 0.25, monthlyCapEur: 2000, fallbackRate: 0.005 },
    aprFrom: 0.089, // −1 pt vs Standard
    savingsBoostPts: 0.5,
    card: "Virtual + physical",
    perks: [
      { label: "Cashback 1.5%, paid in the real asset you pick" },
      { label: "Top rate applies to spend up to 25% of credit in use, max €2,000 (then 0.5%)" },
      { label: "Credit APR from 8.9% (−1 pt)" },
      { label: "Savings APY +0.5 pt" },
      { label: "Virtual + physical card" },
      { label: "Lock stocks, cards, watches, art notes" },
      { label: "Alerts before liquidation: in-app + push" },
      { label: "Art drops: early access" },
      { label: "Global eSIM data: 1 pack/year", planned: true },
      { label: "FX markup: card network rate" },
    ],
  },
  {
    id: "black",
    name: "Black",
    price: { monthly: "€39.99/month", yearly: "€399/year" },
    cashbackRate: 0.025,
    cashbackCap: { shareOfCreditInUse: 0.25, monthlyCapEur: 4000, fallbackRate: 0.0075 },
    aprFrom: 0.099,
    savingsBoostPts: 1,
    card: "Metal",
    perks: [
      { label: "Cashback 2.5%, paid in the real asset you pick" },
      { label: "Top rate applies to spend up to 25% of credit in use, max €4,000 (then 0.75%)" },
      { label: "Credit APR from 9.9%" },
      { label: "Savings APY +1 pt" },
      { label: "Metal card" },
      { label: "Lock stocks, cards, watches, art notes" },
      { label: "Alerts before liquidation: in-app + push, + SMS", planned: true },
      { label: "Art drops: priority allocation", planned: true },
      { label: "Airport lounges: card-network lounge program", planned: true },
      { label: "Travel & purchase insurance included", planned: true },
      { label: "Grading & vault credits included", planned: true },
      { label: "FX markup: 0%", planned: true },
      { label: "Fast Track security: 4 per year", planned: true },
      { label: "Trip / event cancellation: up to 70%, max €5,000/year", planned: true },
      { label: "Global eSIM data: monthly allowance", planned: true },
      { label: "Subscriptions: pick 2 of Financial Times, Perplexity Pro, NordVPN, Headspace, MasterClass", planned: true },
    ],
  },
];

export const PLANNED_PERKS_FOOTNOTE =
  "Benefits depend on partner and issuer agreements and may change.";

export const TIER_SAFETY_NOTE =
  "Max LTV and liquidation terms never depend on tier.";

// Rates (brief §5, "lower LTV, lower rate")
export const STOCK_APR_BANDS = [
  { maxLtv: 0.2, apr: 0.099 },
  { maxLtv: 0.35, apr: 0.129 },
  { maxLtv: 0.5, apr: 0.149 },
] as const;

export const COLLECTIBLE_APR_BANDS = [
  { maxLtv: 0.2, apr: 0.119 },
  { maxLtv: 0.4, apr: 0.159 }, // cards/watches max LTV 40%
  { maxLtv: 1, apr: 0.159 }, // catch-all; art caps at 30%
] as const;

export const APR_FLOOR_WITH_DISCOUNTS = 0.089;

export const SAVINGS_APY_BASE = 0.06; // ~6% variable, funded by 60% of borrower interest
export const SAVINGS_YIELD_SOURCE_SHARE = 0.6;
export const SAVINGS_LEGAL_NOTE =
  "Savings is in development and not available in the EU until regulatory approval.";

// Founding member offer (brief §5)
export const FOUNDING_OFFER = {
  aprDiscountPts: 2, // −2 pt for 12 months
  balanceCapEur: 5000, // on the first €5,000 of balance
  memberCap: 1000, // first 1,000 waitlist members
  activationWindowDays: 90,
  referralReward: "3 months of Plus for every referral",
  saverBoostPts: 1, // +1 pt APY on first $10,000
  saverCapUsd: 10000,
  saverMonths: 6,
  metalCardNumbered: 250, // first 250 Black members
} as const;

// How we compare (brief §5) — keep "not checked" cells honest
export type CompareRow = { label: string; values: string[] };
export const COMPARE_COLUMNS = [
  "StockCard (proposed)",
  "KAST",
  "Nexo",
  "Revolut Ultra",
  "Crypto.com Visa",
  "ether.fi Cash",
] as const;

export const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Membership price",
    values: [
      "Free / €9.99 / €39.99 per month",
      "Free / $1,000 per yr / $10,000 per yr",
      "Free (tier = share of NEXO held)",
      "€65/month (NL, Sept 2026)",
      "Subscription $4.99–29.99/month or CRO lock-up",
      "Free Core; paid tiers",
    ],
  },
  {
    label: "Top cashback",
    values: [
      "2.5% in the real asset you pick (on spend up to 25% of credit in use)",
      "3% (Private tier)",
      "Up to 2% in NEXO (0.5% in BTC)",
      "Not the headline benefit",
      "2–5% in CRO with lock-ups (8% Prime)",
      "3% up to $2,000/month, paid in wETH",
    ],
  },
  {
    label: "Borrow against",
    values: ["Stocks, graded cards, watches, art", "—", "Crypto", "—", "—", "Crypto (Borrow Mode)"],
  },
  {
    label: "Borrow rate",
    values: [
      "9.9–14.9% (from 8.9% with discounts)",
      "—",
      "2.9%–18.9% by tier and LTV",
      "—",
      "—",
      "Lending-market rate (not checked)",
    ],
  },
  {
    label: "Earn on stablecoins",
    values: ["~6% variable, funds loans", "Earn product (rate not checked)", "Up to 13% (by tier)", "—", "Not compared", "Not compared"],
  },
  {
    label: "Custody of collateral",
    values: ["On-chain program", "Not checked", "Custodial", "Bank", "Custodial", "Self-custodial (per its site)"],
  },
];

export const COMPARE_FOOTNOTE =
  "Competitor details from their public sites and reviews, September 2026. Check the provider for current terms.";
