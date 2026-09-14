# Feature Specification: StockCard MVP (web + Android)

**Feature Branch**: `001-stockcard-mvp`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "MVP for the Stocklana hackathon: web app and Android first. Lock real assets (tokenized stocks, art notes, collectibles), borrow USDC, spend with a card that looks like a Visa/Mastercard wallet card, earn cashback in assets."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Borrow against a stock and spend it on the card (Priority: P1) 🎯 MVP

A holder connects a Solana wallet (desktop browser or Android phone), sees their tokenized stock balance, locks some NVDAx, borrows USDC against it and pays for something with their StockCard virtual card. The purchase shows up as a real devnet USDC transfer.

**Why this priority**: This is the product. Without it there is no demo and no submission.

**Independent Test**: With a fresh devnet wallet funded from the in-app faucet: deposit 10 NVDAx → borrow 500 USDC → run a $42 test purchase → the card screen lists the purchase with an explorer link, and available credit drops accordingly.

**Acceptance Scenarios**:

1. **Given** a connected wallet with NVDAx, **When** the user deposits 10 NVDAx, **Then** the home screen shows the collateral value and available credit (collateral value × 50% max LTV).
2. **Given** available credit of $890, **When** the user borrows $900, **Then** the program rejects it and the app explains the limit before signing.
3. **Given** $500 borrowed to the card wallet, **When** a $42 test purchase is simulated, **Then** $42 USDC moves to the merchant settlement address and the transaction appears in the card feed within 30 seconds.
4. **Given** an Android phone with Phantom or Solflare, **When** the user opens the app in Chrome or the APK, **Then** Connect uses Mobile Wallet Adapter and every step above works.

---

### User Story 2 - Repay and withdraw (Priority: P1)

The user repays part or all of the debt, including interest, and withdraws their stock.

**Why this priority**: "Repay whenever you want, then take your stock back" is half of the pitch, and it's required for the flow to be credible.

**Independent Test**: After Story 1: repay the full debt → debt shows $0.00 → withdraw all NVDAx → wallet balance is back to the starting amount.

**Acceptance Scenarios**:

1. **Given** debt of $500 plus accrued interest, **When** the user taps "Repay all", **Then** debt becomes 0 and no dust remains.
2. **Given** outstanding debt, **When** the user tries to withdraw collateral that would push LTV above the max, **Then** the program rejects it and the app shows the maximum withdrawable amount.

---

### User Story 3 - Health bar, price crash and liquidation (Priority: P2)

The user sees a health bar. In demo mode, an admin "crash price" control drops NVDA by 40%. The position turns unhealthy, and a liquidator repays part of the debt in exchange for discounted collateral.

**Why this priority**: Shows that risk is handled on-chain. Judges will ask about it.

**Independent Test**: Borrow close to max → crash price → the health bar turns red → run liquidate from the admin panel → debt and collateral both shrink and the position is healthy again.

**Acceptance Scenarios**:

1. **Given** a position at 48% LTV, **When** the price drops 40%, **Then** LTV shows 80% and the position is flagged liquidatable (above the 65% liquidation threshold).
2. **Given** a healthy position, **When** anyone calls liquidate, **Then** the program rejects it.

---

### User Story 4 - Cashback that buys assets (Priority: P2)

Each card purchase earns cashback (Standard 0.5%, with a demo toggle for Plus 1% and Black 2%) that buys the user's chosen asset and deposits it straight into their collateral.

**Why this priority**: It's the consumer hook and a clear differentiator, and it's cheap to build once Story 1 exists.

**Independent Test**: Pick NVDAx as the cashback asset → make a $100 purchase at the 1% tier → collateral increases by $1.00 worth of NVDAx, labeled "Cashback".

**Acceptance Scenarios**:

1. **Given** cashback asset NVDAx and tier Plus, **When** a $100 purchase settles, **Then** $1.00 of NVDAx at the current price is deposited into the user's NVDAx position, and the feed shows "+0.0056 NVDAx cashback".
2. **Given** a failed or declined purchase, **When** it's processed, **Then** no cashback is issued.

