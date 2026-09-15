# Wireframes: StockCard MVP

Mobile first (360 px). Desktop keeps the same content and actions; layouts are in **Desktop** at the end of this file. Copy shown is final unless marked `{variable}`. Visual tokens: see ui.md and parameters.md §6.

Legend: `[ Button ]` primary (brass) · `( Button )` secondary (outline) · `‹chip›` · `▓▓░░` bar · `···` list continues.

## Flow

```
S1 Welcome ──connect──▶ S2 Home ──Borrow to card──▶ S3 Borrow sheet ──sign──▶ S2 (toast)
                           │                                      
                           ├──Card──▶ S5 Card ──Test purchase──▶ S6 Purchase sheet ──Pay──▶ S5 (feed + cashback row)
                           ├──Assets──▶ S7 Assets ──row──▶ S8 Asset detail ──Deposit/Withdraw──▶ sign ──▶ S7
                           ├──Cashback──▶ S9 Cashback (tier + asset)
                           ├──Send to bank──▶ S14 ──sign──▶ S2 (payout row)
                           └──Repay──▶ S4 Repay sheet ──sign──▶ S2
S7 ──Import from Backpack──▶ S10 Import
/admin (devnet only) S11 ──Crash price / Liquidate──▶ S2 shows "At risk"
```

## S1 Welcome (disconnected `/`)

```
┌────────────────────────────────┐
│ StockCard                      │  header: wordmark (Bodoni)
├────────────────────────────────┤
│ REAL ASSETS ONLY · NO MEMECOINS│  eyebrow, mono, brass
│                                │
│ Spend what you own.            │  Bodoni 40px
│ Never sell it.                 │  italic, brass
│                                │
│ ╭────────────────────────────╮ │
│ │ StockCard          VIRTUAL │ │  CreditCard (demo values)
│ │ ▭  •••• •••• •••• 4021     │ │
│ │ AVAILABLE CREDIT           │ │
│ │ $18,420.00          VISA   │ │
│ ╰────────────────────────────╯ │
│                                │
│ Lock stocks, art or graded     │  body, ink-2
│ cards. Get a USDC credit line. │
│ Pay anywhere cards work.       │
│                                │
│ [      Connect wallet       ]  │  opens wallet modal / MWA on Android
│ Solana devnet · test assets    │  caption + MockBadge
└────────────────────────────────┘
```

## S2 Home (`/`)

```
┌────────────────────────────────┐
│ StockCard            7xKp…9aQe │
├────────────────────────────────┤
│ ╭────────────────────────────╮ │  tap → /card
│ │ StockCard   ▭ •••• 4021    │ │
│ │ AVAILABLE  $390.00   VISA  │ │
│ ╰────────────────────────────╯ │
│                                │
│ AVAILABLE CREDIT               │  caption
│ $559.80                        │  Bodoni 44px, tabular
│ of $1,059.80 credit line       │  ink-3
│                                │
│ Healthy           LTV 23.6%    │  HealthBar
│ ▓▓▓▓░░░░░░░░|░░░░|░░░░░░░░░    │  markers: max 50% · liq 65%
│             max 50%  liq 65%   │
│                                │
│ ┌──────────────┬─────────────┐ │
│ │ Debt         │ APR         │ │
│ │ $500.00      │ 9.9%        │ │
│ │ +$0.14/day   │ by LTV      │ │
│ └──────────────┴─────────────┘ │
│                                │
│ [ Borrow to card ] ( Repay )   │  two equal buttons
│ ( Send to bank )               │  → S14, full width secondary
│                                │
│ TOTAL BALANCE        $6,689.00 │  BalanceSummary (parameters.md "Home balances")
│ Locked      $2,119.60  ▓▓▓░░░░ │  stacked bar: locked · wallet · card
│ In wallet   $4,179.40          │
│ Card        $390.00            │
│ Debt is 7.5% of everything     │  ink-3, never colored
│ you hold                  ›    │  → wallet token list
│                                │
│ Recent card activity  See all ›│
│ ○ Albert Heijn      −$62.15    │  TxRow: merchant, amount
│   Settled · +0.0044 NVDAx      │  cashback line in brass
│ ○ Blue Bottle        −$4.80    │
│   Settled · +0.0003 NVDAx      │
├────────────────────────────────┤
│ Home   Card   Assets  Cashback │  bottom tabs
└────────────────────────────────┘

States
- No collateral: replace credit block with "Add an asset to open your credit line" + [ Add assets ] → /portfolio
- Watch (max < LTV ≤ 55%): ink-2 note under the health bar "You can't borrow more until LTV is under 50%."
- Warning (55% < LTV ≤ 60%): amber banner "NVDA dropped. Add {add} NVDAx or repay {repay} to stay safe." [ Add stock ] ( Repay )
- Urgent (60% < LTV ≤ 65%): red banner "You're close to liquidation." same actions, exact amounts
- At risk (LTV > 65%): red banner at top "Your position can be liquidated. Add 3.48 NVDAx or repay $258.14." [ Add stock ] ( Repay )
- Buttons open S8 deposit / S4 repay prefilled with the amount that brings LTV back to 50%. On devnet, "Add stock" offers "Get test assets" when the wallet balance is too low.
- Alerts off: dismissible card under activity "Get an alert before liquidation" [ Turn on alerts ] → browser permission → toast "Alerts are on for this device"
- Loading: skeleton blocks at same sizes
- Wrong network: amber banner "Switch your wallet to Devnet"
- Wallet token list (tap "›" under the balance): rows Symbol · amount · value · ‹Eligible› or ‹No price›; eligible rows have ( Lock ) → S8 deposit
- LTV under the health bar is always the position LTV (debt ÷ locked collateral). "Debt is x% of everything you hold" is information only
Desktop: see D2.
```

