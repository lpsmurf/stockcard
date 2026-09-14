# Wireframes: StockCard MVP

Mobile first (360 px). Desktop keeps the same content with a left rail and a two-column Home. Copy shown is final unless marked `{variable}`. Visual tokens: see ui.md and parameters.md §6.

Legend: `[ Button ]` primary (brass) · `( Button )` secondary (outline) · `‹chip›` · `▓▓░░` bar · `···` list continues.

## Flow

```
S1 Welcome ──connect──▶ S2 Home ──Borrow to card──▶ S3 Borrow sheet ──sign──▶ S2 (toast)
                           │                                      
                           ├──Card──▶ S5 Card ──Test purchase──▶ S6 Purchase sheet ──Pay──▶ S5 (feed + cashback row)
                           ├──Assets──▶ S7 Assets ──row──▶ S8 Asset detail ──Deposit/Withdraw──▶ sign ──▶ S7
                           ├──Cashback──▶ S9 Cashback (tier + asset)
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
│ $890.00                        │  Bodoni 44px, tabular
│ of $1,390.00 credit line       │  ink-3
│                                │
│ Healthy             LTV 18%    │  HealthBar
│ ▓▓▓▓░░░░░░░░|░░░░|░░░░░░░░░    │  markers: max 50% · liq 65%
│             max 50%  liq 65%   │
│                                │
│ ┌──────────────┬─────────────┐ │
│ │ Debt         │ APR         │ │
│ │ $500.00      │ 8.00%       │ │
│ │ +$0.11/day   │ fixed       │ │
│ └──────────────┴─────────────┘ │
│                                │
│ [ Borrow to card ] ( Repay )   │  two equal buttons
│                                │
│ Recent card activity  See all ›│
│ ○ Albert Heijn      −$62.15    │  TxRow: merchant, amount
│   Settled · +0.0035 NVDAx      │  cashback line in brass
│ ○ Blue Bottle        −$4.80    │
│   Settled · +0.0003 NVDAx      │
├────────────────────────────────┤
│ Home   Card   Assets  Cashback │  bottom tabs
└────────────────────────────────┘

States
- No collateral: replace credit block with "Add an asset to open your credit line" + [ Add assets ] → /portfolio
- At risk (LTV > 65%): red banner at top "Your position can be liquidated. Repay or add collateral." [ Repay ] ( Add collateral )
- Loading: skeleton blocks at same sizes
- Wrong network: amber banner "Switch your wallet to Devnet"
Desktop: left column card + credit + health; right column activity feed.
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
│ Interest           $0.11 / day │
│ Health after       Healthy     │
│                                │
│ [     Confirm and sign      ]  │  sticky above safe-area
└────────────────────────────────┘
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
│                                │
│ [       Test purchase       ]  │  → S6
│                                │
│ Activity                       │
│ ○ Albert Heijn       −$62.15   │
│   Groceries · Settled · 14:02 ↗│  ↗ explorer
│   +0.0035 NVDAx cashback       │
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
│ Cashback   +$0.62 in NVDAx     │  brass; tier label "Plus 1%"
│ Card limit left   $437.85      │
│ [            Pay            ]  │
└────────────────────────────────┘
Result: sheet closes; feed row appears as Pending → Settled (poll 5 s); toast "Paid $62.15 · +0.0035 NVDAx".
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
│ NVIDIA · $178.00 · Pyth        │
│ Locked 10.00 · Wallet 15.00    │
│ Max LTV 50%      ( Deposit )   ›│
│ ────────────────────────────── │
│ TIDE              ‹Art note›   │
│ Tidewater Lot 01 · $10.00      │
│ Appraisal · −20% haircut       │
│ Locked 0 · Wallet 1,000        │
│ Max LTV 30%  ‹Devnet mock›    ›│
│ ────────────────────────────── │
│ PSA10          ‹Collectible›   │
│ Graded card · $4,800 FMV       │
│ Partner FMV · −25% haircut     │
│ Max LTV 40%  ‹Devnet mock›    ›│
│                                │
│ ( Get test assets )            │  faucet
│ ( Import from Backpack )       │  → S10
└────────────────────────────────┘
```

## S8 Asset detail (`/portfolio/[symbol]`)

```
┌────────────────────────────────┐
│ ‹ Assets                       │
│ ┌────────────────────────────┐ │  Equity: price sparkline placeholder
│ │     [artwork / slab /      │ │  ArtNote: generative canvas + "Lot 01 · Oil on linen"
│ │      price visual]         │ │  Collectible: graded slab render
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
│ $14.20  in 0.0798 NVDAx        │  Bodoni + mono
│                                │
│ Your tier   ‹Demo toggle›      │
│ ┌────────┐┌────────┐┌────────┐ │
│ │Standard││ Plus ✓ ││ Black  │ │  selected = brass border
│ │ 0.5%   ││ 1%     ││ 2%     │ │
│ │ Free   ││$9.99/mo││ $29/mo │ │
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
│ NVDAx    $178.00   Demo        │
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
