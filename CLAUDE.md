# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

StockCard: a stock-backed credit card on Solana, built for the Stocklana hackathon (submission deadline **Fri Sept 18, 2026, 4:00 PM ET**). Users lock tokenized US stocks (xStocks, Backpack's SPCX) in an on-chain vault, borrow USDC up to a max LTV at a fixed APR, and spend it through a card.

`app/` is a Next.js 16 scaffold with the wallet/brand foundation (`cd app && npm run dev`, `npx tsc --noEmit`, `npm run lint`). The Anchor workspace isn't created yet; intended commands are `anchor build` / `anchor test` / `anchor deploy --provider.cluster devnet` with Anchor CLI 1.2.0.

The MVP build is spec-driven (GitHub Spec Kit): see `AGENTS.md` for the reading order. `specs/001-stockcard-mvp/` holds spec, plan, parameters (all concrete values), wireframes, data model, contracts and tasks, and `.specify/memory/constitution.md` holds the rules. Implementation is handed to Kimi Code; keep those docs as the source of truth.

`PLAN.md` is the original planning doc for scope, account layouts, instructions, schedule, and verification criteria. `RESEARCH.md` holds competitor/issuer findings. Read `PLAN.md` before starting any implementation work.

## Intended architecture

```
Next.js app (app/)  ──►  Anchor program "stockcard" (devnet)
  /api/backpack  server-side signed, read-only        Config, Market (per stock mint), Position (per user+market)
  /api/card      Bridge + Stripe Issuing sandbox       Pyth pull oracle (PriceUpdateV2 account)
  Pyth Hermes client posts price updates in-tx         USDC vault PDA, seeded by admin
```

- **Program** (`programs/stockcard/src/{lib.rs,state.rs,errors.rs,instructions/*.rs}`): instructions `init_config`, `add_market`, `deposit_collateral`, `borrow`, `repay`, `withdraw_collateral`, `liquidate`. Interest is simple linear accrual applied at the start of each instruction (no rate curves). LTV checks read Pyth `PriceUpdateV2` via `pyth-solana-receiver-sdk` with a staleness check; equity feeds go stale outside market hours, so use a wider max-age plus a conservative haircut.
- **Collateral tokens** on devnet are mock mints (`NVDAx`, `SPYx`, `TSLAx`, `SPCX`, 6 decimals) created by `scripts/seed-devnet.ts`. Real xStocks have no devnet mints.
- **Borrow asset must be the Bridge devnet USDC mint** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, so card spends debit the same token the program lends.
- **Card flow** (Bridge sandbox): create customer → sandbox KYC auto-approve → card account with `crypto_wallet{chain:"solana", currency:"usdc", address}` → user approves delegate on their USDC ATA → Stripe sandbox simulates authorization/capture. Keep the card layer behind an issuer-agnostic interface; the fallback, if sandbox access is gated, is a mock card service with the same interface that does a real devnet USDC transfer to a merchant settlement address.
- **Backpack import**: Backpack Securities stocks are broker entitlements, not SPL tokens, so they can never be collateral; only SPCX can. The browser signs a `balanceQuery` request with the user's ED25519 secret (the secret never reaches our server); `/api/backpack/import` only proxies `GET /api/v1/capital` with those headers. Backpack stock symbols carry a `.US` suffix. Fallback is a demo JSON fixture.

- **Art collateral**: fractionalized art (sample lots in `BUSINESS_MODEL.md`) is a second collateral type. It needs an `oracle_kind` on `Market` (`Pyth` vs `Appraisal`), an admin/appraiser-signed `AppraisalPrice` account with staleness checks, 30% max LTV, and a 20% haircut. The artworks are placeholders; never present them as real acquisitions. Legally, art tokens are asset-backed notes from a per-artwork compartment of one Luxembourg securitisation vehicle (not US/Delaware SPVs).
- **Collectibles collateral**: whole-item NFTs (graded cards, watches) from whitelisted partner collections. They're non-fungible, so they need a per-item collateral account with an FMV price posted by a signer (not a per-mint `Market` alone), 40% LTV and a 25% haircut. Don't describe Collector Crypt, Phygitals or Beezie as partners; they are integration targets.
- **Asset cashback**: after each card settlement, a cashback amount (tier-based %) buys the user's chosen asset and deposits it as collateral in their position. It is not paid out as USDC or points.

`GTM_PARTNERSHIPS.md` has the team (co-founder Bart Bloemers), partner and advisor targets, and the 30-day plan. No partnerships or advisors are signed; don't present targets as confirmed.

`FUNDRAISING.md` compares raising via a MetaDAO ICO / Colosseum STAMP vs a SAFE; the instrument isn't decided yet.

`BUSINESS_MODEL.md` has the revenue model, projections (assumptions) and raise; `pitch-deck-*.html` is the investor deck.

Out of scope: real KYC, mainnet, real xStocks, interest-rate curves, LP/pool UI.

## Constraints

- **Real assets only**: collateral and cashback purchases are limited to tokenized equities, Luxembourg art notes and whitelisted vaulted collectibles. Never add memecoins, governance or volatile crypto tokens as collateral markets.

- **Commit as `littleplu@gmail.com`** (set in repo-local git config). Vercel deploys break with other author emails.
- Secrets (`BRIDGE_API_KEY`, `STRIPE_SECRET_KEY`, `BACKPACK_*`) are server-side only; only `NEXT_PUBLIC_*` vars in `.env.example` may reach the client.
- UI direction is calm consumer fintech (Nexo-like), not a DeFi dashboard with health factors and loops.
