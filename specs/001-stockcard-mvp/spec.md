# Feature Specification: StockCard MVP (web + Android)

**Feature Branch**: `001-stockcard-mvp`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "MVP for the Stocklana hackathon: web app and Android first. Lock real assets (tokenized stocks, art notes, collectibles), borrow USDC, spend with a card that looks like a Visa/Mastercard wallet card, earn cashback in assets."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Borrow against a stock and spend it on the card (Priority: P1) 🎯 MVP

A holder connects a Solana wallet (desktop browser or Android phone), sees their tokenized stock balance, locks some NVDAx, borrows USDC against it and pays for something with their StockCard virtual card. The purchase shows up as a real devnet USDC transfer.

**Why this priority**: This is the product. Without it there is no demo and no submission.

**Independent Test**: With a fresh devnet wallet that claimed test money and bought 10 NVDAx in the Demo Shop: deposit 10 NVDAx → borrow 500 USDC → run a $42 test purchase → the card screen lists the purchase with an explorer link, and available credit drops accordingly.

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

### User Story 3 - Protect my position: buffer, alerts, top-up, liquidation (Priority: P2)

Protection comes in three layers. (1) When borrowing, the app suggests staying at or below 35% LTV and shows how far the price can fall before liquidation. (2) As LTV rises, the app raises in-app banners and sends web push notifications with the exact amount of collateral to add or debt to repay to get back to healthy. (3) If nobody acts, the position becomes liquidatable and a liquidator repays part of the debt in exchange for discounted collateral. In demo mode, an admin "crash price" control drops a signed price by 30%.

**Why this priority**: Shows that risk is handled on-chain and that users get a fair chance to act before liquidation. Judges will ask about it.

**Independent Test**: Borrow $1,000 against 10 NVDAx ($2,119.60) → enable notifications → crash −30% → a push notification and red banner say "Add 3.48 NVDAx or repay $258.14" → tap Add stock, deposit → the bar is green again. Crash again and ignore the alert → run liquidate 50% from the admin panel → the position ends at about 52% LTV, no longer liquidatable (amber).

**Acceptance Scenarios**:

1. **Given** 10 NVDAx at $211.96, **When** the user types $1,000 in the Borrow sheet, **Then** it shows "Liquidation if NVDA falls below $153.85 (−27.4%)" and a note that the suggested maximum is $750.
2. **Given** a $1,000 loan on 10 NVDAx, **When** the price drops 30% to $148.37, **Then** LTV shows 67.4%, the position is flagged liquidatable, the Home banner offers "Add 3.48 NVDAx" and "Repay $258.14", and a subscribed device receives one push notification.
3. **Given** that at-risk position, **When** the user deposits 3.48 NVDAx, **Then** LTV returns to ≤ 50% and the banner clears.
4. **Given** the same at-risk position with no top-up, **When** the admin liquidates 50% of the debt, **Then** debt drops to $500, 3.538 NVDAx is seized (repay × 1.05 / price), LTV ends at 52.2% and a second liquidation is rejected as `NotLiquidatable`.
5. **Given** a healthy position, **When** anyone calls liquidate, **Then** the program rejects it.
6. **Given** a position that stays in the same alert band, **When** the alert check runs again, **Then** no duplicate push is sent; a new push is sent only when the position enters a worse band.

---

### User Story 4 - Cashback that buys assets (Priority: P2)

Each card purchase earns cashback (Standard 0.5%, with a demo toggle for Plus 1% and Black 2%) that buys the user's chosen asset and deposits it straight into their collateral.

**Why this priority**: It's the consumer hook and a clear differentiator, and it's cheap to build once Story 1 exists.

**Independent Test**: Pick NVDAx as the cashback asset → make a $100 purchase at the Plus tier (1.5%, within the credit-linked cap) → collateral increases by $1.50 worth of NVDAx, labeled "Cashback".

**Acceptance Scenarios**:

1. **Given** cashback asset NVDAx and tier Plus (1.5%) and a $1,000 average credit balance, **When** a $100 purchase settles, **Then** $1.50 of NVDAx at the current price is deposited into the user's NVDAx position, and the feed shows "+0.0071 NVDAx cashback" (at $211.96). A purchase beyond 25% of the credit balance that month earns 0.5%.
2. **Given** a failed or declined purchase, **When** it's processed, **Then** no cashback is issued.

---

### User Story 5 - Art notes and Pokémon cards as collateral (Priority: P2)

