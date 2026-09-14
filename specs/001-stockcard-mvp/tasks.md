---
description: "Task list for StockCard MVP"
---

# Tasks: StockCard MVP (web + Android)

**Input**: Design documents from `/specs/001-stockcard-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, ui.md

**Tests**: Program tests are required (SC-003). App tests are manual smoke runs (quickstart.md).

## Status (Sept 14, handoff to Kimi Code)
Done: toolchain (Rust 1.98.1, Anchor CLI 1.2.0), Next.js 16 scaffold + deps, brand tokens/fonts, wallet providers with MWA, AppShell, ConnectButton, CreditCard, HealthBar, MockBadge, risk.ts. `npx tsc --noEmit` passes. `app/src/app/page.tsx` is still the create-next-app template. Program workspace not created yet.

Values: parameters.md. Screens: wireframes.md.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: can run in parallel (different files, no dependencies)
- Definition of done for UI tasks: works at 360 px in Android Chrome with MWA, and in desktop Chrome.

## Phase 1: Setup (Mon Sept 14)

- [x] T001 Install toolchain: rustup, Anchor CLI 1.2.0 (crates.io), verify `solana`, `anchor --version`
- [ ] T002 Create Anchor workspace at repo root: `Anchor.toml`, `Cargo.toml`, `programs/stockcard/Cargo.toml` (anchor-lang 1.2, anchor-spl 1.2, pyth-solana-receiver-sdk 2.0), `tests/stockcard.ts`
- [x] T003 [P] Scaffold Next.js 16 app in `app/` (TypeScript, Tailwind 4, App Router, `src/`), add `@anchor-lang/core`, `@solana/web3.js`, wallet adapter, `@solana-mobile/wallet-standard-mobile`, react-query
- [x] T004 [P] Brand tokens and fonts in `app/src/styles/tokens.css` + `app/src/app/layout.tsx` (ui.md tokens, both themes)
- [ ] T005 [P] Update `.env.example` with all app and server variables from contracts/api.md
- [ ] T006 [P] `scripts/sync-idl.sh` copying IDL/types into `app/src/lib/idl/`

## Phase 2: Foundational (Mon–Tue)

- [ ] T007 `programs/stockcard/src/state.rs`: Config, Market, Position, SignedPrice, enums (data-model.md)
- [ ] T008 [P] `programs/stockcard/src/errors.rs` + events
- [ ] T009 [P] `programs/stockcard/src/math.rs`: accrue, collateral value, ltv, seize amount (u128, checked, round in protocol's favor) + unit tests
- [ ] T010 `programs/stockcard/src/oracle.rs`: read Pyth PriceUpdateV2 or SignedPrice with staleness + closed-market fallback; read the Token-2022 Scaled UI Amount multiplier from the collateral mint (integrations.md)
- [ ] T011b Issuer-control guards in `oracle.rs`/instructions: vault balance reconciliation (`impaired` market), mint `paused` and vault-frozen checks, block market if a transfer hook program is set; store extension flags in `Market` (integrations.md "Issuer controls")
- [ ] T011 `init_config`, `add_market`, `update_market`, `set_signed_price`, `fund_pool`, `set_pause` in `programs/stockcard/src/instructions/`
- [x] T012 [P] `app/src/lib/risk.ts`: same math as T009 for previews
- [x] T013 [P] WalletProvider (Wallet Standard + MWA registration) in `app/src/components/providers.tsx`; connect button; wrong-network banner
- [ ] T014 [P] App shell: bottom tabs / desktop rail, `MockBadge` (done) · toasts, banners, loading/empty/error states (to do)
- [ ] T015 `app/src/lib/program.ts`: Anchor client, PDA helpers, account fetch hooks (react-query)
- [ ] T016 `scripts/seed-devnet.ts`: mock mints matching mainnet (NVDAx, SPYx, TSLAx: Token-2022, **8 decimals**, Scaled UI Amount + Pausable + Permanent Delegate; SPCX: Token-2022, 6 decimals, same extensions; TIDE, PSA10; optional dUSDC), markets with plan.md parameters, signed prices, fund pool, set authorities

**Checkpoint**: `anchor build` passes, app connects a wallet on desktop and Android Chrome.

## Phase 3: US1 Borrow against a stock and spend it on the card (P1) 🎯 MVP

### Tests
- [ ] T017 [US1] `tests/stockcard.ts`: deposit; borrow at max ok; max+1 fails; stale price fails; InsufficientLiquidity

### Program
- [ ] T018 [US1] `deposit_collateral` + `deposit_collateral_for` (authority check)
- [ ] T019 [US1] `borrow` with LTV and liquidity checks
- [ ] T020 [US1] Deploy to devnet, run seed, commit program id to `.env.example` and `Anchor.toml`

### App
- [ ] T021 [P] [US1] `/api/faucet` route with rate limit (Redis or memory)
- [ ] T022 [P] [US1] S7 Assets screen + S8 deposit sheet
- [ ] T023 [US1] S2 Home: available credit, health bar, debt row
- [ ] T024 [US1] S3 Borrow sheet with preview; destination = user's USDC ATA (card wallet)
- [ ] T025 [P] [US1] `app/src/lib/card/provider.ts` interface, `mock.ts` (delegate transferChecked), `bridge.ts` stub behind env; `app/src/lib/kv.ts`
- [ ] T026 [US1] `/api/card` (create/get/patch), `/api/card/simulate`, `/api/card/transactions` with wallet-signature auth
- [x] T027 [P] [US1] `CreditCard` component (ui.md; masking approach adapted from crd-ui, MIT, attribution in file header)
- [ ] T028 [US1] S5 Card screen: create card, set limit (SPL approve), feed; S6 test purchase sheet
- [ ] T029 [US1] (Optional, Wed noon decision) Pyth path: Hermes update + post in same tx for equity markets; otherwise switch equities to Signed "Demo price"

**Checkpoint**: US1 acceptance scenarios 1–4 pass on devnet.

## Phase 4: US2 Repay and withdraw (P1)

- [ ] T030 [US2] Tests: repay all → 0 debt no dust; withdraw guarded by LTV; repay by third party
- [ ] T031 [US2] `repay` (u64::MAX = all) and `withdraw_collateral`
- [ ] T032 [US2] S4 Repay sheet + withdraw in S8 with max-withdrawable preview

**Checkpoint**: Full P1 loop on devnet; `scripts/smoke-devnet.ts` prints explorer links.

## Phase 5: US3 Health, crash, liquidation (P2)

- [ ] T033 [US3] Tests: liquidate healthy fails; after price drop succeeds; close factor; seize amount
- [ ] T034 [US3] `liquidate` instruction
- [ ] T035 [P] [US3] `/api/admin/price` (crash/restore) and `/api/admin/liquidate`, devnet + ADMIN_TOKEN guard
- [ ] T036 [US3] S11 Admin screen; health bar red state + "at risk" banner on Home

## Phase 6: US4 Cashback in assets (P2)

- [ ] T037 [US4] `/api/cashback/process`: tier %, price lookup, `deposit_collateral_for` from cashback treasury, idempotent by txId; called after settle
- [ ] T038 [US4] S9 Cashback screen (tier toggle, asset picker); cashback rows in feed and S6 preview
- [ ] T039 [US4] Test: `deposit_collateral_for` rejects non-authority (in T018 suite)

## Phase 7: US5 Art notes and collectibles (P2)

- [ ] T040 [US5] Seed TIDE (ArtNote, Signed Appraisal) and PSA10 (Collectible, Signed PartnerFmv) markets; test stale appraisal rejection
- [ ] T041 [P] [US5] Asset detail visuals: art canvas (reuse deck generator) and graded-slab render; class chips and price-source labels

## Phase 7b: Partner data adapters (P2, after US1–US4)

- [ ] T055 [P] `app/src/lib/partners/backpack-public.ts`: SPCX asset (mint, withdraw enabled), external ticker, perp mark price, depth; Assets screen shows SPCX "Withdraw from Backpack to use" and price cross-check vs Pyth
- [ ] T050 [P] `app/src/lib/partners/xstocks.ts`: typed client for public assets, price-data, multiplier, system status, proof of reserves (integrations.md); used by Assets screen and admin guard
- [ ] T051 [US3] `/api/admin/guards`: if xStocks halt or reserves < supply → call `update_market` to pause borrowing on that market; show "Trading halted" chip
- [ ] T052 [P] [US5] `app/src/lib/partners/collectorcrypt.ts`: `publicNft/:mint` and `/market` reads; Assets screen lists a wallet's Collector Crypt cards as "Eligible soon" with insured value (read-only in MVP)
- [ ] T053 [P] [US5] `app/src/lib/partners/psa.ts`: cert lookup with 24h cache, only when `PSA_API_TOKEN` is set; show "PSA verified" on the collectible detail screen
- [ ] T054 [US5] Price signer script `scripts/sign-collectible-prices.ts`: insuredValue → `set_signed_price` with PartnerFmv source (devnet uses mock PSA10 mapped to a real Collector Crypt card for display)

## Phase 8: Android + polish + submission (Thu–Fri)

- [ ] T042 PWA: `manifest.webmanifest`, icons, theme color, minimal service worker (app shell only)
- [ ] T043 Install JDK 17 + Android SDK; `solana-mobile webshell init/build`; install APK on a device; verify MWA connect + P1 flow
- [ ] T044 [P] 360 px pass on every screen; reduced motion; focus states
- [ ] T045 Vercel production deploy with env; verify no console errors
- [ ] T046 [P] README: architecture, risk params, what's mocked, run steps, screenshots, APK link
- [ ] T047 Record 2–3 min demo video (US1→US4 in one take)
- [ ] T048 [US6] (Only if time) Client-side ED25519 signer for `balanceQuery` (`app/src/lib/backpack.ts`, secret kept in memory only), `/api/backpack/import` proxy + fixture mode, `.US` symbol eligibility map, S10 screen
- [ ] T049 Submit on Stocklana by Fri Sept 18 noon ET: GitHub, live URL, APK, video

## Dependencies & order
- T001 → T002 → T007–T011 → T017–T020 → T030–T031 → T033–T034
- T003 → T013–T015 → T022–T024 → T028 → T032 → T036 → T038
- T016 needs T011 + T020 (program id)
- US3/US4/US5 depend on US1 (+US2 for liquidation). They're independent of each other.
- T011b is NOT cuttable if any real mint is used; for all-mock demo it can be reduced to the paused/frozen checks.
- Cut order if late: T048 → T055 → T052–T054 → T041 → T029 → T040 (keep US1–US4). T010 multiplier handling is NOT cuttable for real xStocks; for the demo it's required only if the mock mints use Token-2022.
