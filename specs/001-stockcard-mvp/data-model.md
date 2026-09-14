# Data Model: StockCard MVP

All on-chain amounts are `u64` in token base units (6 decimals). Rates and ratios are `u16`/`u64` basis points (10,000 = 100%). Prices are stored as `(price: i64, expo: i32)` like Pyth and converted to USD with 6 decimals in `math.rs`.

## On-chain accounts

### Config — PDA `["config"]`
| Field | Type | Notes |
|---|---|---|
| admin | Pubkey | Can add markets, set signed prices, pause |
| usdc_mint | Pubkey | Borrow asset |
| usdc_vault | Pubkey | PDA token account `["usdc_vault"]`, authority = config |
| apr_bps | u16 | 800 = 8% |
| close_factor_bps | u16 | 5,000 = max 50% of debt per liquidation |
| cashback_authority | Pubkey | Allowed to call `deposit_collateral_for` |
| price_signer | Pubkey | Allowed to call `set_signed_price` (can equal admin on devnet) |
| paused | bool | Blocks borrow/withdraw, allows repay |
| bump | u8 | |

### Market — PDA `["market", collateral_mint]`
| Field | Type | Notes |
|---|---|---|
| collateral_mint | Pubkey | |
| collateral_vault | Pubkey | PDA token account `["collateral_vault", market]` |
| asset_class | enum { Equity, ArtNote, Collectible } | UI + policy (constitution II) |
| oracle_kind | enum { Pyth, Signed } | |
| pyth_feed_id | [u8; 32] | Used if Pyth |
| max_ltv_bps / liq_threshold_bps / liq_bonus_bps / haircut_bps | u16 | Validated: max_ltv < liq_threshold ≤ 9,000 |
| max_price_age_secs | u32 | Normal staleness |
| closed_market_age_secs / closed_haircut_bps | u32 / u16 | Equity market-hours fallback |
| total_collateral | u64 | |
| decimals | u8 | Collateral mint decimals |
| bump | u8 | |

### SignedPrice — PDA `["price", market]`
| Field | Type | Notes |
|---|---|---|
| market | Pubkey | |
| price | i64 | |
| expo | i32 | e.g. −6 |
| publish_time | i64 | Unix seconds; staleness uses this |
| source | enum { Appraisal, PartnerFmv, Demo } | Shown in UI |

### Position — PDA `["position", market, owner]`
| Field | Type | Notes |
|---|---|---|
| owner | Pubkey | |
| market | Pubkey | |
| collateral_amount | u64 | |
| debt_principal | u64 | USDC base units, includes capitalized interest |
| last_accrual_ts | i64 | |
| bump | u8 | |

**Interest** (`accrue`): `debt += debt × apr_bps × elapsed / (10,000 × 31,536,000)` with u128 intermediates, rounded up (in the protocol's favor), then `last_accrual_ts = now`.

**Value**: `collateral_usd = amount × price × (10,000 − haircut) / 10,000` (normalized to 6 decimals).

**LTV**: `debt × 10,000 / collateral_usd` (u64::MAX when collateral is 0 and debt > 0).

**State transitions**
```
[no position] --deposit--> Open(collateral>0, debt=0)
Open --borrow (ltv' ≤ max)--> Borrowed(debt>0)
Borrowed --repay all--> Open
Borrowed --price drop, ltv > liq_threshold--> Liquidatable
Liquidatable --liquidate (≤ close factor)--> Borrowed | Open
Open --withdraw all--> Empty (account may be closed, rent back)
```

## Off-chain records (Redis)

### Card — key `card:{owner}`
`{ id, owner, last4, expMonth, expYear, holderName, network: "VISA"|"MASTERCARD", provider: "mock"|"bridge", providerRef?, status: "active"|"frozen", tier: "standard"|"plus"|"black", cashbackMint, createdAt }`

### CardTransaction — list `txs:{owner}` (newest first, max 100)
`{ id, merchant, category, amountUsd6, status: "pending"|"settled"|"declined", declineReason?, settlementSig?, cashback: { mint, amount, usd6, sig?, status: "queued"|"sent"|"failed" }, createdAt }`

### Faucet rate limit — key `faucet:{owner}:{mint}` TTL 1h