## S3 Borrow sheet (`/borrow`, bottom sheet)

```
┌────────────────────────────────┐
│ ─────                          │  drag handle
│ Borrow to your card        ✕   │
│                                │
│ $ 500.00              ‹MAX›    │  amount input, inputmode=decimal
│ Up to $890.00                  │
│                                │
│ From      NVDAx position  ▾    │  select position (auto: most headroom)
│ To        Card wallet 7xKp…9aQe│
│ ────────────────────────────── │
│ New LTV            18% → 54% ! │  turns warn if > max (blocks confirm)
│ Liquidation if NVDA < {liqPx}  │  mono; "(−{drop}%)" in ink-3
│ Suggested max {sugMax} (35%)   │  ink-3 hint; amber text above it, never blocks
│ APR / interest  {apr} · {int}/d│
│ Health after       Healthy     │
│                                │
│ [     Confirm and sign      ]  │  sticky above safe-area
└────────────────────────────────┘
Example at $1,000 on 10 NVDAx: "Liquidation if NVDA < $153.85 (−27.4%)", suggested max $750.
Error inline under input: "That's more than your credit line. You can borrow up to $890.00."
Success toast: "Borrowed $500.00 to your card" + explorer link.
```

## S4 Repay sheet (`/borrow?mode=repay`)

```
┌────────────────────────────────┐
│ Repay                      ✕   │
│ $ 120.00       ‹Repay all›     │
│ Debt $500.11 incl. interest    │
│ From  Card wallet · $438.00    │
│ Debt after          $380.11    │
│ LTV after           54% → 41%  │
│ [     Confirm and sign      ]  │
└────────────────────────────────┘
"Repay all" sends u64::MAX (program caps at debt).
```

## S5 Card (`/card`)

```
┌────────────────────────────────┐
│ Card                           │
│ ╭────────────────────────────╮ │  tap → flip: CVV •••, "Details hidden in sandbox"
│ │ StockCard          VIRTUAL │ │
│ │ ▭  •••• •••• •••• 4021     │ │
│ │ AVAILABLE CREDIT           │ │
│ │ $438.00   LUIS P · 09/29   │ │
│ │                  VISA      │ │
│ │                  sandbox   │ │
│ ╰────────────────────────────╯ │
│ ‹MockBadge: Sandbox card›      │
│                                │
│ Card limit       $500.00  Edit›│  → sheet: amount + [ Approve limit ] (SPL approve)
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░ $438 left      │
│ Freeze card              ( ◯ ) │  toggle
│ Send card balance to bank    › │  → S14 with source = Card balance
│                                │
│ [       Test purchase       ]  │  → S6
│                                │
│ Activity                       │
│ ○ Albert Heijn       −$62.15   │
│   Groceries · Settled · 14:02 ↗│  ↗ explorer
│   +0.0044 NVDAx cashback       │
│ ○ KLM               −$389.00   │
│   Declined · Card limit $500   │  bad color
│ ···                            │
└────────────────────────────────┘
No card yet → "Get your virtual card" block: name field (prefilled), network ‹VISA›‹Mastercard›, [ Create card ].
```

## S6 Test purchase sheet (`/card?simulate=1`)

```
┌────────────────────────────────┐
│ Test purchase              ✕   │
│ Simulates a card payment on    │
│ devnet. Real USDC moves.       │
│                                │
│ ‹Coffee $4.80› ‹Groceries      │  preset chips
│ $62.15› ‹Flight $389.00›       │
│ Merchant  [ Albert Heijn     ] │
│ Amount    $ 62.15              │
│ ────────────────────────────── │
│ Cashback   +$0.93 in NVDAx     │  brass; tier label "Plus 1.5%"
│ Card limit left   $437.85      │
│ [            Pay            ]  │
└────────────────────────────────┘
Result: sheet closes; feed row appears as Pending → Settled (poll 5 s); toast "Paid $62.15 · +0.0044 NVDAx".
```