---

### User Story 5 - Art notes and collectibles as collateral (Priority: P2)

The user sees Genesis Collection art notes and a vaulted graded card in their portfolio. Each has its own max LTV (art 30%, collectibles 40%) and an admin-signed price (appraisal or FMV) with a haircut.

**Why this priority**: Makes the "real assets, not just stocks" story visible. Uses the same program paths with a different oracle kind.

**Independent Test**: Faucet 1,000 TIDE art notes and 1 PSA10 item token → deposit both → available credit = TIDE value × 0.8 haircut × 30% + item FMV × 0.75 haircut × 40%.

**Acceptance Scenarios**:

1. **Given** an art market with an appraisal older than its max age, **When** the user borrows against it, **Then** the program rejects it with a stale-price error.
2. **Given** art and stock positions, **When** the home screen loads, **Then** each asset shows its own LTV, price source ("Pyth" / "Appraisal" / "Partner FMV") and a mock label.

---

### User Story 6 - Import from Backpack (Priority: P3)

The user enters a Backpack API key and sees which holdings are eligible (SPCX) and which aren't (broker-held stocks). The API secret never leaves the user's device: the browser signs only a `balanceQuery` request, and our server just forwards it.

**Why this priority**: Nice for the pitch, not needed for the core flow. Cut first if time runs out.

**Independent Test**: In demo-fixture mode, the import screen lists 3 holdings with Eligible / Not on-chain badges.

**Acceptance Scenarios**:

1. **Given** invalid keys, **When** importing, **Then** a clear error shows and keys are never stored.
2. **Given** valid keys, **When** importing, **Then** the server receives only the API key, timestamp, window and a signature over `instruction=balanceQuery&timestamp=…&window=…`, which can't authorize any other instruction (e.g. `withdraw`).
3. **Given** Backpack symbols like `SPCX.US` and `MU.US`, **When** results render, **Then** SPCX is Eligible (on-chain SPL) and broker-held stocks show "Not on-chain".

---

### Edge Cases

- Equity market closed: the Pyth price is older than normal max-age → use the market-hours max-age with a wider haircut; if still stale, block borrow/withdraw and show "Price updates when markets reopen".
- Borrowed USDC exceeds pool liquidity → the program rejects with an insufficient-liquidity error; the app shows pool availability.
- Card delegate allowance lower than purchase → decline the purchase and prompt "Top up card limit".
- Wallet on the wrong cluster (mainnet) → banner plus network switch instructions.
- MWA session drops mid-transaction on Android → the retry flow re-requests authorization without losing form state.
- Repay "all" while interest keeps accruing → the program caps repayment at the actual debt; overpayment isn't taken.
- Cashback price unavailable → queue the cashback and retry, don't fail the purchase.
- Token issuer pauses transfers, freezes the vault or claws back tokens (xStocks and SPCX mints have these powers) → the market is blocked for new borrows, the UI shows "Issuer paused transfers" or "Collateral under review", and repayments still work.

## Requirements *(mandatory)*

### Functional Requirements

**Wallet & portfolio**
- **FR-001**: Users MUST be able to connect a Solana wallet with Wallet Standard on desktop and Mobile Wallet Adapter on Android.
- **FR-002**: The app MUST show wallet balances for all supported collateral assets and USDC, with price, source and mock label.
- **FR-003**: The app MUST provide a devnet faucet for mock collateral assets (rate-limited per wallet).

**Credit line (program)**
- **FR-010**: The program MUST support markets per collateral mint with `max_ltv_bps`, `liq_threshold_bps`, `liq_bonus_bps`, `haircut_bps` and an oracle kind (`Pyth` or `Signed`).
- **FR-011**: Users MUST be able to deposit and withdraw collateral; withdrawals MUST keep LTV ≤ max LTV.
- **FR-012**: Users MUST be able to borrow USDC to a destination token account up to max LTV, using a non-stale price.
- **FR-013**: Interest MUST accrue linearly at the config APR (default 8%) and be applied before every state change.
- **FR-014**: Users MUST be able to repay partially or fully; repayment MUST be capped at outstanding debt.
- **FR-015**: Anyone MUST be able to liquidate a position whose LTV exceeds the liquidation threshold, repaying up to 50% of the debt and receiving collateral worth repaid × (1 + bonus).
- **FR-016**: An authorized depositor (cashback authority) MUST be able to deposit collateral into a user's position without the user signing.
- **FR-017**: The admin MUST be able to set signed prices for `Signed` markets and, on devnet only, override prices for the crash demo.

