# Data Model: StockCard MVP

All on-chain amounts are `u64` in token base units (6 decimals). Rates and ratios are `u16`/`u64` basis points (10,000 = 100%). Prices are stored as `(price: i64, expo: i32)` (Pyth/Switchboard style) and converted to USD with 6 decimals in `math.rs`.

## On-chain accounts

### Config — PDA `["config"]`
| Field | Type | Notes |
|---|---|---|
| admin | Pubkey | Can add markets, set signed prices, pause |
| usdc_mint | Pubkey | Borrow asset |
| usdc_vault | Pubkey | PDA token account `["usdc_vault"]`, authority = config |
| protocol_share_bps | u16 | 4,000 = 40% of interest to reserve |
| max_utilization_bps | u16 | 9,000 |
| total_borrowed | u64 | Sum of all debt incl. accrued interest (updated on accrue/borrow/repay/liquidate) |
| total_shares | u64 | Savings shares outstanding |
| reserve | u64 | Protocol reserve in USDC base units (part of the vault balance) |
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
| oracle_kind | enum { Signed, Switchboard } | Switchboard only if the Wed spike passes |
| oracle_feed | Pubkey | Switchboard feed account; default for Signed |
| max_ltv_bps / liq_threshold_bps / liq_bonus_bps / haircut_bps | u16 | Validated: max_ltv < liq_threshold ≤ 9,000 |
| apr_bands | [RateBand; 3] | `RateBand { max_ltv_bps: u16, apr_bps: u16 }`, unused bands = 0 (parameters.md §3b) |
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
| source | enum { Market, Appraisal, PartnerFmv, Demo } | Market = price signer from public sources; Demo = admin override. Shown in UI |

### Position — PDA `["position", market, owner]`
| Field | Type | Notes |
|---|---|---|
| owner | Pubkey | |
| market | Pubkey | |
| collateral_amount | u64 | |
| debt_principal | u64 | USDC base units, includes capitalized interest |
| last_accrual_ts | i64 | |
| apr_bps | u16 | Rate applied since the last state change; re-selected from `apr_bands` after each change |
| bump | u8 | |

**Interest** (`accrue`): `i = debt × position.apr_bps × elapsed / (10,000 × 31,536,000)` with u128 intermediates, rounded up; `debt += i`; `config.total_borrowed += i`; `config.reserve += i × protocol_share_bps / 10,000` (rounded up); `last_accrual_ts = now`. After the state change, `position.apr_bps` = band for the new LTV.

**Savings shares**: `pool_value = vault_balance + total_borrowed − reserve`. Deposit: `shares = amount × total_shares / pool_value` (1:1 when empty, rounded down). Withdraw: `amount = shares × pool_value / total_shares` (rounded down), requires `vault_balance − reserve ≥ amount`. Utilization = `total_borrowed / (pool_value)`.

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

### PushSubscription — set `push:{owner}` (max 5 devices)
`{ id, endpoint, keys: { p256dh, auth }, userAgent, createdAt }`. Removed on unsubscribe or when the push service returns 404/410.

### AlertState — key `alert:{owner}:{market}`
`{ band: "healthy"|"watch"|"warning"|"urgent"|"liquidatable", ltvBps, notifiedBand, updatedAt }`. A push is sent only when `band` is worse than `notifiedBand`; `notifiedBand` resets when the position returns to healthy.

### Owner index — set `owners:active`
Wallets with a position or push subscription, used by the alert check to find positions (or read `Position` accounts with `getProgramAccounts` filtered by market).

### SavingsPosition — PDA `["savings", owner]`
| Field | Type | Notes |
|---|---|---|
| owner | Pubkey | |
| shares | u64 | |
| bump | u8 | |

### ShopOrder — list `shop:{owner}` (Redis)
`{ id, kind: "stock"|"art"|"item", symbol, amount, priceUsd6, paySig, mintSig, status: "paid"|"minted"|"failed", createdAt }`. Idempotent by `paySig`.
