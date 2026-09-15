# AGENTS.md

Guidance for AI coding agents (Kimi Code, Claude Code, and others) working in this repository. Read this file first, then the spec kit in the order listed below before writing any code.

## Project overview

**StockCard** — a stock-backed credit card on Solana, built for the **Stocklana hackathon** (Solana Foundation, $100k pool). **Hard deadline: Fri Sept 18, 2026, 4:00 PM ET; target submission by noon ET.**

Users lock real-world assets (tokenized stocks like xStocks and Backpack's SPCX, art notes, whitelisted graded collectibles) in an on-chain Anchor vault, borrow USDC up to a max LTV at a fixed APR, and spend it with a virtual Visa/Mastercard-style card. Card cashback buys more of the user's chosen asset and deposits it into their collateral position. Positioning: *"Kamino gives DeFi users a money market. Backpack gives CEX users margin. We give stock holders a credit card."* Solo team (Luis + Claude). Judges ask "could this be a real app people will actually use?" — a working end-to-end demo beats breadth.

One Next.js 16 PWA is both the website and the Android app (wrapped as an APK with `solana-mobile webshell`, connecting wallets via Mobile Wallet Adapter). The Anchor program lives in the same repo. Solana **devnet only** — no mainnet, no real KYC, no real artworks or partner integrations.

## How this project is run: spec-driven (Spec Kit)

The MVP is built with GitHub Spec Kit. `.specify/memory/constitution.md` holds the non-negotiable project rules (demo-first vertical slices, real assets only, collateral safety in the program, issuer-agnostic card, mobile-first, honest demo). Implementation work follows `specs/001-stockcard-mvp/tasks.md` top to bottom; check off tasks as they land.

**Read in this order before writing code:**

1. `.specify/memory/constitution.md` — non-negotiable rules
2. `specs/001-stockcard-mvp/spec.md` — user stories, acceptance scenarios, FRs
3. `specs/001-stockcard-mvp/parameters.md` — **every concrete value** (pinned versions, PDA seeds, risk params, prices, env vars, UI/error copy). If code disagrees with this file, this file wins
4. `specs/001-stockcard-mvp/wireframes.md` — screen-by-screen layout, states and copy
5. `specs/001-stockcard-mvp/plan.md` — architecture and source layout
6. `specs/001-stockcard-mvp/data-model.md`, `contracts/program.md`, `contracts/api.md`
7. `specs/001-stockcard-mvp/integrations.md` — partner APIs (xStocks, Jupiter, Switchboard, Backpack, Collector Crypt, PSA; Pyth/Chainlink as production references) and the program changes they force (Token-2022 Scaled UI Amount multiplier, issuer controls)
8. `specs/001-stockcard-mvp/tasks.md` — the work queue

Conflict precedence: **constitution > parameters.md > spec.md > plan/contracts > wireframes**.

`PLAN.md` (repo root) is the original planning doc with competitor/card-issuer research context; `RESEARCH.md` holds the raw findings. Read `PLAN.md` before architectural decisions. `CLAUDE.md` mirrors this file for Claude Code — keep the two consistent.

## Second workstream: landing site (`specs/002-landing-site/`)

After the MVP submission, build the waitlist landing page from `specs/002-landing-site/brief.md`, `assets.md` and `tasks.md`. It is a separate Next.js project in `landing/` with its own Vercel project; don't change `app/`. The brief fixes facts, numbers, guardrails and the banned-font list, and marks what is left to your design judgment ("Kimi's call").

## Current state (verified Sept 14)

**Done:**
- Toolchain: Node 22.22.3 / npm 10.9.8, Rust 1.96.1 (cargo), **anchor-cli 1.2.0** (from crates.io with `--locked` — avm-from-git fails on this machine). `npx tsc --noEmit` in `app/` passes.
- `app/`: Next.js 16.3.5 scaffold with all dependencies installed. Brand tokens in `app/src/app/globals.css` (plaster/ink/brass, light + dark themes), fonts via `next/font/google` (Bodoni Moda display, Hanken Grotesk UI, IBM Plex Mono numbers), wallet providers with Mobile Wallet Adapter registration (`src/components/providers.tsx`), `AppShell`, `ConnectButton`, `CreditCard`, `HealthBar`, `MockBadge`, `src/lib/risk.ts` (bigint preview math), `src/lib/config.ts`, PWA `manifest.ts`.

**Not done / gaps:**
- **The Solana CLI is NOT installed on this machine** (`solana: command not found`) and there is no default keypair at `~/.config/solana/id.json` — despite parameters.md claiming otherwise. Install Solana CLI 3.x (`sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`) and create a devnet keypair before any program work or deploy.
- Rust is 1.96.1, not the pinned 1.98.1 — fine so far, but record it if it causes build issues.
- **The Anchor workspace does not exist.** No `Anchor.toml`, no `Cargo.toml`, no `programs/stockcard/Cargo.toml`, no `tests/stockcard.ts`. Program work starts at task T002, then T007–T011.
- `app/src/app/page.tsx` is still the create-next-app template. `.env.example` is outdated (missing most variables from parameters.md §5 — that's task T005). `scripts/sync-idl.sh`, `scripts/seed-devnet.ts`, `scripts/smoke-devnet.ts` don't exist yet.
- No program ID yet — generated by `anchor keys list` on first build, then written to `Anchor.toml`, `declare_id!`, and `NEXT_PUBLIC_PROGRAM_ID`.

## Repository layout

```
.specify/                  Spec Kit memory (constitution), templates, scripts, workflows
.claude/skills/speckit-*   Spec Kit agent skills
specs/001-stockcard-mvp/   the MVP spec kit (spec, plan, parameters, wireframes, ui, data-model,
                           integrations, research, quickstart, contracts/, tasks.md)
programs/stockcard/        Anchor program — to be created (currently only .gitkeep)
app/                       Next.js 16 PWA (the only frontend + API codebase)
tests/                     anchor tests (tests/stockcard.ts — to be created)
scripts/                   seed-devnet.ts, smoke-devnet.ts, sync-idl.sh — to be created
PLAN.md, RESEARCH.md       original planning + research notes
BUSINESS_MODEL.md, GTM_PARTNERSHIPS.md, FUNDRAISING.md, pitch-deck-*.html
                           business/investor docs — read for context, never edit as build tasks
```

## Technology stack (pinned in parameters.md §1)

- **Program:** Rust (anchor-lang 1.2.0, anchor-spl 1.2.0), no oracle crate in the base build (`switchboard-on-demand` 0.13.x only if the Wednesday spike passes). Token-2022 support via `anchor_spl::token_interface` (`InterfaceAccount<Mint>`, `transfer_checked`).
- **App:** Next.js 16.3.5 (Turbopack default; **breaking changes — see "Rules" below**), React 19.2.8, Tailwind CSS 4, TypeScript 5, `@anchor-lang/core` 1.2.0 (**the Anchor TS client — not `@coral-xyz/anchor`**), `@solana/web3.js` 1.99, `@solana/spl-token` 0.4, wallet-adapter + `@solana-mobile/wallet-standard-mobile` 0.6.0, `@tanstack/react-query` 5, `@pythnetwork/hermes-client`, `@noble/curves` (ED25519).
- **Storage:** on-chain for credit; off-chain card/tx records in Vercel KV / Upstash Redis (in-memory map fallback in local dev).
- **External APIs:** xStocks public API (api.backed.fi), Jupiter Price v3 (keyless lite endpoint) for the price signer, Switchboard On-Demand (spike only; Pyth equity access ~$2,500/month and Chainlink Data Streams from $150/month are not used), Backpack (public + ED25519-signed), Collector Crypt, PSA (optional), Bridge/Stripe (optional, sandbox).

## Commands

```bash
# Program (repo root)
anchor build --arch v2            # REQUIRED: anchor 1.2 defaults to SBPFv3, solana-test-validator rejects it
# anchor test needs a manually started validator (surfpool is not installed on this machine).
# ALWAYS use scripts/validator.sh — it puts the ledger in /tmp with a size cap. A plain
# `solana-test-validator --reset` in the repo root wrote a 9.4 GB test-ledger and thrashed the machine.
scripts/validator.sh &              # add --keep to reuse the existing ledger
sleep 8 && solana airdrop 100 .devnet-wallet.json --url http://localhost:8899
anchor test --skip-build --skip-local-validator --provider.cluster localnet
anchor test --skip-build --skip-local-validator --provider.cluster localnet -- --grep "<name>"
anchor deploy --provider.cluster devnet
./scripts/sync-idl.sh              # copies IDL + types into app/src/lib/idl/
npx tsx scripts/seed-devnet.ts     # mock mints, markets, signed prices, pool funding
npx tsx scripts/smoke-devnet.ts    # P1 flow, prints explorer links

# App
cd app && npm run dev              # http://localhost:3000
cd app && npx tsc --noEmit         # typecheck (passes today)
cd app && npm run lint
cd app && npm run build

# Android APK (Thursday): JDK 17 + Android SDK needed
npx solana-mobile webshell init    # in android/, point at the Vercel URL
npx solana-mobile webshell build
```

Android testing on the same network: open `http://<lan-ip>:3000` in Android Chrome with Phantom/Solflare. MWA needs HTTPS outside localhost — use the Vercel preview URL or `npx localtunnel --port 3000`. Full manual smoke: `specs/001-stockcard-mvp/quickstart.md`.

## Code organization (planned)

**Program** (`programs/stockcard/src/`, per plan.md):
- `lib.rs` (instruction entrypoints), `state.rs` (Config, Market, Position, SignedPrice), `errors.rs`, `math.rs` (accrue/value/ltv — checked integer math, u128 intermediates), `oracle.rs` (`SignedPrice`, plus a Switchboard arm if the spike passes, + staleness + closed-market fallback + Token-2022 multiplier), `instructions/` (init_config, add_market, update_market, set_signed_price, fund_pool, set_pause, deposit, deposit_for, withdraw, borrow, repay, liquidate, admin).
- PDA seeds and all params: parameters.md §2. Program errors → UI copy mapping: parameters.md §2.

**App** (`app/src/`):
- `app/` — routes: `/` (home), `/borrow`, `/card`, `/portfolio`, `/cashback`, `/import`, `/admin` (devnet only), plus `api/` route handlers (card, cashback, faucet, backpack, admin).
- `components/` — CreditCard, HealthBar, MockBadge, AppShell, etc. (see ui.md).
- `lib/` — `program.ts` (Anchor client from IDL + PDA helpers + react-query hooks), `risk.ts` (previews), `prices.ts` (price signer sources), `card/{provider,mock,bridge}.ts`, `kv.ts`, `partners/*.ts`, `idl/`.

## Architecture diagrams (Archify)

All architecture, workflow, sequence, data-flow and lifecycle diagrams use **Archify**, vendored at `.claude/skills/archify` (v2.17.0-dev.1, MIT, from github.com/tt-a1i/archify @ 851b279). No hand-drawn SVG, Mermaid or ASCII diagrams in new docs.

- Sources live in `docs/architecture/<name>.<type>.json` (typed JSON, reviewed in PRs); the HTML next to it is generated. Current map: `docs/architecture/stockcard-mvp.architecture.json`.
- Workflow: read `.claude/skills/archify/SKILL.md`, then from `.claude/skills/archify` run
  `node bin/archify.mjs validate <type> <file>.json --quality showcase --json` → fix diagnostics → `node bin/archify.mjs deliver <type> <file>.json <file>.html --quality showcase --json` → `node bin/archify.mjs visual-check <file>.html --json`. Only a zero-exit deliver plus a passing visual-check counts as done.
- When a change alters the architecture (new component, route, oracle, custody or trust boundary), update the JSON in the same PR and render a before/after with `node bin/archify.mjs compare architecture <base.json> <head.json> <compare.html>`.
- Keep facts in sync with `specs/001-stockcard-mvp` (parameters.md wins). Mark mocks and non-partners honestly in labels/cards.
- Don't upgrade the vendored copy without asking Luis; set `ARCHIFY_UPDATE_CHECK_DISABLED=1` in CI.

## Rules and conventions

- **Next.js 16 is not the Next.js you know** — breaking changes vs training data. Read the relevant guide in `app/node_modules/next/dist/docs/` before using any Next API (see `app/AGENTS.md`).
- **Anchor TS client is `@anchor-lang/core` 1.2.0**, never `@coral-xyz/anchor`.
- **Real assets only** (constitution II): collateral and cashback assets are limited to tokenized equities, art notes, whitelisted collectibles. Never add memecoins, governance or volatile crypto markets. `add_market` is admin-only.
- **Program math:** integers only, base units + basis points, checked arithmetic, u128 intermediates, interest rounded up (protocol's favor), accrue before any state change. The client only previews — `app/src/lib/risk.ts` must stay identical to `math.rs`.
- **Collateral safety lives in the program** (constitution III): every borrow/withdraw/liquidate checks LTV against a staleness-passing price in the same instruction. The client never decides safety.
- **xStocks/SPCX are Token-2022** with a Scaled UI Amount multiplier, permanent delegate, pausable, freeze authority, possible transfer hook. Value collateral as `raw × multiplier × price × (1 − haircut)`; implement the issuer-control guards in integrations.md "Issuer controls" (vault reconciliation → `impaired` market, paused/frozen checks, hook-set blocking). Mock equity mints must also be Token-2022 with the extension so the demo exercises the same path.
- **Issuer-agnostic card** (constitution IV): all card traffic goes through the `CardProvider` interface (`app/src/lib/card/provider.ts`); `mock` is the default provider, `bridge` only when `BRIDGE_API_KEY` is set.
- **Honest demo** (constitution VI): every mock (mints, prices, card, artworks) shows the `MockBadge` component; Visa/Mastercard appear as text placeholders only, never logos; nothing is presented as a real acquisition, partnership or mainnet asset.
- **Mobile first** (constitution V): every screen must work at 360 px wide in Android Chrome with MWA before it counts as done; touch targets ≥ 44 px; brand tokens from `globals.css`/`ui.md` only — no new colors or fonts.
- **Copy:** UI copy comes from `wireframes.md`, error copy from `parameters.md` §2, money format `$1,234.56`, explorer links to `explorer.solana.com/tx/{sig}?cluster=devnet`.
- **Vertical slices** (constitution I): every user story ships end to end (instruction → screen → devnet tx). P1 (deposit → borrow → card spend, then repay/withdraw) works before any P2 work. If late, cut whole stories in this order: Backpack import (T048) → SPCX partner adapter (T055) → Collector Crypt/PSA adapters (T052–T054) → asset visuals (T041) → Pyth path (T029, fall back to Signed "Demo price") → art/collectible markets (T040). Never cut US1–US4. Pyth-vs-Signed decision deadline: Wed Sept 16, 12:00 ET.
- **Commit as `littleplu@gmail.com`** (repo-local git config; Vercel deploys break with other author emails). Never commit `.env*` (except `.env.example`), keypairs, or secrets — all gitignored already.
- Don't edit the business docs (`BUSINESS_MODEL.md`, `GTM_PARTNERSHIPS.md`, `FUNDRAISING.md`, `pitch-deck-*.html`) as part of build tasks, and never present partner/advisor targets in them as confirmed.

## Testing strategy

- **Program tests are required** (`tests/stockcard.ts`, mocha, local validator, `Signed` markets only — no oracle network in tests). SC-003 coverage: borrow at max LTV succeeds / 1 unit over fails; stale signed price fails; repay-all leaves zero debt (no dust); withdraw guarded by LTV; liquidation fails when healthy and succeeds after a price drop with correct seize amount; `deposit_collateral_for` rejects non-authority; interest after a simulated time jump matches `lib/risk.ts`.
- **App tests are manual smoke runs** (quickstart.md): the P1 flow on devnet — faucet NVDAx → deposit → borrow → card limit approve → test purchase → feed shows settled tx with explorer link + cashback row → repay all → withdraw all. `scripts/smoke-devnet.ts` automates this and prints signatures.
- Definition of done for UI tasks: works at 360 px in Android Chrome with MWA **and** in desktop Chrome. Each day ends with a devnet deploy and a P1 smoke run (constitution workflow).

## Security considerations

- Secrets and server keypairs (`CARD_AUTHORITY_SECRET`, `CASHBACK_AUTHORITY_SECRET`, `FAUCET_AUTHORITY_SECRET`, `ADMIN_SECRET`, `ADMIN_TOKEN`, `BRIDGE_API_KEY`, `STRIPE_SECRET_KEY`, KV tokens) live **only in route handlers / server env**. Only `NEXT_PUBLIC_*` variables reach the browser. `.env*` files and keypairs are gitignored.
- Wallet-mutating API routes require `x-wallet`, `x-signature` (ed25519 over `stockcard:{route}:{timestamp}`), `x-timestamp` (≤ 5 min old), verified server-side. Admin routes additionally require `x-admin-token == ADMIN_TOKEN` and devnet only.
- **Backpack API secret never leaves the browser**: the client signs only a `balanceQuery` request (ED25519 via `@noble/curves`, secret kept in memory only); `/api/backpack/import` just proxies `GET /api/v1/capital` with those headers. Nothing stored, nothing logged. Never call or accept scopes for `withdraw`.
- The server never holds user collateral — it can only spend what a user delegated to the card authority (SPL token delegate allowance).
- Prices (signed or Switchboard) must pass staleness checks before any LTV decision; equity markets get a wider closed-market max-age plus a haircut (parameters.md §2).

## Deployment

- **Frontend:** Vercel (production URL is part of the submission; needs `NEXT_PUBLIC_*` env vars set).
- **Program:** Solana devnet via `anchor deploy --provider.cluster devnet`, then `seed-devnet.ts`, then commit the program ID to `Anchor.toml`, `declare_id!`, and `.env.example`.
- **Android:** the PWA wrapped by `solana-mobile webshell` into an APK (JDK 17 + Android SDK needed — not yet installed).