## S7 Assets (`/portfolio`)

```
┌────────────────────────────────┐
│ Assets                         │
│ Locked $2,780.00 · Wallet $4,1…│
│                                │
│ ‹All› ‹Stocks› ‹Art› ‹Collect.›│  filter chips
│                                │
│ NVDAx                ‹Equity›  │  AssetRow
│ NVIDIA · $211.96 · Market price│
│ Locked 10.00 · Wallet 15.00    │
│ Max LTV 50%      ( Deposit )   ›│
│ ────────────────────────────── │
│ TIDE              ‹Art note›   │
│ Tidewater Lot 01 · $10.00      │
│ Appraisal · −20% haircut       │
│ Locked 0 · Wallet 1,000        │
│ Max LTV 30%  ‹Devnet mock›    ›│
│ ────────────────────────────── │
│ PSA10 Pokémon  ‹Collectible›   │
│ PSA 10 card · $4,800 FMV       │
│ Partner FMV · −25% haircut     │
│ Max LTV 40%  ‹Devnet mock›    ›│
│                                │
│ Tap a row → S8 with the 90-day │
│ price chart on top             │
│ ( Shop with test money )       │  → S13 Demo Shop
│ ( Import from Backpack )       │  → S10
└────────────────────────────────┘
```

## S8 Asset detail (`/portfolio/[symbol]`)

```
┌────────────────────────────────┐
│ ‹ Assets                       │
│ ┌────────────────────────────┐ │  Equity: artwork/slab thumbnail row above chart
│ │ $211.96   +8.4% in 90 days │ │  PriceChart (parameters.md "Price history")
│ │      ╱╲    ╱‾‾╲  ╱‾        │ │  area line, hover/tap tooltip
│ │ ‾‾╲╱  ╲╱‾‾    ╲╱           │ │
│ │ - - - - - - - - - - - - -  │ │  dashed: Liquidation $76.92 (only with a position)
│ │ Jun 17      Jul 17   Sep 15│ │
│ └────────────────────────────┘ │
│ ‹7D› ‹30D› ‹90D›               │  90D default
│ Mainnet xStock price · reference│ ink-3 source label
│ ┌────────────────────────────┐ │  ArtNote: generative canvas + "Lot 01 · Oil on linen"
│ │ [artwork / slab visual]    │ │  Collectible: graded slab render / mirrored image
│ └────────────────────────────┘ │
│ Tidewater · Lot 01 note        │  Bodoni
│ Luxembourg compartment 01      │  ArtNote only; ink-3
│                                │
│ Price        $10.00 · Appraisal│
│ Updated      12 days ago       │
│ Haircut      20%               │
│ Max LTV      30%               │
│ Locked       0 TIDE            │
│ In wallet    1,000 TIDE        │
│                                │
│ ‹Deposit›‹Withdraw›            │  segmented
│ Amount   1,000        ‹MAX›    │
│ Credit added      +$2,400.00   │  1,000 × $10 × 0.8 × 30%
│ [     Confirm and sign      ]  │
└────────────────────────────────┘
Withdraw with debt: "You can withdraw up to {max} while you have a balance."
```

## S9 Cashback (`/cashback`)

```
┌────────────────────────────────┐
│ Cashback                       │
│ Every purchase buys you more   │
│ of what you own.               │
│                                │
│ Lifetime cashback              │
│ $14.20  in 0.0670 NVDAx        │  Bodoni + mono
│                                │
│ Your tier   ‹Demo toggle›      │
│ ┌────────┐┌────────┐┌────────┐ │
│ │Standard││ Plus ✓ ││ Black  │ │  selected = brass border
│ │ 0.5%   ││ 1.5%   ││ 2.5%   │ │
│ │ Free   ││€9.99/mo││€39.99  │ │
│ └────────┘└────────┘└────────┘ │
│                                │
│ Cashback buys                  │
│ (●) NVDAx    NVIDIA            │
│ ( ) SPYx     S&P 500           │
│ ( ) TIDE     Art note          │
│ ( ) Card pack credit  ‹soon›   │
│                                │
│ Goes straight into your        │
│ collateral and raises your     │
│ credit line.                   │
│ [          Save             ]  │
│ ────────────────────────────── │
│ Membership perks  ‹Planned›    │  PerksList for the selected tier
│ ✈ Airport lounges      Black   │
│ 🛡 Travel & purchase cover Black│
│ ◐ Trip cancellation 70% Black  │
│ ⌁ Global eSIM data  Plus·Black │
│ ▤ FT · Perplexity · NordVPN…   │
│   pick 2               Black   │
│ ◇ Grading & vault credits Black│
│ Benefits depend on partner and │  footnote, always visible
│ issuer agreements and may      │
│ change.                        │
└────────────────────────────────┘
```

