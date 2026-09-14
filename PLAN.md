# Stocklana Hackathon Plan — "Stock-backed credit card" (working name: **StockCard**)

## Context
- **Hackathon:** Stocklana (Solana Foundation, $100k pool). **Submissions close Fri Sept 18, 2026, 4pm ET** → ~4 days. 371 registered / 34 submissions so far. Track fit: *Credit & yield — "borrowing against stocks"* + *Consumer apps*.
- **Judging question:** "could this be a real app that people will actually use?" → needs a working end-to-end prototype, clear user need, Solana relevance, execution.
- **Idea:** Nexo-style credit line. Users lock tokenized US stocks, borrow USDC at an APR up to a max LTV, spend it with a Visa/MC card, repay anytime.
- **Team:** solo (Luis + Claude), Next.js + Anchor, devnet, Vercel.

## Research findings (what changes the idea)
1. **Backpack Securities stocks are not on-chain.** They're broker-held security entitlements and don't become SPL tokens. We can't lock them in our program. Only **SPCX** (Backpack's SpaceX token) is a real SPL token, backed 1:1 and redeemable.
2. **Backpack already lets you borrow USD against stocks** (launched Sept 1, 2026, MU and SNDK only, inside their CEX margin system). No card, no on-chain composability. Their API (ED25519-signed REST) is read-usable for importing a portfolio.
3. **xStocks (Backed/Kraken) are about 86% of tokenized-equity issuance on Solana.** They're SPL tokens, 60+ tickers, self-custodial.
4. **Borrowing against xStocks already exists:** Kamino (82.6% of tokenized-stock lending) and Jupiter Lend. Segment TVL is only about $23M, so it's early. **Neither has a card or a consumer credit-line UX.** They're DeFi money-market UIs (loops, health factors).
5. **Closest product analog:** *ether.fi Cash* "Borrow Mode" (Aave V4 instance, ~70k cardholders, ~$22M borrowed). It's on Optimism and crypto-only collateral. **Nobody offers a stock-collateral card on Solana.** That's our wedge.
6. **Card infra landscape (Sept 2026):**
   | Provider | Solana | Dev access | Notes |
   |---|---|---|---|
   | **Bridge (Stripe) + Stripe Issuing** | ✅ non-custodial USDC on Solana | **Public sandbox, Solana devnet** (devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) | **Best hackathon pick.** `crypto_wallet{chain:solana,currency:usdc}`. Real devnet tx on spend. |
   | Rain | ✅ (Avici, Tria, Solayer, Plasma One) | Sales-led, enterprise | Supports collateral-credit cards. **Solana contract exploited Aug 28, 2026 (~$1–2M).** Good pitch partner, risky dependency. |
   | Baanx (now Exodus) | ✅ | Sales-led | Offers lending/borrow-against-assets cards (was behind Solflare/MetaMask-style programs). |
   | Immersve / Reap / Gnosis Pay | partial / ❌ | Sales-led / EVM-only | Secondary options. |
   | Kulipa | — | **Wound down July 2026** | Avoid. |
   → **Demo on Bridge sandbox. Pitch Rain/Baanx as production issuer options.**
7. **Colosseum Copilot:** skipped by decision (no token available, deadline too tight). Competitive picture above is from open-web research and is sufficient for positioning.

**Positioning:** *"Kamino gives DeFi users a money market. Backpack gives CEX users margin. We give stock holders a credit card."* On-chain, self-custodial, works with any SPL stock (xStocks + SPCX). Backpack users can see which of their holdings are eligible and withdraw them to their wallet.

## Product scope (MVP, must be demoable)
User flow (the 2-min video follows this exactly):
1. Connect wallet → **Portfolio**: SPL stock balances (xStocks/SPCX) + optional **"Import from Backpack"** (read-only API key → list holdings, flag which are on-chain-eligible, show a "withdraw SPCX to wallet" CTA).
2. **Deposit** e.g. NVDAx → see collateral value (Pyth), max LTV (for example 50%), available credit.
3. **Draw credit** → USDC minted/transferred from the protocol pool to the user's card wallet. Debt accrues at APR (for example 8%).
4. **Card** → issue virtual card via Bridge sandbox tied to that Solana wallet → simulate purchase → real devnet USDC debit shows up.
5. **Repay anytime** (partial/full) → withdraw collateral.
6. **Health bar + liquidation** (admin "crash price" button in demo to show liquidation protection/alerts).