The user sees Genesis Collection art notes and a vaulted graded Pokémon card (PSA 10, devnet mock) in their portfolio. Each has its own max LTV (art 30%, collectibles 40%) and an admin-signed price (appraisal or FMV) with a haircut.

**Why this priority**: Makes the "real assets, not just stocks" story visible. Uses the same program paths with a different oracle kind.

**Independent Test**: Buy 1,000 TIDE art notes and one graded-card item token in the Demo Shop → deposit both → available credit = TIDE value × 0.8 haircut × 30% + item value × 0.75 haircut × 40%.

**Acceptance Scenarios**:

1. **Given** an art market with an appraisal older than its max age, **When** the user borrows against it, **Then** the program rejects it with a stale-price error.
2. **Given** art and stock positions, **When** the home screen loads, **Then** each asset shows its own LTV, price source ("Market price" / "Switchboard" / "Appraisal" / "Partner value") and a mock label.

---

### User Story 7 - Savings: earn on USDC that funds the loans (Priority: P2)

A user deposits USDC into Savings and earns a variable APY paid from borrowers' interest (target ~6% at 80% utilization). 60% of interest goes to savers, 40% to the protocol reserve. Withdrawals are instant up to idle liquidity.

**Why this priority**: It's the funding source for the lending pool and the protocol's margin (lend at ~10–15%, pay ~6%). Judges and investors will ask where the USDC comes from.