## S10 Import from Backpack (`/import`)

```
┌────────────────────────────────┐
│ ‹ Assets                       │
│ Import from Backpack           │
│ See which of your holdings can │
│ back your card.                │
│                                │
│ API key     [ base64 public  ] │
│ API secret  [ •••••••••••••• ] │
│ ⓘ Your secret stays on this    │
│   device. We only send a       │
│   signature for a balance check│
│ [ Check holdings ] ( Use demo )│
│ ────────────────────────────── │
│ SPCX.US   40      ‹Eligible›   │  good
│ Withdraw to your wallet in     │
│ Backpack, then deposit here ›  │
│ MU.US     12  ‹Not on-chain›   │  ink-3
│ Broker-held. Not transferable. │
│ NVDA.US    5  ‹Not on-chain›   │
│ Buy NVDAx instead ›            │
└────────────────────────────────┘
```

## S11 Admin (`/admin`, devnet only)

```
┌────────────────────────────────┐
│ Demo controls   ‹Devnet only›  │
│ Admin token [ •••••••• ]       │
│                                │
│ Market   Price     Source      │
│ NVDAx    $211.96   Demo        │
│ ( Crash −40% ) ( Restore )     │
│ TIDE     $10.00    Appraisal   │
│ ( Crash −40% ) ( Restore )     │
│ ···                            │
│                                │
│ Positions at risk              │
│ 7xKp…9aQe  NVDAx  LTV 80%      │
│ Debt $500.11  ( Liquidate 50% )│
└────────────────────────────────┘
```

## Shared components

| Component | Where | Notes |
|---|---|---|
| `CreditCard` | S1, S2, S5 | **Built** (`app/src/components/credit-card.tsx`) |
| `HealthBar` | S2, S3 | **Built** (`app/src/components/health-bar.tsx`) |
| `MockBadge` | everywhere mocks show | **Built** |
| `ConnectButton` | header, S1 | **Built** |
| `AppShell` (tabs/rail/header) | layout | **Built** |
| `Sheet` (bottom sheet / desktop dialog) | S3, S4, S6, card limit | To build. Focus trap, Esc closes, safe-area padding |
| `AmountInput` | S3, S4, S6, S8 | To build. `inputmode="decimal"`, MAX chip, bigint parsing |
| `PreviewRow` | sheets | To build. label left, mono value right |
| `AssetRow`, `TxRow` | S7, S2/S5 | To build |
| `Toast` | global | To build. Success with explorer link, error with copy from parameters.md |
| `ExplorerLink` | rows, toasts | To build |
| `Banner` | S2 states | To build. warn/bad variants |

## S12 Savings (`/savings`)

```
┌────────────────────────────────┐
│ Savings                        │
│ Earn on USDC. It funds the     │
│ credit lines.                  │
│                                │
│ YOUR SAVINGS                   │
│ $10,142.50                     │  Bodoni-equivalent display, tabular
│ +$142.50 earned                │  mint/good
│                                │
│ Current APY        6.2%        │  ‹Founding saver +1%›
│ Pool utilization   ▓▓▓▓▓▓▓░ 81%│
│ Instant withdraw   $1,900,000  │
│                                │
│ [ Add USDC ]   ( Withdraw )    │
│ APY is variable: 60% of what   │
│ borrowers pay. Devnet test USDC│  ink-3 + MockBadge
└────────────────────────────────┘
Full pool: "Withdrawals above {idle} are available as loans are repaid."
```

## S14 Send to bank (`/bank`, sheet)