### Added Sept 14: art collateral
Fractionalized art (the Genesis Collection, 6 sample lots, $368k total) is a second collateral type, inspired by Jurassic Finance. Art uses 30% max LTV and a signed quarterly appraisal (20% haircut) instead of Pyth. See [BUSINESS_MODEL.md](BUSINESS_MODEL.md) for lots, mechanics, revenue and the raise. For the hackathon demo, art fractions are mock mints like the stock tokens; the appraisal price is posted by the admin.

### Added Sept 14: Luxembourg art vehicle
The art fund is centralized in Europe: one Luxembourg securitisation vehicle with a ring-fenced compartment per artwork, issuing $10 asset-backed notes as Token-2022 tokens; works stored at the Luxembourg High Security Hub. Unregulated as long as there are at most 3 public issues a year. Details and open counsel questions in BUSINESS_MODEL.md.

### Added Sept 14: partner collectibles
Vaulted 1:1 item NFTs from Collector Crypt and Phygitals (graded Pokémon cards) and, later, Beezie × The Luxury Closet (watches) are a third collateral type: 40% LTV on the partner's FMV (25% haircut), collection-address whitelist, and liquidation by selling into the partner's instant buyback. These are integration targets, not signed partnerships. For the demo, use mock item NFTs.

### Added Sept 14: asset cashback
Card spend earns 0.5% / 1% / 2% (Standard / Plus / Black) cashback that auto-buys the user's chosen asset (xStocks via Jupiter, art fractions, or credit toward a collectible) and deposits it into their collateral position. For the demo, credit cashback in the mock stock mint after each simulated card capture.

Out of scope: real KYC, mainnet, real xStocks (no devnet mints), interest-rate curves, pool LP UI (admin seeds pool).

## Architecture
```
Next.js (app router, Tailwind, wallet-adapter)  ──►  Anchor program "stockcard" (devnet)
   │  /api/backpack  (server-side signed, read-only)          ├─ Config, Market(per stock mint), Position(per user+market)
   │  /api/card      (Bridge + Stripe sandbox calls)          ├─ Pyth pull oracle (price_update account)
   └─ Pyth Hermes client for price updates                    └─ USDC vault PDA (seeded by admin)
```

### Anchor program `programs/stockcard`
- **Accounts:** `Config {admin, usdc_mint, usdc_vault, apr_bps}`; `Market {stock_mint, pyth_feed_id, max_ltv_bps, liq_threshold_bps, liq_bonus_bps, collateral_vault}`; `Position {owner, market, collateral_amount, debt_principal, last_accrual_ts}`.
- **Instructions:** `init_config`, `add_market`, `deposit_collateral`, `borrow(amount, to)` (checks LTV using Pyth `PriceUpdateV2` + staleness), `repay(amount)`, `withdraw_collateral(amount)` (post-check LTV), `liquidate(amount)`, `accrue` (simple linear interest in each ix).
- **Oracles:** `pyth-solana-receiver-sdk`. Equity feeds (NVDA, SPY, TSLA…) via Hermes. Handle market-hours staleness with a wider max-age + conservative haircut, and say so in the pitch.
- **Devnet tokens:** mock mints `NVDAx`, `SPYx`, `TSLAx`, `SPCX` (6 decimals) with a faucet ix/script. Use **Bridge devnet USDC mint** as the borrow asset so card spends hit the same token.

### Frontend `app/`
- Pages: `/` (landing + pitch), `/app` (portfolio, deposit/borrow/repay panel, health bar), `/card` (virtual card UI, transactions).
- Libs: `@solana/wallet-adapter`, `@coral-xyz/anchor` client from IDL, `@pythnetwork/hermes-client` + `pyth-solana-receiver` to post a price update in the same tx.
- Design pass with `design-taste-frontend` / `brand-design` skills (Nexo-like calm fintech, not DeFi dashboard).

