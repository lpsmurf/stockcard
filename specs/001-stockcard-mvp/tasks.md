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
- [x] T002 Create Anchor workspace at repo root: `Anchor.toml`, `Cargo.toml`, `programs/stockcard/Cargo.toml` (anchor-lang 1.2, anchor-spl 1.2; no oracle crate yet), `tests/stockcard.ts`
- [x] T003 [P] Scaffold Next.js 16 app in `app/` (TypeScript, Tailwind 4, App Router, `src/`), add `@anchor-lang/core`, `@solana/web3.js`, wallet adapter, `@solana-mobile/wallet-standard-mobile`, react-query
- [x] T004 [P] Brand tokens and fonts in `app/src/styles/tokens.css` + `app/src/app/layout.tsx` (ui.md tokens, both themes)
- [x] T005 [P] Update `.env.example` with all app and server variables from contracts/api.md
- [x] T006 [P] `scripts/sync-idl.sh` copying IDL/types into `app/src/lib/idl/`

## Phase 2: Foundational (Mon–Tue)

- [x] T007 `programs/stockcard/src/state.rs`: Config, Market, Position, SignedPrice, enums (data-model.md)
- [x] T008 [P] `programs/stockcard/src/errors.rs` + events
- [x] T009 [P] `programs/stockcard/src/math.rs`: accrue (position APR, reserve share), APR band selection, collateral value, ltv, seize amount, savings shares ↔ amount, utilization (u128, checked, round in protocol's favor) + unit tests
- [x] T010 `programs/stockcard/src/oracle.rs`: read `SignedPrice` (sources Market / Appraisal / PartnerFmv / Demo) with staleness + closed-market fallback, behind an `oracle_kind` match so a `Switchboard` arm can be added in T029b; read the Token-2022 Scaled UI Amount multiplier from the collateral mint (integrations.md)
- [x] T011b Issuer-control guards in `oracle.rs`/instructions: vault balance reconciliation (`impaired` market), mint `paused` and vault-frozen checks, block market if a transfer hook program is set; store extension flags in `Market` (integrations.md "Issuer controls")
- [x] T011 `init_config`, `add_market`, `update_market`, `set_signed_price`, `fund_pool`, `set_pause` in `programs/stockcard/src/instructions/`
- [x] T012 [P] `app/src/lib/risk.ts`: same math as T009 for previews (APR bands, reserve share, savings share math — done)
- [x] T013 [P] WalletProvider (Wallet Standard + MWA registration) in `app/src/components/providers.tsx`; connect button; wrong-network banner
- [ ] T014 [P] App shell: bottom tabs / desktop rail, `MockBadge` (done) · toasts, banners, loading/empty/error states (to do)
- [ ] T015 `app/src/lib/program.ts`: Anchor client, PDA helpers, account fetch hooks (react-query)
- [ ] T016 `scripts/seed-devnet.ts`: mock mints matching mainnet (NVDAx, SPYx, TSLAx: Token-2022, **8 decimals**, Scaled UI Amount + Pausable + Permanent Delegate; SPCX: Token-2022, 6 decimals, same extensions; TIDE, PSA10; optional dUSDC), markets with plan.md parameters, signed prices, fund pool, set authorities

**Checkpoint**: `anchor build` passes, app connects a wallet on desktop and Android Chrome.

## Phase 3: US1 Borrow against a stock and spend it on the card (P1) 🎯 MVP

### Tests
- [x] T017 [US1] `tests/stockcard.ts`: deposit; borrow at max ok; max+1 fails; stale price fails; InsufficientLiquidity

### Program
- [x] T018 [US1] `deposit_collateral` + `deposit_collateral_for` (authority check)
- [x] T019 [US1] `borrow` with LTV and liquidity checks
- [ ] T020 [US1] Deploy to devnet, run seed, commit program id to `.env.example` and `Anchor.toml`

### App
- [ ] T021 [P] [US1] `/api/faucet` test money (100,000 dUSDC once, 10,000/24 h) with rate limit (Redis or memory)
- [ ] T022 [P] [US1] S7 Assets screen + S8 deposit sheet
- [ ] T023 [US1] S2 Home: available credit, health bar, debt row
- [ ] T024 [US1] S3 Borrow sheet with preview; destination = user's USDC ATA (card wallet)
- [ ] T025 [P] [US1] `app/src/lib/card/provider.ts` interface, `mock.ts` (delegate transferChecked), `bridge.ts` stub behind env; `app/src/lib/kv.ts`
- [ ] T026 [US1] `/api/card` (create/get/patch), `/api/card/simulate`, `/api/card/transactions` with wallet-signature auth
- [x] T027 [P] [US1] `CreditCard` component (ui.md; masking approach adapted from crd-ui, MIT, attribution in file header)
- [ ] T028 [US1] S5 Card screen: create card, set limit (SPL approve), feed; S6 test purchase sheet
- [ ] T029a [US1] Price signer: `/api/prices/sync` (CRON_SECRET) reads xStocks `price-data` + Jupiter Price v3 (SPCX: Backpack External + Jupiter), posts `set_signed_price` source `Market` when sources agree within 200 bps; skips markets under a `Demo` override; QStash every 60 s (parameters.md "Price signer")
- [ ] T029b [US1] (Wed 09:00–11:00 ET spike, go/no-go 12:00) Switchboard: add `switchboard-on-demand` 0.13.x, confirm it builds with anchor-lang 1.2; create a custom SPYx devnet feed from the same sources; add `OracleKind::Switchboard` arm in `oracle.rs` + client update in the borrow tx; test. Go → SPYx/TSLAx switch; no-go → revert the branch, stay on T029a

**Checkpoint**: US1 acceptance scenarios 1–4 pass on devnet.

## Phase 4: US2 Repay and withdraw (P1)

- [x] T030 [US2] Tests: repay all → 0 debt no dust; withdraw guarded by LTV; repay by third party
- [x] T031 [US2] `repay` (u64::MAX = all) and `withdraw_collateral`
- [ ] T032 [US2] S4 Repay sheet + withdraw in S8 with max-withdrawable preview

**Checkpoint**: Full P1 loop on devnet; `scripts/smoke-devnet.ts` prints explorer links.

## Phase 5: US3 Protect my position: buffer, alerts, top-up, liquidation (P2)

- [x] T033 [US3] Tests: liquidate healthy fails; $1,000 on 10 NVDAx, crash −30% → liquidatable; liquidate $500 seizes 3.538 NVDAx and ends at 52.2%; second liquidation fails `NotLiquidatable`; close factor; top-up of 3.48 NVDAx returns LTV ≤ 50%
- [x] T034 [US3] `liquidate` instruction
- [ ] T035 [P] [US3] `/api/admin/price` (crash/restore) and `/api/admin/liquidate`, devnet + ADMIN_TOKEN guard
- [ ] T036 [US3] S11 Admin screen (crash −30% on Signed markets, restore, liquidate); health bar red state
- [ ] T056 [P] [US3] `app/src/lib/risk.ts`: `liquidationPrice`, `alertBand`, `fixAmounts` (add collateral tokens / repay USDC to reach max LTV) + unit checks against the demo script numbers in parameters.md §4
- [ ] T057 [US3] S3 Borrow sheet: liquidation price and "−X%" line, suggested max 35% hint
- [ ] T058 [US3] S2 Home alert banners by band with prefilled [Add stock] → S8 deposit and (Repay) → S4; "Turn on alerts" card
- [ ] T059 [P] [US3] Web push: VAPID keys, `web-push`, `/api/push/subscribe` (POST/DELETE, wallet-signed), `/api/push/test`, `push`/`notificationclick` handlers in `public/sw.js`, client subscribe hook
- [ ] T060 [US3] `/api/alerts/check` (CRON_SECRET): read positions + prices, compute bands, dedupe with `alert:{owner}:{market}`, send pushes; call it inline from `/api/admin/price`
- [ ] T061 [US3] Upstash QStash 5-minute schedule for `/api/alerts/check`; verify a push arrives on Android Chrome and desktop Chrome (and note whether the webshell APK receives it)

## Phase 6: US4 Cashback in assets (P2)

- [ ] T037 [US4] `/api/cashback/process`: tier %, price lookup, `deposit_collateral_for` from cashback treasury, idempotent by txId; called after settle
- [ ] T038 [US4] S9 Cashback screen (tier toggle, asset picker); cashback rows in feed and S6 preview
- [ ] T039 [US4] Test: `deposit_collateral_for` rejects non-authority (in T018 suite)

## Phase 6b: US8 Demo Shop (P1 stocks, P2 items) and US7 Savings (P2)

- [ ] T070 [US8] Seed: dUSDC mint, six mirrored item markets from Collector Crypt (parameters.md §3c), TIDE; write `app/src/lib/shop-items.json` (name, grade, image, insured value, source URL)
- [ ] T071 [P] [US8] `/api/shop/items` and `/api/shop/buy` (verify dUSDC transfer, mint token, idempotent) + `ShopOrder` records
- [ ] T072 [US8] S13 Demo Shop screen: tabs Stocks / Cards / Watches / Art, item cards with image + insured value + credit it unlocks, buy sheet, "Lock as collateral" after purchase
- [x] T073 [US7] Program: `deposit_savings`, `withdraw_savings`, `claim_reserve`; reserve and `total_borrowed` accounting in accrue/borrow/repay/liquidate; utilization cap; tests from contracts/program.md
- [ ] T074 [US7] S12 Savings screen: balance, current APY (`utilization × weighted APR × 0.60`), utilization bar, deposit/withdraw sheets, instant-withdrawable amount, founding saver badge
- [ ] T075 [US1] APR bands in the Borrow sheet and Home ("APR 12.9% · drops to 9.9% under 20% LTV"), tier/founding discounts shown as off-chain previews

## Phase 7: US5 Art notes and collectibles (P2)

- [ ] T040 [US5] Seed TIDE (ArtNote, Signed Appraisal) and PSA10 (Collectible, Signed PartnerFmv) markets; test stale appraisal rejection
- [ ] T041 [P] [US5] Asset detail visuals: art canvas (reuse deck generator) and graded-slab render; class chips and price-source labels

## Phase 7b: Partner data adapters (P2, after US1–US4)

- [ ] T055 [P] `app/src/lib/partners/backpack-public.ts`: SPCX asset (mint, withdraw enabled), external ticker, perp mark price, depth; Assets screen shows SPCX "Withdraw from Backpack to use" and price cross-check vs the signer price
- [ ] T050 [P] `app/src/lib/partners/xstocks.ts`: typed client for public assets, price-data, multiplier, system status, proof of reserves (integrations.md); used by Assets screen and admin guard
- [ ] T051 [US3] `/api/admin/guards`: if xStocks halt or reserves < supply → call `update_market` to pause borrowing on that market; show "Trading halted" chip
- [ ] T052 [P] [US5] `app/src/lib/partners/collectorcrypt.ts`: `publicNft/:mint` and `/market` reads; Assets screen lists a wallet's Collector Crypt cards as "Eligible soon" with insured value (read-only in MVP)
- [ ] T053 [P] [US5] `app/src/lib/partners/psa.ts`: cert lookup with 24h cache, only when `PSA_API_TOKEN` is set; show "PSA verified" on the collectible detail screen
- [ ] T054 [US5] Price signer script `scripts/sign-collectible-prices.ts`: insuredValue → `set_signed_price` with PartnerFmv source (devnet uses mock PSA10 mapped to a real Collector Crypt card for display)

## Phase 8: Android + polish + submission (Thu–Fri)

- [ ] T042 PWA: `manifest.webmanifest`, icons, theme color, minimal service worker (app shell + push handlers from T059)
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
- Cut order if late: T048 → T055 → T052–T054 → T041 → T029b → T061 (keep push on admin price change only) → T040 (keep US1–US4). T010 multiplier handling is NOT cuttable for real xStocks; for the demo it's required only if the mock mints use Token-2022.