```
┌────────────────────────────────┐
│ Send to your bank          ✕   │
│ ‹Borrow› ‹Card balance›        │  source; Borrow default
│                                │
│ € 500.00              ‹MAX›    │  EUR input; MAX = what keeps LTV ≤ 50%
│ ≈ 577.55 USDC                  │  mono ink-3
│                                │
│ To   ABN AMRO ··4300  Luis P ▾ │  bank select; "+ Add bank account"
│ ────────────────────────────── │
│ Rate  1 USD = 0.8657 EUR · ECB │
│ StockCard fee        €2.50     │  0.50% Standard (Black 0%)
│ Provider fee         €0.00     │  "confirmed at launch"
│ You receive          €497.50   │  bold
│ Arrives   SEPA Instant · secs  │
│ ────────────────────────────── │
│ New LTV            0% → 27.2%  │  Borrow only
│ APR                12.9%       │
│ Liquidation if NVDA < $88.85   │
│                                │
│ [     Confirm and sign      ]  │
│ Not tax advice. Borrowing costs│  ink-3 disclaimer
│ interest and can be liquidated.│
└────────────────────────────────┘
```
Add bank account (sheet): Account holder (prefilled, must match your name) · IBAN (grouped in 4s, live checksum ✓) · BIC (optional) · [ Save account ]. Errors: "Check the IBAN: the check digits don't match." / "We can only send to SEPA bank accounts for now."
After signing: sheet shows a 3-step status: Sent on Solana ↗ → Processing → Arrived (simulated) with SEPA reference `SC-7K2Q9M`. Home activity gets a payout row "To ABN AMRO ··4300 · −€500.00 · Arrived" with a bank icon.
Above €10,000: purpose chips ‹Car› ‹Home› ‹Tax› ‹Other› required + note "Large transfers may require extra checks by your bank and our payout partner."

## S13 Demo Shop (`/shop`)

```
┌────────────────────────────────┐
│ Demo shop      ‹Test money›    │
│ Balance 100,000.00 dUSDC       │
│ ( Claim test money )           │  disabled after first claim, shows next refill
│ ‹Stocks› ‹Cards› ‹Watches› ‹Art›│
│ ┌────────────────────────────┐ │
│ │ [image: Rolex Daytona]     │ │  Collector Crypt image
│ │ Rolex "Pikachu" Daytona    │ │
│ │ Insured value $74,200      │ │  mono
│ │ Unlocks up to $22,260 credit│ │ 74,200 × 0.75 × 40%
│ │ [ Buy with test money ]    │ │
│ └────────────────────────────┘ │
│ Mirrored from a real Collector │  ink-3, every item
│ Crypt listing. Not affiliated. │
│ You don't own the real item.   │
└────────────────────────────────┘
After purchase: sheet "You bought Rolex "Pikachu" Daytona" [ Lock as collateral ] ( Keep in wallet )
Stocks tab: NVDAx $211.96 · Market price, amount input in $ or shares, same buy flow.
```

## Desktop

Judges will most likely open the Vercel link on a laptop, so desktop is a first-class layout, not a stretched phone. Same routes, same copy, same components; only the arrangement changes. The page flow is drawn with Archify in `docs/architecture/stockcard-screens.workflow.html`.

### Grid and shell

| Width | Nav | Content |
|---|---|---|
| < 768 px | bottom tabs | one column (mobile wireframes above) |
| 768–1023 px | left rail 224 px | one column, max 640 px, centered in the content area |
| ≥ 1024 px | left rail 224 px | 12-column grid, 24 px gutters, content max 1024 px (shell max 1280 px, `max-w-7xl`) |

- **Rail** (top to bottom): `StockCard` wordmark · Home · Card · Assets · Savings · Shop · (spacer) · tier chip `Plus` · `‹Solana devnet›` MockBadge. Active item: `brass-soft` fill + semibold. Admin is never in the rail.
- **Top bar** (sticky, 56 px): page title (Hanken 20 px semibold) left. Right: price freshness `Prices · 42 s ago` (mono, `warn` color after 180 s), alert bell with dot when a band is active, wallet pill `7xKp…9aQe ▾` (menu: copy address, explorer, disconnect).
- **Banners** (Warning / Urgent / Liquidatable / wrong network) sit full-width directly under the top bar, above the grid, on every page, not only Home.
- **Sheets become dialogs**: centered, 480 px wide, backdrop `ink` 40%, Esc and backdrop click close, focus returns to the trigger. Asset detail (S8) has no dialog: its form is an inline side panel.
- **Tables** replace stacked rows where rows have ≥ 4 comparable values (Assets, Card activity, Admin). Numbers right-aligned, `tabular-nums`, mono.
- **Hover** shows affordance only (row tint, card tilt); nothing is hover-only. Every action stays one click and keyboard reachable.

### D1 Welcome (`/`, disconnected)

```
┌────────┬──────────────────────────────────────────────────────────────┐
│        │                                                              │
│ (no    │  REAL ASSETS ONLY · NO MEMECOINS         ╭──────────────────╮│
│  rail  │                                          │ StockCard VIRTUAL││
│  when  │  Spend what you own.                     │ ▭ •••• 4021      ││
│  dis-  │  Never sell it.          Bodoni 64px     │ $18,420.00  VISA ││
│  conn- │                                          ╰──────────────────╯│
│  ected)│  Lock stocks, art or graded cards.       (tilts on hover)    │
│        │  Get a USDC credit line.                                     │
│        │  [ Connect wallet ]  Solana devnet · test assets             │
│        │                                                              │
│        │  Lock ──▶ Borrow ──▶ Spend ──▶ Repay     (4 small steps)     │
└────────┴──────────────────────────────────────────────────────────────┘
```
Two columns 6/6: copy left, card right. No rail until connected.

