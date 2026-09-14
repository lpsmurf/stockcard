# AGENTS.md

Guidance for coding agents (Kimi Code and others) building StockCard in this repo.

## What you're building

StockCard MVP for the Stocklana hackathon (**submit by Fri Sept 18, 2026, 12:00 ET; hard deadline 4:00 PM ET**). It's a Solana devnet app where users lock real assets (tokenized stocks, art notes, graded collectibles), borrow USDC and spend it with a virtual card. Cashback buys more of those assets. It's one Next.js PWA for web and Android, plus one Anchor program.

## Read in this order before writing code

1. `.specify/memory/constitution.md`: non-negotiable rules
2. `specs/001-stockcard-mvp/spec.md`: user stories, acceptance scenarios, FRs
3. `specs/001-stockcard-mvp/parameters.md`: **every concrete value** (versions, seeds, risk params, prices, env, copy)
4. `specs/001-stockcard-mvp/wireframes.md`: screen-by-screen layout, states and copy
5. `specs/001-stockcard-mvp/plan.md`: architecture and source layout
6. `specs/001-stockcard-mvp/data-model.md`, `contracts/program.md`, `contracts/api.md`
7. `specs/001-stockcard-mvp/integrations.md`: partner APIs (xStocks, Pyth, Collector Crypt, PSA) and the program changes they force (Token-2022 multiplier)
8. `specs/001-stockcard-mvp/tasks.md`: work top to bottom, check off tasks as they land

If documents conflict: constitution > parameters.md > spec.md > plan/contracts > wireframes.

## Current state (Sept 14)
- Installed: Rust 1.98.1, Solana CLI 3.1, **Anchor CLI 1.2.0** (installed from crates.io; don't use avm from git), Node 20, npm.
- `app/`: Next.js 16.3.5 scaffold with deps, brand tokens (`src/app/globals.css`), fonts, providers with Mobile Wallet Adapter, `AppShell`, `ConnectButton`, `CreditCard`, `HealthBar`, `MockBadge`, `lib/risk.ts`, `lib/config.ts`. `npx tsc --noEmit` passes. `src/app/page.tsx` is still the template.
- Program workspace: **not created**. Start at tasks T002, T007–T011.

## Commands
```bash
# program (repo root)
anchor build
anchor test
anchor deploy --provider.cluster devnet
# app
cd app && npm run dev        # http://localhost:3000
cd app && npx tsc --noEmit   # typecheck
cd app && npm run lint
cd app && npm run build
```
Run a single program test file with `anchor test -- --grep "<test name>"` once `tests/stockcard.ts` exists.

## Rules
- **Next.js 16 has breaking changes.** Read `app/node_modules/next/dist/docs/` before using an API (see `app/AGENTS.md`). Turbopack is the default.
- **Anchor TS client is `@anchor-lang/core` 1.2.0**, not `@coral-xyz/anchor`. Rust crates `anchor-lang`/`anchor-spl` 1.2.0.
- **Real assets only.** Never add memecoin, governance or volatile crypto markets, or cashback into them.
- Real stock mints (xStocks 8 decimals, SPCX 6 decimals) are Token-2022 with permanent delegate, pausable, freeze authority and an inactive transfer hook. Implement the guards in integrations.md "Issuer controls".
- xStocks on Solana are Token-2022 with a Scaled UI Amount multiplier. Use `token_interface` + `transfer_checked`, and value collateral as raw × multiplier × price.
- Program math: integers only, bps, checked, u128 intermediates, accrue interest first. The client only previews (`app/src/lib/risk.ts` must match `math.rs`).
- Secrets and server keypairs only in route handlers. Only `NEXT_PUBLIC_*` reaches the browser. Backpack API secrets never leave the browser.
- Card integration only through `CardProvider`; `mock` is the default path.
- Every mock (mints, prices, card, artwork) shows `MockBadge`. Visa/Mastercard appear as text placeholders only, never logos.
- Every screen must work at 360 px in Android Chrome and connect via MWA. Use the brand tokens; don't add new colors or fonts.
- Keep UI copy from wireframes.md and error copy from parameters.md §2.
- Don't edit the business docs (`BUSINESS_MODEL.md`, `GTM_PARTNERSHIPS.md`, `FUNDRAISING.md`, `pitch-deck-*.html`) as part of build tasks.
- Commit as `littleplu@gmail.com` (Vercel requirement). Don't commit `.env*` or keypairs.
- Cut order if late: Backpack import → asset visuals → Pyth path (use Signed/Demo) → art/collectible markets. Keep US1–US4.