**Card**
- **FR-020**: Users MUST be able to create a virtual card tied to their wallet and set a card spend limit by approving a USDC delegate.
- **FR-021**: The card screen MUST render a Visa/Mastercard-style card (number masked to last 4, expiry, holder, network placeholder) and a transaction feed.
- **FR-022**: Users MUST be able to simulate a purchase (merchant, amount); the provider settles it as a real devnet USDC transfer using the delegate.
- **FR-023**: The card layer MUST work through a `CardProvider` interface with `MockCardProvider` (default) and `BridgeCardProvider` (when sandbox keys exist).

**Cashback**
- **FR-030**: Users MUST be able to pick a cashback asset and see their tier.
- **FR-031**: On each settled purchase, the system MUST deposit tier % × amount of the chosen asset into the user's position via FR-016.

**Risk UX**
- **FR-040**: The home screen MUST show collateral value, debt, available credit, current LTV and a health bar (green < 50%, amber ≤ 65%, red > 65%).
- **FR-041**: A demo admin panel MUST allow crashing or restoring a market price and running a liquidation.

**Import**
- **FR-050**: Users MAY import Backpack holdings. The ED25519 secret stays in the browser; the client signs a `balanceQuery` request and the server proxies `GET /api/v1/capital` with those headers (CORS workaround). Nothing is stored or logged. Fallback: demo fixture.

### Key Entities

- **Config**: Global settings. Admin, USDC mint, USDC vault, APR, cashback authority, pause flag.
- **Market**: One collateral asset. Mint, oracle kind, price source, risk parameters, collateral vault, total deposits.
- **Position**: One user in one market. Collateral amount, debt principal, accrued interest index/timestamp.
- **SignedPrice**: Admin/appraiser-posted price for a market. Price, exponent, publish time.
- **Card** *(off-chain)*: Card id, owner wallet, last 4, network, provider, status, delegate allowance.
- **CardTransaction** *(off-chain)*: Merchant, amount, status, settlement signature, cashback amount and signature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user completes connect → faucet → deposit → borrow → card purchase in under 3 minutes on desktop and on Android.
- **SC-002**: All P1 acceptance scenarios pass on devnet on Thursday, Sept 17.
- **SC-003**: `anchor test` covers over-LTV borrow rejection, stale-price rejection, full repay with zero dust, withdraw LTV guard, and liquidation success/failure.
- **SC-004**: Every screen renders without horizontal scroll at 360 px wide and passes a manual run on one real Android device.
- **SC-005**: The public Vercel URL loads the app with no console errors; the APK installs and connects a wallet via MWA.
- **SC-006**: A 2–3 minute demo video shows Stories 1–4 in one take.

## Assumptions

- Devnet only. Collateral assets are mock SPL mints (NVDAx, SPYx, TSLAx, SPCX, TIDE art notes, PSA10 item tokens), created and faucetable by the admin.
- USDC: the program is mint-agnostic. Devnet uses Circle's devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) if faucet liquidity is enough for the pool; otherwise a mock 6-decimal USDC mint, switchable by env.
- Bridge sandbox access may not arrive before Friday, so the mock card provider is the default path.
- Pyth equity feeds need a price update posted in the same transaction via Hermes. If that isn't reliable on devnet by Tuesday night, NVDAx falls back to a `Signed` market labeled "Demo price".
- Card network logos (Visa/Mastercard) are trademarks and appear only as text placeholders until an issuer approves brand use.
- No real KYC, no mainnet, no real artworks or partner integrations.