### D2 Home (`/`)

```
┌──────────┬───────────────────────────────────────────────────────────────────┐
│StockCard │ Home                          Prices · 42 s ago   🔔   7xKp…9aQe ▾│
│          ├───────────────────────────────────────────────────────────────────┤
│● Home    │ ┌ cols 1–7 ───────────────────────────┐ ┌ cols 8–12 ─────────────┐ │
│  Card    │ │ ╭─────────────╮  AVAILABLE CREDIT   │ │ TOTAL BALANCE          │ │
│  Assets  │ │ │ StockCard   │  $559.80            │ │ $6,689.00              │ │
│  Savings │ │ │ •••• 4021   │  of $1,059.80       │ │ ▓▓▓▓▓▓▓░░░░░░░░░▒▒     │ │
│  Shop    │ │ │ Card $390.00│                     │ │ Locked     $2,119.60   │ │
│          │ │ ╰─────────────╯                     │ │ In wallet  $4,179.40   │ │
│          │ │ Healthy                   LTV 23.6% │ │ Card       $390.00     │ │
│          │ │ ▓▓▓▓▓░░░░|░░░░|░░░░░░░░             │ │ Debt is 7.5% of        │ │
│          │ │ Debt $500.00 +$0.18/d │ APR 12.9%   │ │ everything you hold    │ │
│          │ │ [ Borrow to card ]  ( Repay )       │ │ View wallet tokens ›   │ │
│          │ └─────────────────────────────────────┘ ├────────────────────────┤ │
│          │                                         │ Recent card activity   │ │
│          │                                         │ ○ Albert Heijn −62.15  │ │
│ ‹Plus›   │ ┌ cols 1–12: Your positions ─────────────────────────────────────┐│
│‹Devnet›  │ │ NVDAx 10 locked $2,119.60 LTV 23.6% ▓░░ Liquidation < $76.92 › ││
│          │ └────────────────────────────────────────────────────────────────┘│
└──────────┴───────────────────────────────────────────────────────────────────┘
```
- Left (7 cols): card render at 320 px showing the **card balance**, Bodoni available credit (56 px), health bar with **position LTV**, debt/APR pair, two buttons.
- Right (5 cols): **Total balance** panel first (stacked bar Locked / Wallet / Card, three rows, "Debt is x% of everything you hold" in ink-3), then recent activity (last 5) and the alerts card.
- "View wallet tokens ›" opens a 480 px dialog: table Symbol · Amount · Price · Value · status chip (‹Eligible› with ( Lock ) → D8, ‹Locked›, ‹No price›). Totals row at the bottom.
- Positions strip (12 cols): one row per market with collateral, LTV mini-bar and liquidation price. Row → D8.
- Empty (no collateral): left column shows "Add an asset to open your credit line" + [ Add assets ] + [ Shop with test money ]; total balance panel still shows wallet and card.

### D3 Borrow / D4 Repay (dialogs over Home)

```
            ┌──────────────── 480 px ────────────────┐
            │ Borrow to your card                  ✕ │
            │ $ 500.00                        ‹MAX›  │
            │ Up to $890.00                          │
            │ From NVDAx position ▾  To 7xKp…9aQe    │
            │ ────────────────────────────────────── │
            │ New LTV                    18% → 54% ! │
            │ Liquidation if NVDA < $153.85 (−27.4%) │
            │ Suggested max $750 (35%)               │
            │ APR / interest          12.9% · $0.18/d│
            │               [ Confirm and sign ]     │
            └────────────────────────────────────────┘
```
Same content as S3/S4. Confirm is right-aligned; Enter submits when valid.

### D5 Card (`/card`) with D6 Test purchase dialog

```
┌ cols 1–5 ─────────────────────┐ ┌ cols 6–12: Activity ─────────────────────────────┐
│ ╭───────────────────────────╮ │ │ ‹All› ‹Settled› ‹Declined›          Export CSV ↓ │
│ │ StockCard        VIRTUAL  │ │ │ Merchant      Category  Status    Amount Cashback│
│ │ •••• •••• •••• 4021       │ │ │ Albert Heijn  Groceries Settled  −62.15 +0.0044 ↗│
│ │ $438.00  LUIS P · 09/29   │ │ │ Blue Bottle   Coffee    Settled   −4.80 +0.0003 ↗│
│ ╰───────────────────────────╯ │ │ KLM           Travel    Declined −389.00  Limit $500│
│ ‹Sandbox card›                │ │ ···                                    time col  │
│ Card limit  $500.00    Edit › │ └──────────────────────────────────────────────────┘
│ ▓▓▓▓▓▓▓▓▓▓▓░░ $438 left       │
│ Freeze card            ( ◯ )  │
│ [ Test purchase ]             │
│ Cashback: Plus 1.5% → NVDAx › │  → /cashback
└───────────────────────────────┘
```
Card controls left, full activity table right. "Export CSV" is hidden in the MVP if time is short (cut first).

