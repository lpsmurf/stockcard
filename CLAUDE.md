# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

StockCard: a stock-backed credit card on Solana, built for the Stocklana hackathon (submission deadline **Fri Sept 18, 2026, 4:00 PM ET**). Users lock tokenized US stocks (xStocks, Backpack's SPCX) in an on-chain vault, borrow USDC up to a max LTV at an LTV-based APR (stocks 9.9–14.9%), and spend it through a card. Savers deposit USDC that funds the loans (~6% target APY, 40% of interest to the protocol). A Demo Shop sells mock stocks and mirrored Collector Crypt cards/watches for test dUSDC.

`app/` is a Next.js 16 scaffold with the wallet/brand foundation (`cd app && npm run dev`, `npx tsc --noEmit`, `npm run lint`). The Anchor workspace isn't created yet; intended commands are `anchor build` / `anchor test` / `anchor deploy --provider.cluster devnet` with Anchor CLI 1.2.0.

The MVP build is spec-driven (GitHub Spec Kit): see `AGENTS.md` for the reading order. `specs/001-stockcard-mvp/` holds spec, plan, parameters (all concrete values), wireframes, data model, contracts and tasks, and `.specify/memory/constitution.md` holds the rules. Implementation is handed to Kimi Code; keep those docs as the source of truth.

`PLAN.md` is the original planning doc for scope, account layouts, instructions, schedule, and verification criteria. `RESEARCH.md` holds competitor/issuer findings. Read `PLAN.md` before starting any implementation work.

## Intended architecture

```
Next.js app (app/)  ──►  Anchor program "stockcard" (devnet)
  /api/backpack  server-side signed, read-only        Config, Market (per stock mint), Position (per user+market)
  /api/card      mock card (Bridge sandbox optional)   SignedPrice PDA (+ Switchboard if spike passes)
  /api/prices    price signer: xStocks + Jupiter        USDC vault PDA, seeded by admin
  /api/alerts    band check + web push
```

- **Program** (`programs/stockcard/src/{lib.rs,state.rs,errors.rs,instructions/*.rs}`): instructions `init_config`, `add_market`, `deposit_collateral`, `borrow`, `repay`, `withdraw_collateral`, `liquidate`. Interest is simple linear accrual applied at the start of each instruction, at the position's APR band (no utilization curves); instructions also include `deposit_savings`, `withdraw_savings`, `claim_reserve`. LTV checks read the market's `SignedPrice` (sources Market / Appraisal / PartnerFmv / Demo) with a staleness check; equity prices go stale outside market hours, so use a wider max-age plus a conservative haircut. **Oracle plan (hybrid):** a server price signer posts xStocks + Jupiter prices every 60 s when they agree within 2%; a Wednesday Switchboard spike (go/no-go 12:00 ET) may move SPYx/TSLAx to Switchboard; NVDAx stays Signed so the demo crash works. Pyth equity access (~$2,500/month) and Chainlink Data Streams (from $150/month) are the production path, not the MVP.
- **Collateral tokens** on devnet are mock Token-2022 mints matching mainnet decimals (`NVDAx`, `SPYx`, `TSLAx` 8 decimals with the Scaled UI Amount multiplier; `SPCX` 6) created by `scripts/seed-devnet.ts`, plus `TIDE` (art note) and `PSA10` (graded Pokémon card). Real xStocks have no devnet mints.
- **Borrow asset must be the Bridge devnet USDC mint** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, so card spends debit the same token the program lends.
- **Card flow** (Bridge sandbox): create customer → sandbox KYC auto-approve → card account with `crypto_wallet{chain:"solana", currency:"usdc", address}` → user approves delegate on their USDC ATA → Stripe sandbox simulates authorization/capture. Keep the card layer behind an issuer-agnostic interface; the fallback, if sandbox access is gated, is a mock card service with the same interface that does a real devnet USDC transfer to a merchant settlement address.
- **Backpack import**: Backpack Securities stocks are broker entitlements, not SPL tokens, so they can never be collateral; only SPCX can. The browser signs a `balanceQuery` request with the user's ED25519 secret (the secret never reaches our server); `/api/backpack/import` only proxies `GET /api/v1/capital` with those headers. Backpack stock symbols carry a `.US` suffix. Fallback is a demo JSON fixture.

- **Art collateral**: fractionalized art (sample lots in `BUSINESS_MODEL.md`) is a second collateral type. It uses a `SignedPrice` with source `Appraisal` and staleness checks, 30% max LTV, and a 20% haircut. The artworks are placeholders; never present them as real acquisitions. Legally, art tokens are asset-backed notes from a per-artwork compartment of one Luxembourg securitisation vehicle (not US/Delaware SPVs).
- **Collectibles collateral**: whole-item NFTs (graded cards, watches) from whitelisted partner collections. They're non-fungible, so they need a per-item collateral account with an FMV price posted by a signer (not a per-mint `Market` alone), 40% LTV and a 25% haircut. Don't describe Collector Crypt, Phygitals or Beezie as partners; they are integration targets.
- **Position protection**: suggested max 35% LTV with the liquidation price shown; alert bands (Warning 55%, Urgent 60%, Liquidatable 65%) with in-app banners and web push that give exact add-collateral / repay amounts; demo crash is −30% and one 50% liquidation leaves the position no longer liquidatable (~52%).
- **Asset cashback**: after each card settlement, a cashback amount (tier-based %) buys the user's chosen asset and deposits it as collateral in their position. It is not paid out as USDC or points.

`GTM_PARTNERSHIPS.md` has the team (co-founder Bart Bloemers), partner and advisor targets, and the 30-day plan. No partnerships or advisors are signed; don't present targets as confirmed.

`FUNDRAISING.md` compares raising via a MetaDAO ICO / Colosseum STAMP vs a SAFE; the instrument isn't decided yet.

`BUSINESS_MODEL.md` has the revenue model, projections (assumptions) and raise; `pitch-deck-*.html` is the investor deck.

Out of scope: real KYC, mainnet, real xStocks, utilization-based rate curves, SOL/crypto staking (post-MVP).

## Architecture diagrams (Archify)

All architecture, workflow, sequence, data-flow and lifecycle diagrams use **Archify**, vendored at `.claude/skills/archify` (v2.17.0-dev.1, MIT, from github.com/tt-a1i/archify @ 851b279). No hand-drawn SVG, Mermaid or ASCII diagrams in new docs.

- Sources live in `docs/architecture/<name>.<type>.json` (typed JSON, reviewed in PRs); the HTML next to it is generated. Current map: `docs/architecture/stockcard-mvp.architecture.json`.
- Workflow: read `.claude/skills/archify/SKILL.md`, then from `.claude/skills/archify` run
  `node bin/archify.mjs validate <type> <file>.json --quality showcase --json` → fix diagnostics → `node bin/archify.mjs deliver <type> <file>.json <file>.html --quality showcase --json` → `node bin/archify.mjs visual-check <file>.html --json`. Only a zero-exit deliver plus a passing visual-check counts as done.
- When a change alters the architecture (new component, route, oracle, custody or trust boundary), update the JSON in the same PR and render a before/after with `node bin/archify.mjs compare architecture <base.json> <head.json> <compare.html>`.
- Keep facts in sync with `specs/001-stockcard-mvp` (parameters.md wins). Mark mocks and non-partners honestly in labels/cards.
- Don't upgrade the vendored copy without asking Luis; set `ARCHIFY_UPDATE_CHECK_DISABLED=1` in CI.

## Constraints

- **Real assets only**: collateral and cashback purchases are limited to tokenized equities, Luxembourg art notes and whitelisted vaulted collectibles. Never add memecoins, governance or volatile crypto tokens as collateral markets.

- **Commit as `littleplu@gmail.com`** (set in repo-local git config). Vercel deploys break with other author emails.
- Secrets (`BRIDGE_API_KEY`, `STRIPE_SECRET_KEY`, `BACKPACK_*`) are server-side only; only `NEXT_PUBLIC_*` vars in `.env.example` may reach the client.
- UI direction is calm consumer fintech (Nexo-like), not a DeFi dashboard with health factors and loops.