**Independent Test**: Wallet A deposits 10,000 USDC into Savings → wallet B borrows 5,000 against NVDAx → after a simulated year, A's balance has grown by B's interest × 60% × (A's share), and the reserve holds 40%.

**Acceptance Scenarios**:

1. **Given** an empty pool, **When** a user deposits 10,000 USDC, **Then** they receive shares worth 10,000 USDC and the Savings screen shows the current APY and utilization.
2. **Given** 90% utilization, **When** anyone tries to borrow, **Then** the program rejects it (`PoolUtilizationCap`) and the app says "Borrowing is full right now."
3. **Given** a saver whose withdrawal exceeds idle liquidity, **When** they withdraw, **Then** the program rejects it and the app shows the instant-withdrawable amount.
4. **Given** interest accrued on positions, **When** the reserve is checked, **Then** it equals 40% of accrued interest (rounded in the protocol's favor).

---

### User Story 8 - Demo Shop: buy assets with test money, then lock them (Priority: P1 for stocks, P2 for collectibles)

A new user claims test money (dUSDC), opens the Demo Shop and buys tokenized stocks at the live market price or one of six collectibles and watches mirrored from real Collector Crypt listings (image, grade, insured value). The purchase mints a devnet mock token to their wallet, which they can lock as collateral in one tap.

**Why this priority**: Replaces the bare faucet with a story judges understand in seconds: "buy a Rolex, lock it, spend with the card".

**Independent Test**: Claim $100,000 test dUSDC → buy 10 NVDAx at the market price and the "Rolex Daytona" item → both appear in Assets → tap "Lock as collateral" → credit line updates.

**Acceptance Scenarios**:

1. **Given** a new wallet, **When** it claims test money, **Then** it receives 100,000 dUSDC once, and at most 10,000 more per day.
2. **Given** 100,000 dUSDC, **When** the user buys the Lugia PSA 10 item, **Then** its insured value in dUSDC moves to the shop treasury and 1 item token is minted to the wallet within 30 seconds.
3. **Given** an item token in the wallet, **When** the user taps "Lock as collateral", **Then** the deposit sheet opens prefilled and the credit line shows value × 75% (haircut) × 40%.
4. **Given** the shop, **When** it renders, **Then** every item shows "Demo shop · test money" and "Mirrored from a real Collector Crypt listing. Not affiliated. You don't own the real item."

---

### User Story 9 - Send to my bank: borrow to an IBAN via SEPA (Priority: P2)

A user who needs euros for a big purchase (a car, a house deposit, a tax bill) borrows against their stocks or collectibles and sends the money straight to their own bank account by SEPA, instead of selling. One signature borrows the USDC and sends it to the payout provider, which converts it to EUR and pays the IBAN. In the MVP the payout is simulated: real devnet USDC moves to a payout address and the SEPA leg is mocked with the same interface a real provider (Bridge liquidation address) will use.

**Why this priority**: It turns the credit line into money people can use anywhere, which is the core "borrow, don't sell" promise (docs/borrow-vs-sell.md). It is P2 because the card path already proves spending; the bank path is the bigger real-world use case for pitching.

**Independent Test**: With 10 NVDAx locked and no debt → Home → "Send to bank" → add IBAN `NL91ABNA0417164300` for the connected name → enter €500 → preview shows USDC amount, rate, fee, you receive, new LTV and liquidation price → Confirm and sign → one transaction borrows and transfers → payout row shows Processing, then "Arrived (simulated)" with a SEPA reference.

**Acceptance Scenarios**:

1. **Given** an invalid IBAN (checksum fails), **When** the user adds it, **Then** the form shows "Check the IBAN: the check digits don't match." and nothing is saved.
2. **Given** a borrow-to-bank amount that would exceed max LTV, **When** the preview renders, **Then** Confirm is disabled with the same message as the Borrow sheet.
3. **Given** a valid request, **When** the user signs, **Then** one transaction contains `borrow` and a USDC `transferChecked` to the payout address, and it either fully succeeds or fully fails.
4. **Given** the payout transfer is confirmed, **When** the server verifies it on-chain (amount, mint, destination, signer), **Then** it creates a Payout record and advances Processing → Arrived within 15 s in mock mode; the row links to the explorer and shows "Simulated SEPA payout".
5. **Given** the user chooses "From card balance" instead of Borrow, **When** they send, **Then** only the transfer is signed and debt is unchanged.

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

- Equity market closed: the stock price is older than normal max-age → use the market-hours max-age with a wider haircut; if still stale, block borrow/withdraw and show "Price updates when markets reopen".
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
- **FR-003**: The app MUST provide test money (dUSDC claim, rate-limited per wallet) and a Demo Shop where users buy mock stock tokens and mirrored collectible/watch item tokens with it (US8).

**Credit line (program)**
- **FR-010**: The program MUST support markets per collateral mint with `max_ltv_bps`, `liq_threshold_bps`, `liq_bonus_bps`, `haircut_bps` and an oracle kind (`Signed` or `Switchboard`).
- **FR-011**: Users MUST be able to deposit and withdraw collateral; withdrawals MUST keep LTV ≤ max LTV.
- **FR-012**: Users MUST be able to borrow USDC to a destination token account up to max LTV, using a non-stale price.
- **FR-013**: Interest MUST accrue linearly at the position's current APR and be applied before every state change. The APR comes from the market's LTV bands (parameters.md §3b: stocks 9.9% / 12.9% / 14.9%) and is re-selected after each state change. No utilization-based rate curves.
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
- **FR-040**: The home screen MUST show collateral value, debt, available credit, current LTV and a health bar (green ≤ 50%, amber ≤ 65%, red > 65%).
- **FR-041**: A demo admin panel MUST allow crashing (−30%) or restoring a signed market price and running a liquidation.
- **FR-042**: The Borrow sheet MUST show the liquidation price and the % drop to reach it, and flag amounts above the suggested maximum LTV (35%) without blocking them.
- **FR-043**: The app MUST show alert banners by band (parameters.md §4) with one-tap "Add collateral" and "Repay" actions prefilled with the exact amount needed to return to max LTV.
- **FR-044**: Users MUST be able to opt in to web push notifications from a device. The server MUST evaluate positions after every admin price change and on a schedule, and send at most one push per position per band entered.
- **FR-045**: Push subscriptions MUST be tied to a wallet signature and removable by the user. Notifications MUST NOT include amounts of other users' positions or any secret.

**Savings**
- **FR-060**: Users MUST be able to deposit and withdraw USDC in Savings for pool shares; share value MUST grow with interest paid by borrowers.
- **FR-061**: 40% of accrued interest MUST go to the protocol reserve; the admin MAY withdraw only the reserve.
- **FR-062**: The program MUST block new borrows above 90% utilization and withdrawals above idle liquidity.

**Demo Shop**
- **FR-070**: The app MUST list buyable devnet assets: stock tokens at the market price and mirrored collectible/watch items with Collector Crypt image, grade and insured value.
- **FR-071**: A purchase MUST transfer dUSDC from the user to the shop treasury and mint the matching mock token; items MUST be labeled as demo mirrors, not real ownership.

**Send to bank (SEPA)**
- **FR-080**: Users MUST be able to save up to 3 EUR bank accounts (IBAN, account holder name, optional BIC). IBANs are validated with the ISO 13616 mod-97 checksum and a SEPA country list before saving; only the last 4 digits are shown after saving.
- **FR-081**: A payout MUST be one wallet-signed transaction: optional `borrow` to the user's USDC account plus `transferChecked` of the same USDC amount to the payout address returned by the active PayoutProvider (mock: `PAYOUT_ADDRESS`; Bridge: the customer's liquidation address for that bank account).
- **FR-082**: Before signing, the preview MUST show: EUR amount, USDC sent, exchange rate and its time, provider fee, StockCard fee, "You receive", rail and expected arrival, and when borrowing the new LTV, APR band and liquidation price.
- **FR-083**: The server MUST verify the transfer on-chain before recording a Payout, be idempotent by signature, and label every mock payout "Simulated SEPA payout". No real bank data leaves the server in mock mode; IBANs are stored encrypted or only as provider references.
- **FR-084**: Payouts above €10,000 MUST ask for a purpose (Car, Home, Tax, Other) and show "Large transfers may require extra checks by your bank and our payout partner." (AML placeholder; real limits come from the provider.)

**Import**
- **FR-050**: Users MAY import Backpack holdings. The ED25519 secret stays in the browser; the client signs a `balanceQuery` request and the server proxies `GET /api/v1/capital` with those headers (CORS workaround). Nothing is stored or logged. Fallback: demo fixture.

### Key Entities

- **Config**: Global settings. Admin, USDC mint, USDC vault, APR, cashback authority, pause flag.
- **Market**: One collateral asset. Mint, oracle kind, price source, risk parameters, collateral vault, total deposits.
- **Position**: One user in one market. Collateral amount, debt principal, accrued interest index/timestamp.
- **SignedPrice**: Admin/appraiser-posted price for a market. Price, exponent, publish time.
- **Card** *(off-chain)*: Card id, owner wallet, last 4, network, provider, status, delegate allowance.
- **CardTransaction** *(off-chain)*: Merchant, amount, status, settlement signature, cashback amount and signature.
- **BankAccount** *(off-chain)*: Owner, holder name, IBAN (encrypted) + last 4, country, BIC, provider external account id.
- **Payout** *(off-chain)*: Owner, bank account, EUR and USDC amounts, rate, fees, borrow flag, transfer signature, provider transfer id, SEPA reference, status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user completes connect → faucet → deposit → borrow → card purchase in under 3 minutes on desktop and on Android.
- **SC-002**: All P1 acceptance scenarios pass on devnet on Thursday, Sept 17.
- **SC-003**: `anchor test` covers over-LTV borrow rejection, stale-price rejection, full repay with zero dust, withdraw LTV guard, and liquidation success/failure.
- **SC-004**: Every screen renders without horizontal scroll at 360 px wide and passes a manual run on one real Android device.
- **SC-005**: The public Vercel URL loads the app with no console errors; the APK installs and connects a wallet via MWA.
- **SC-006**: A 2–3 minute demo video shows Stories 1–4 in one take.

## Assumptions

- Devnet only. Collateral assets are mock mints bought in the Demo Shop with test dUSDC: NVDAx, SPYx, TSLAx, SPCX, TIDE art notes, and six item tokens mirrored from Collector Crypt listings (3 graded cards, 3 watches).
- USDC: the program is mint-agnostic. The demo uses a mock 6-decimal **dUSDC** mint so test money, the Demo Shop, Savings and the pool can all be funded freely. Circle devnet USDC stays an option for the Bridge sandbox path.
- Bridge sandbox access may not arrive before Friday, so the mock card provider is the default path.
- Stock prices come from a price signer that posts free public prices (xStocks + Jupiter; Backpack + Jupiter for SPCX) as `Signed` prices with source `Market` when both agree within 2%. TIDE uses "Appraisal", the PSA10 Pokémon card "Partner value". NVDAx always stays Signed so the admin crash can override it (source `Demo`). A time-boxed Switchboard spike on Wed Sept 16 (go/no-go 12:00 ET) may move SPYx and TSLAx to `Switchboard` feeds. Pyth Pro equity access (~$2,500/month) and Chainlink Data Streams (from $150/month per feed) are the production path, not the MVP.
- Web push works in Chrome on Android and desktop. Delivery inside the webshell APK must be verified on a device; if it doesn't work there, the demo uses Android Chrome for the notification moment.
- Card network logos (Visa/Mastercard) are trademarks and appear only as text placeholders until an issuer approves brand use.
- No real KYC, no mainnet, no real artworks or partner integrations.
