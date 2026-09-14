# Contract: `stockcard` Anchor program

Errors live in `errors.rs`: `Unauthorized`, `Paused`, `StalePrice`, `InvalidPrice`, `ExceedsMaxLtv`, `NotLiquidatable`, `ExceedsCloseFactor`, `InsufficientLiquidity`, `InsufficientCollateral`, `InvalidRiskParams`, `MathOverflow`, `ZeroAmount`, `WrongOracle`.

| Instruction | Signer | Accounts (besides programs/sysvars) | Args | Effects & checks |
|---|---|---|---|---|
| `init_config` | admin | config (init), usdc_mint, usdc_vault (init) | apr_bps, close_factor_bps, cashback_authority, price_signer | Creates config + pool vault |
| `add_market` | admin | config, market (init), collateral_mint, collateral_vault (init) | asset_class, oracle_kind, pyth_feed_id, risk params, ages | Validates risk params |
| `update_market` | admin | config, market | risk params, ages | Same validation |
| `set_signed_price` | price_signer | config, market, signed_price (init_if_needed) | price, expo, source | `oracle_kind == Signed`; price > 0; publish_time = now |
| `fund_pool` | anyone | config, usdc_vault, funder_usdc | amount | Transfer USDC into pool |
| `set_pause` | admin | config | paused | |
| `deposit_collateral` | owner | config, market, position (init_if_needed), owner_token, collateral_vault | amount | Accrue; transfer in; totals += |
| `deposit_collateral_for` | cashback_authority | config, market, position (init_if_needed, owner = arg), source_token, collateral_vault | owner, amount | Same as deposit, signer must be `config.cashback_authority` |
| `withdraw_collateral` | owner | config, market, position, owner_token, collateral_vault, price_account | amount | Not paused; accrue; if debt > 0 require fresh price and ltv' ≤ max |
| `borrow` | owner | config, market, position, usdc_vault, destination_usdc, price_account | amount | Not paused; accrue; fresh price; ltv' ≤ max; vault ≥ amount; transfer out |
| `repay` | payer (any) | config, market, position, payer_usdc, usdc_vault | amount (u64::MAX = all) | Accrue; `paid = min(amount, debt)`; transfer in |
| `liquidate` | liquidator | config, market, position, liquidator_usdc, usdc_vault, liquidator_collateral, collateral_vault, price_account | repay_amount | Accrue; fresh price; ltv > liq_threshold; repay ≤ close factor × debt; seize = repay × (1 + bonus) / price, capped at collateral |

Collateral accounts use `anchor_spl::token_interface` (`InterfaceAccount<Mint>`, `InterfaceAccount<TokenAccount>`, `Interface<TokenInterface>`) and `transfer_checked`, so Token-2022 xStocks work. Collateral valuation multiplies the raw amount by the mint's Scaled UI Amount multiplier when the extension is present (use `new_multiplier` once `new_multiplier_effective_timestamp` ≤ now).

`price_account` is a Pyth `PriceUpdateV2` (verified feed id and `get_price_no_older_than`) or the market's `SignedPrice` PDA, depending on `market.oracle_kind` (`WrongOracle` otherwise).

**Events** (for the app feed): `Deposited`, `Withdrawn`, `Borrowed`, `Repaid`, `Liquidated`, `CashbackDeposited`, `PriceSet`.

**Tests required** (`tests/stockcard.ts`): borrow at max succeeds, 1 unit over fails; stale signed price fails; repay all leaves 0 debt; withdraw guarded by LTV; liquidation fails when healthy and succeeds after a price drop with correct seize amount; `deposit_collateral_for` rejects a non-authority signer; interest after a simulated time jump matches `lib/risk.ts`.