### D7 Assets (`/portfolio`)

```
┌ Summary (12 cols, 3 figures) ──────────────────────────────────────────────────────┐
│ LOCKED  $2,119.60      IN WALLET  $4,179.40      CREDIT LINE  $1,059.80             │
└─────────────────────────────────────────────────────────────────────────────────────┘
‹All› ‹Stocks› ‹Art› ‹Collectibles›                 ( Shop with test money ) ( Import )
┌ cols 1–7: table ────────────────────────────────┐ ┌ cols 8–12: selected asset ───────┐
│ Asset          Price · source   Locked  Max LTV │ │ NVDAx · NVIDIA        Details ›  │
│▌NVDAx ‹Equity› $211.96 · Market  10.00   50%    │ │ $211.96   +8.4% in 90 days       │
│ TIDE ‹Art›     $10.00 · Apprais.  0      30%    │ │  ╱╲    ╱‾‾╲  ╱‾                  │
│ CC-LUGIA ‹Col.› $4,800 · Partner  0      40%    │ │ ‾  ╲╱‾‾    ╲╱                    │
│                                                 │ │ - - - Liquidation $76.92 - - -   │
│                                                 │ │ ‹7D› ‹30D› ‹90D›                 │
│                                                 │ │ Mainnet xStock price · reference │
│                                                 │ │ Wallet 15.00 · Locked 10.00      │
│                                                 │ │ [ Deposit ]  ( Withdraw )        │
└─────────────────────────────────────────────────┘ └──────────────────────────────────┘
```
- Row click **selects** the asset (brass left edge, `aria-selected`) and fills the right panel; the first row is selected on load. "Details ›" and double-click open D8. Arrow keys move the selection.
- Right panel: `PriceChart` 90D default, change %, source label, balances, Deposit / Withdraw (open D8 with the panel mode preset).
- Wallet column and "Credit it adds" appear in the table at ≥ 1280 px.
- Art notes / collectibles with one valuation: panel shows "Valued once on {date}" and the value instead of a chart.

### D8 Asset detail (`/portfolio/[symbol]`)

```
┌ cols 1–7 ──────────────────────────────┐ ┌ cols 8–12 (sticky panel) ───────┐
│ ‹ Assets                               │ │ ‹Deposit› ‹Withdraw›            │
│ ┌────────────────────────────────────┐ │ │ Amount  1,000          ‹MAX›    │
│ │ PriceChart 90D (area, tooltip,     │ │ │ In wallet 1,000 TIDE            │
│ │ liquidation line) ‹7D›‹30D›‹90D›   │ │ │ ─────────────────────────────── │
│ └────────────────────────────────────┘ │ │                                 │
│ [artwork / slab thumbnail] 96 px       │ │                                 │
│ Tidewater · Lot 01 note      Bodoni    │ │ Credit added       +$2,400.00   │
│ Luxembourg compartment 01              │ │ LTV after          18% → 12%    │
│ Price $10.00 · Appraisal · 12 days ago │ │ [ Confirm and sign ]            │
│ Haircut 20%   Max LTV 30%              │ └─────────────────────────────────┘
│ Locked 0 TIDE                          │
└────────────────────────────────────────┘
```

### D9 Cashback (`/cashback`, reached from Card)

Three tier cards in a row (cols 1–8, Standard / Plus / Black with fee, top rate, spend cap) and the asset picker + lifetime cashback on the right (cols 9–12) with [ Save ].

Below, full width: **Membership perks ‹Planned›** comparison table, perks as rows and Standard / Plus / Black as columns (✓, value such as "Up to 70%, max €5,000/yr", or —), grouped Travel · Protection · Subscriptions · Collector · Support, from parameters.md "Membership perks". The selected tier's column is highlighted. Footnote under the table: "Planned benefits. Benefits depend on partner and issuer agreements and may change." No perk is ever shown as active in the MVP.

### D10 Import from Backpack (`/import`)

Form left (cols 1–5: key, secret, privacy note, [ Check holdings ] ( Use demo )); results table right (cols 6–12: Symbol, Qty, Status chip, next step).

