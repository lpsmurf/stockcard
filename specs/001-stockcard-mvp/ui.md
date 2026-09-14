# UI spec: StockCard MVP

Calm consumer fintech, not a DeFi dashboard. It uses the same identity as the pitch deck, so the demo and the deck look like one product.

## Tokens (from the deck)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--plaster` | #E9ECE8 | #0E1311 | App ground |
| `--surface` | #F4F6F3 | #131916 | Sheets, lists |
| `--ink` / `--ink-2` / `--ink-3` | #141C19 / #48524D / #7A847F | #E6EBE7 / #AEB8B2 / #7F8984 | Text |
| `--brass` | #8E6A22 | #D1AE63 | The one accent: primary action, cashback |
| `--good` / `--warn` / `--bad` | #2F6B4F / #9A6B12 / #A33A2C | #7CC39D / #E0B25A / #E07A6A | Health states only |

Type: **Bodoni Moda** for big numbers and the card wordmark, **Hanken Grotesk** for UI text, **IBM Plex Mono** for amounts, addresses and card number. Loaded with `next/font/google`.

## Navigation

Bottom tab bar on mobile (≤ 768 px), left rail on desktop: **Home · Card · Assets · Cashback**. Admin lives at `/admin` (devnet only, not in the nav).

## Screens

| # | Screen | Route | Content | Primary action |
|---|---|---|---|---|
| S1 | Welcome / connect | `/` (disconnected) | One-line thesis, card render, "Connect wallet" (MWA on Android) | Connect |
| S2 | Home | `/` | Card on top (tap → Card); **available credit** (Bodoni, big); health bar with LTV %; debt and APR row; last 3 card transactions; "Borrow to card" / "Repay" buttons | Borrow to card |
| S3 | Borrow sheet | `/borrow` (bottom sheet on mobile) | Amount input with max; preview: new LTV, health color, daily interest; destination = card wallet | Confirm & sign |
| S4 | Repay sheet | `/borrow?mode=repay` | Amount or "Repay all"; debt incl. interest | Confirm & sign |
| S5 | Card | `/card` | Card stack (front shows masked number, holder, expiry, network placeholder; tap flips to CVV "•••"); card limit (delegate allowance) with "Change limit"; freeze toggle; transaction feed with status and explorer link; "Test purchase" button (demo) | Test purchase |
| S6 | Test purchase sheet | `/card?simulate=1` | Merchant presets (Coffee $4.80, Groceries $62.15, Flight $389.00) or custom; shows cashback preview "+$0.62 in NVDAx" | Pay |
| S7 | Assets | `/portfolio` | Rows per asset: icon, name, class chip (Equity / Art note / Collectible), wallet balance, locked, price + source ("Pyth" / "Appraisal" / "Partner FMV" / "Demo"), max LTV, MockBadge; Deposit / Withdraw; Faucet link | Deposit |
| S8 | Asset detail + deposit/withdraw sheet | `/portfolio/[mint]` | For art: artwork canvas, Lot, compartment label; for collectible: slab render; amount input; credit impact preview | Confirm & sign |
| S9 | Cashback | `/cashback` | Tier cards (Standard 0.5 / Plus 1 / Black 2, demo toggle); pick asset (NVDAx, SPYx, TIDE art note, card pack credit); lifetime cashback in assets | Save |
| S10 | Import from Backpack | `/import` | Key fields (read-only warning), "Use demo data"; results list with Eligible / Not on-chain badges | Import |
| S11 | Admin (devnet) | `/admin` | Market list with price, "Crash −40%", "Restore"; positions over threshold; "Liquidate 50%" | Crash price |

## Components
- `CreditCard`: 1.586:1, gunmetal gradient, brass chip, "StockCard" in Bodoni, number `•••• 4021` in Plex Mono, network placeholder text, subtle tilt on hover (disabled with reduced motion). Masking and brand-detection approach adapted from crd-ui (MIT).
- `HealthBar`: segmented 0–100% with max LTV and liquidation markers; color by state plus a text label (never color alone).
- `AmountSheet`: numeric keypad-friendly input, MAX chip, live preview rows, sticky confirm button above the Android nav bar (`env(safe-area-inset-bottom)`).
- `AssetRow`, `TxRow`, `MockBadge` ("Devnet mock"), `ExplorerLink`.
- Toasts: "Borrowed $500.00 to your card", "Payment declined: card limit $20.00, raise it in Card".

## States
Every data view has loading (skeleton), empty ("No purchases yet: try a test purchase"), error (message plus retry) and wrong-network states.

## Accessibility & mobile
- 44 px minimum touch targets, visible focus rings, `prefers-reduced-motion`.
- No horizontal scroll at 360 px; the card scales to width.
- `inputmode="decimal"` for amounts.