### Integrations
- **Bridge sandbox:** create customer → (sandbox KYC auto-approve) → card account with `crypto_wallet{chain:"solana", currency:"usdc", address}` → user approves delegate on USDC ATA → Stripe sandbox simulate authorization/capture → show resulting devnet tx. Docs: apidocs.bridge.xyz/platform/cards/sandbox, docs.stripe.com/issuing/bridge-stablecoin-cards. **Fallback** if sandbox access is gated: mock card service with the same interface that performs a real devnet USDC transfer to a "merchant settlement" address.
- **Backpack API:** user-supplied API key+secret used server-side only, never stored. Balances/capital endpoints only. **Fallback:** a demo-mode JSON fixture.

## 4-day schedule
| Day | Deliverable |
|---|---|
| **Mon 14 (today, pm)** | Apply for Bridge sandbox; scaffold repo (`scaffold-project` skill); Anchor program: config/market/deposit/borrow with Pyth; mock mints + seed script. |
| **Tue 15** | repay/withdraw/liquidate + tests (anchor test on localnet w/ mock price); deploy devnet; Next.js wallet + portfolio + deposit/borrow/repay UI wired to IDL. |
| **Wed 16** | Bridge card flow (or fallback mock); Backpack import route; health bar, APR accrual display, "crash price" demo control. |
| **Thu 17** | Polish UI, landing page, Vercel deploy, README (architecture, risk model, issuer roadmap: Rain/Baanx, Backpack SPCX), record 2–3 min video (`record-demo`/`marketing-video`), pitch deck (`create-pitch-deck`). |
| **Fri 18 (by noon ET)** | Buffer + submit (`submit-to-hackathon` skill): GitHub, live demo, video. |

## Critical files to create (new repo `~/stockcard`)
- `programs/stockcard/src/lib.rs` (+ `state.rs`, `instructions/*.rs`, `errors.rs`)
- `tests/stockcard.ts`, `scripts/seed-devnet.ts` (mints, markets, pool funding)
- `app/src/app/{page,app/page,card/page}.tsx`, `app/src/lib/{program,pyth,bridge,backpack}.ts`, `app/src/app/api/{card,backpack}/route.ts`
- `README.md`, `.env.example` (BRIDGE_API_KEY, STRIPE_SECRET_KEY, BACKPACK_* optional)
- Git author `littleplu@gmail.com` (Vercel requirement).

## Verification
- `anchor test`: deposit → borrow ≤ max LTV succeeds, over-LTV fails, repay/withdraw, price drop → liquidation succeeds, stale price rejected.
- Devnet smoke script: full flow, logging tx signatures on Solana Explorer.
- Browser preview of `/app` + `/card`: connect Phantom (devnet), run the whole flow, confirm a card spend creates a devnet USDC transfer, screenshot for the README.
- Vercel production URL loads, with no console errors.

## Risks / talking points for judges
- Oracle closed-market gaps → haircut + wider max-age; 24/7 xStock trading vs weekday oracle.
- Issuer dependency (Rain exploit) → issuer-agnostic card adapter, protocol keeps collateral in our program, not the issuer's.
- Regulatory: lending against securities + card issuing needs licensed partners → Bridge/Rain as program managers; Backpack Securities partnership for native collateral (their entitlements) as the roadmap.

## Step 0 (now): sync to GitHub for MacBook migration
- Create `~/stockcard` with: `PLAN.md` (this plan), `RESEARCH.md` (findings + source links), `README.md` (one-paragraph pitch + deadline + how to continue), `.gitignore` (Node, Anchor `target/`, `.env*`, `.anchor/`), `.env.example`, and empty `programs/stockcard/`, `app/`, `scripts/`, `tests/` (with `.gitkeep`).
- `git init`, commit as `littleplu@gmail.com` (repo-local config), `gh repo create lpsmurf/stockcard --private --source . --push`.
- On MacBook: `gh repo clone lpsmurf/stockcard`, then continue with the next steps.

## Next actions (on MacBook)
1. Request Bridge sandbox access (apidocs.bridge.xyz). It's the only external dependency with a waiting time, so it goes first.
2. Scaffold the Anchor program + Next.js app into the skeleton.