### D11 Admin (`/admin`, devnet only)

```
Demo controls ‹Devnet only›                                     Admin token [ •••• ]
┌ cols 1–6: Markets ──────────────────────┐ ┌ cols 7–12: Positions at risk ─────────┐
│ Market  Price    Source   Age           │ │ Owner      Market LTV   Debt          │
│ NVDAx   $211.96  Demo     12 s          │ │ 7xKp…9aQe  NVDAx  67.4% $1,000.00     │
│ (Crash −30%) (Restore)                  │ │                  ( Liquidate 50% )    │
│ TIDE    $10.00   Appraisal 12 d         │ └───────────────────────────────────────┘
└─────────────────────────────────────────┘
┌ cols 1–12: Event log (last 20: price posts, liquidations, pushes sent, with tx ↗) ┐
```
The demo script runs from this one screen with a second browser window on D2 beside it.

### D12 Savings (`/savings`)

```
┌ cols 1–7 ──────────────────────────────┐ ┌ cols 8–12: Pool ────────────────┐
│ YOUR SAVINGS                           │ │ Current APY          6.2%       │
│ $10,142.50           Bodoni 56px       │ │ ‹Founding saver +1%›            │
│ +$142.50 earned                        │ │ Utilization  ▓▓▓▓▓▓▓░ 81%       │
│ [ Add USDC ]  ( Withdraw )             │ │ Instant withdraw  $1,900,000    │
│ ────────────────────────────────────── │ │ Borrowers pay   12.9% avg       │
│ History: Deposit / Withdraw / Interest │ │ Savers get 60% of interest      │
│ rows with date, amount, tx ↗           │ │ ‹Devnet test USDC›              │
└────────────────────────────────────────┘ └─────────────────────────────────┘
```

### D13 Demo Shop (`/shop`)

```
Demo shop ‹Test money›                     Balance 100,000.00 dUSDC  ( Claim test money )
‹Stocks› ‹Cards› ‹Watches› ‹Art›
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   3 cols at 1024 px
│ [image]     │ │ [image]     │ │ [image]     │ │ [image]     │   4 cols at ≥ 1280 px
│ Rolex       │ │ Lugia PSA 10│ │ Royal Oak   │ │ Mew PSA 10  │   image 4:3, cover
│ Daytona     │ │             │ │             │ │             │
│ $74,200     │ │ $4,800      │ │ …           │ │ …           │
│ Unlocks     │ │ Unlocks     │ │             │ │             │
│ $22,260     │ │ $1,440      │ │             │ │             │
│ [ Buy ]     │ │ [ Buy ]     │ │ [ Buy ]     │ │ [ Buy ]     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
Mirrored from real Collector Crypt listings. Not affiliated. You don't own the real items.
```
Buy opens a dialog; after purchase the dialog offers [ Lock as collateral ] ( Keep in wallet ). Stocks tab is a table (Symbol, Price · source, amount input in $ or shares, [ Buy ]).

### D14 Send to bank (dialog, 560 px, from Home or Card)

```
┌──────────────────────────── 560 px ─────────────────────────────┐
│ Send to your bank                                            ✕  │
│ ‹Borrow› ‹Card balance›                                         │
│ ┌ left 55% ──────────────────────┐ ┌ right 45%: preview ───────┐│
│ │ € 500.00                ‹MAX›  │ │ Rate 1 USD = 0.8657 EUR   ││
│ │ ≈ 577.55 USDC                  │ │ StockCard fee    €2.50    ││
│ │ To ABN AMRO ··4300 ▾           │ │ You receive      €497.50  ││
│ │ + Add bank account             │ │ SEPA Instant · seconds    ││
│ │ Purpose (over €10k) ‹Car›‹Home›│ │ New LTV    0% → 27.2%     ││
│ │                                │ │ Liquidation NVDA < $88.85 ││
│ └────────────────────────────────┘ └───────────────────────────┘│
│ Not tax advice. Borrowing costs interest…      [ Confirm and sign ]│
└──────────────────────────────────────────────────────────────────┘
```
- Entry points: Home left column buttons become [ Borrow to card ] ( Send to bank ) ( Repay ); Card screen link "Send card balance to bank ›".
- Payout rows appear in Home activity and in a "Bank transfers" tab on Card activity (columns: Date, Bank, Amount EUR, USDC, Status chip, Solana tx ↗, SEPA ref).

### Desktop acceptance

- 1280×800 and 1440×900: no horizontal scroll, the Home above-the-fold shows available credit, health bar and both buttons without scrolling.
- 1024 px: every two-column layout still fits; tables keep Asset, Price, Locked and the action column (others may hide).
- Keyboard only: rail → top bar → content order; dialogs trap focus.
