# Implementation Plan: StockCard MVP (web + Android)

**Branch**: `001-stockcard-mvp` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-stockcard-mvp/spec.md`

## Summary

One Anchor program on devnet holds collateral and lends USDC with on-chain LTV checks. One Next.js 16 app is both the website and the Android app: it's a PWA that connects wallets with Wallet Standard on desktop and Mobile Wallet Adapter on Android, and it gets packaged as an APK with `solana-mobile webshell`. Next.js route handlers run the card provider (mock by default, Bridge sandbox when keys exist), cashback deposits and the Backpack import.

## Technical Context

**Language/Version**: Rust 1.98 (program), TypeScript 5.x on Node 20 (app, tests, scripts)

**Primary Dependencies**:
- Program: `anchor-lang` 1.2.0, `anchor-spl` 1.2.0, `pyth-solana-receiver-sdk` 2.0.0 (requires anchor-lang ^1.0.2, compatible)
- App: `next` 16, React 19, Tailwind CSS 4, `@anchor-lang/core` 1.2 (the Anchor TS client, renamed from `@coral-xyz/anchor`), `@solana/web3.js` 1.x (what the Anchor client expects), `@solana/wallet-adapter-react` + `@solana-mobile/wallet-standard-mobile` ≥ 0.5.1 (0.6.0 current; needed so MWA detects the webshell), `@pythnetwork/hermes-client` 3.x + `@pythnetwork/pyth-solana-receiver` 0.16, `@tanstack/react-query`
- Card UI reference: `crd-ui` (MIT, zero dependencies, active Aug 2026) for layout and brand detection. Our card component is custom-styled to the StockCard brand.

**Storage**: On-chain state for credit. Off-chain card and transaction records in Vercel KV / Upstash Redis (free tier), falling back to an in-memory map in local dev.

**Testing**: `anchor test` (TypeScript, mocha) against local validator with `Signed` markets. No Pyth dependency in tests. Manual Android runs with Phantom/Solflare on devnet.

**Target Platform**: Desktop Chrome/Safari/Firefox, Android Chrome 120+, Android APK via webshell. Solana devnet.

**Project Type**: Solana program + web app (PWA) doubling as Android app

**Performance Goals**: Home screen interactive in < 2.5s on mid-range Android over 4G; card purchase reflected in feed < 30s

**Constraints**: 360 px minimum width; no secrets in the client; Friday Sept 18 noon ET submission

**Scale/Scope**: Hackathon demo, around 10 screens, 1 program with 12 instructions, < 100 test wallets

## Constitution Check

| Principle | Status | How |
|---|---|---|
| I. Demo-first slices | ✅ | tasks.md is ordered by user story, and US1+US2 ship before any P2 work |
| II. Real assets only | ✅ | `add_market` is admin-only; the seed script creates only equity, art and collectible mock mints |
| III. Safety in program | ✅ | LTV checked in borrow/withdraw/liquidate with staleness; integer bps math; `accrue()` first in every mutating instruction |
| IV. Issuer-agnostic, secrets server-side | ✅ | `CardProvider` interface; card authority keypair and API keys only in route handlers |
| V. One codebase, mobile first | ✅ | PWA + MWA + webshell APK; 360 px checks in the task definition of done |
| VI. Honest demo | ✅ | `MockBadge` component on mock assets, card and prices |

No violations, so no Complexity Tracking entries.

## Architecture

```
┌──────────────────────── Next.js 16 app (Vercel) ───────────────────────────┐
│  PWA shell (manifest, service worker)   ← same build → Android APK         │
│                                           (solana-mobile webshell)         │
│  UI: /  /borrow  /card  /cashback  /portfolio  /import  /admin              │
│   │                                                                        │
│   ├─ WalletProvider: Wallet Standard (desktop) + MWA (Android)             │
│   ├─ lib/program.ts : Anchor client from IDL (signs with user wallet)      │
│   ├─ lib/pyth.ts    : Hermes → post PriceUpdateV2 in same tx (Pyth markets)│
│   └─ lib/risk.ts    : same LTV/interest math as program (preview only)     │
│                                                                            │
│  Route handlers (server only)                                              │
│   /api/card/*      → CardProvider ── MockCardProvider (delegate transfer)  │
│                                   └─ BridgeCardProvider (sandbox)          │
│   /api/cashback    → cashback authority keypair → deposit_collateral_for   │
│   /api/faucet      → mint authority keypair → mock asset mints             │
│   /api/backpack    → ED25519-signed read-only balances (or fixture)        │
│   /api/admin/*     → set_signed_price / crash / restore (devnet only)      │
│   storage: Upstash Redis (cards, txs, cashback queue)                      │
└───────────────┬────────────────────────────────────────────────────────────┘
                │ JSON-RPC (devnet)
┌───────────────▼──────────── Anchor program `stockcard` ────────────────────┐
│ Config PDA ─ USDC vault PDA (pool, seeded by admin)                        │
│ Market PDA (per collateral mint) ─ collateral vault PDA                    │
│   oracle: Pyth PriceUpdateV2 (feed id)  |  SignedPrice PDA (appraisal/FMV) │
│ Position PDA (owner, market)                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

**Card spend path (mock provider, mirrors Bridge's delegate model)**
1. User creates a card → the server records it with last4/expiry.
2. User signs SPL `approve(usdc_ata, delegate = CARD_AUTHORITY, amount = limit)`.
3. Purchase: `/api/card/simulate` → server checks allowance → `transferChecked` from the user's USDC ATA to the merchant settlement ATA, signed by the delegate → the tx is stored.
4. Settled → the cashback job computes tier % → gets the asset price → `deposit_collateral_for(owner)` from the cashback treasury → stores the cashback signature.

**Borrow path (Pyth market)**: one transaction contains a Hermes price update → `postPriceUpdate` → `borrow(amount)` reading `PriceUpdateV2` → close the price update account. Signed markets skip the Pyth part.

## Key risk parameters (devnet defaults)

| Market | Oracle | Max LTV | Liq. threshold | Liq. bonus | Haircut | Max price age |
|---|---|---|---|---|---|---|
| NVDAx, SPYx, TSLAx, SPCX | Pyth (fallback Signed) | 50% | 65% | 5% | 0% open / 10% closed | 60s open / 72h closed |
| TIDE (art note) | Signed (appraisal) | 30% | 45% | 10% | 20% | 100 days |
| PSA10 (graded card item) | Signed (partner FMV) | 40% | 55% | 8% | 25% | 8 days |

APR 8% (800 bps). Close factor 50%.

## Project Structure

### Documentation (this feature)

```text
specs/001-stockcard-mvp/
├── plan.md
├── research.md
├── data-model.md
├── ui.md
├── quickstart.md
├── contracts/
│   ├── program.md
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
Anchor.toml
Cargo.toml                      # workspace
programs/stockcard/
├── Cargo.toml
└── src/
    ├── lib.rs                  # instruction entrypoints
    ├── state.rs                # Config, Market, Position, SignedPrice
    ├── errors.rs
    ├── math.rs                 # accrue, value, ltv (checked, bps)
    ├── oracle.rs               # Pyth / Signed price read + staleness
    └── instructions/
        ├── init_config.rs  add_market.rs  set_signed_price.rs
        ├── deposit.rs  deposit_for.rs  withdraw.rs
        ├── borrow.rs  repay.rs  liquidate.rs
        └── admin.rs            # fund_pool, set_pause, update_market
tests/stockcard.ts              # anchor test (Signed markets)
scripts/
├── seed-devnet.ts              # mints, markets, pool, faucet authority
└── smoke-devnet.ts             # P1 flow with explorer links
app/                            # Next.js 16 PWA
├── public/manifest.webmanifest, icons/
├── src/app/
│   ├── (app)/page.tsx          # home: credit, health, card preview
│   ├── (app)/borrow/  card/  cashback/  portfolio/  import/  admin/
│   └── api/card/  cashback/  faucet/  backpack/  admin/
├── src/components/             # CreditCard, HealthBar, AssetRow, MockBadge, AmountSheet
├── src/lib/                    # program.ts, pyth.ts, risk.ts, card/*.ts, kv.ts, idl/
└── src/styles/tokens.css       # brand tokens from deck (plaster/ink/brass)
android/                        # generated by solana-mobile webshell (Thursday)
```

**Structure Decision**: The Anchor workspace lives at the repo root (matches the existing `programs/`, `tests/`, `scripts/` skeleton). The app is a single Next.js project in `app/` with no shared package: the IDL is copied into `app/src/lib/idl/` by `scripts/sync-idl.sh` after each build. Android is not a second codebase; it's the PWA wrapped by webshell.

## Build schedule

| When | Deliverable | Gate |
|---|---|---|
| **Mon Sept 14 (today)** | Spec kit, toolchain, Anchor workspace + state/math/errors, Next.js scaffold with wallet connect (desktop + MWA), brand tokens, home screen with mock data | `anchor build` passes; app connects Phantom on desktop and Android Chrome |
| **Tue Sept 15** | All instructions + `anchor test` green; devnet deploy; seed script; home/borrow/repay wired to the program | SC-003; US1 borrow and US2 on devnet |
| **Wed Sept 16** | Card: CardProvider, mock provider, delegate approve, purchase feed; cashback; health bar + admin crash/liquidate; Pyth path or Signed fallback decision | US1 end to end, US3, US4 |
| **Thu Sept 17** | Art + collectible markets (US5); PWA manifest; webshell APK on a real Android device; polish; Vercel prod; README; record video | SC-001, SC-002, SC-004, SC-005 |
| **Fri Sept 18** | Buffer, Backpack import only if everything else is done, submit by noon ET | SC-006, submitted |

## Complexity Tracking

None.
