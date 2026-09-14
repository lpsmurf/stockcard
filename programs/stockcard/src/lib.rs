use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod oracle;
pub mod state;

use instructions::*;
use state::{AssetClass, OracleKind, PriceSource, RateBand};

declare_id!("B3Rnj6RMY3oReVWktyQXyxLQSbM1oQGdUQJvLzBd1Net");

#[program]
pub mod stockcard {
    use super::*;

    pub fn init_config(
        ctx: Context<InitConfig>,
        protocol_share_bps: u16,
        max_utilization_bps: u16,
        close_factor_bps: u16,
        cashback_authority: Pubkey,
        price_signer: Pubkey,
    ) -> Result<()> {
        instructions::init_config::init_config_handler(
            ctx,
            protocol_share_bps,
            max_utilization_bps,
            close_factor_bps,
            cashback_authority,
            price_signer,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn add_market(
        ctx: Context<AddMarket>,
        asset_class: AssetClass,
        oracle_kind: OracleKind,
        oracle_feed: Pubkey,
        max_ltv_bps: u16,
        liq_threshold_bps: u16,
        liq_bonus_bps: u16,
        haircut_bps: u16,
        apr_bands: [RateBand; 3],
        max_price_age_secs: u32,
        closed_market_age_secs: u32,
        closed_haircut_bps: u16,
    ) -> Result<()> {
        instructions::add_market::add_market_handler(
            ctx,
            asset_class,
            oracle_kind,
            oracle_feed,
            max_ltv_bps,
            liq_threshold_bps,
            liq_bonus_bps,
            haircut_bps,
            apr_bands,
            max_price_age_secs,
            closed_market_age_secs,
            closed_haircut_bps,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_market(
        ctx: Context<UpdateMarket>,
        max_ltv_bps: u16,
        liq_threshold_bps: u16,
        liq_bonus_bps: u16,
        haircut_bps: u16,
        apr_bands: [RateBand; 3],
        max_price_age_secs: u32,
        closed_market_age_secs: u32,
        closed_haircut_bps: u16,
    ) -> Result<()> {
        instructions::admin::update_market_handler(
            ctx,
            max_ltv_bps,
            liq_threshold_bps,
            liq_bonus_bps,
            haircut_bps,
            apr_bands,
            max_price_age_secs,
            closed_market_age_secs,
            closed_haircut_bps,
        )
    }

    pub fn set_signed_price(
        ctx: Context<SetSignedPrice>,
        price: i64,
        expo: i32,
        source: PriceSource,
    ) -> Result<()> {
        instructions::set_signed_price::set_signed_price_handler(ctx, price, expo, source)
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        instructions::admin::set_pause_handler(ctx, paused)
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        instructions::deposit::deposit_handler(ctx, amount)
    }

    pub fn deposit_collateral_for(
        ctx: Context<DepositCollateralFor>,
        owner: Pubkey,
        amount: u64,
    ) -> Result<()> {
        instructions::deposit_for::deposit_for_handler(ctx, owner, amount)
    }

    pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
        instructions::withdraw::withdraw_handler(ctx, amount)
    }

    pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
        instructions::borrow::borrow_handler(ctx, amount)
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        instructions::repay::repay_handler(ctx, amount)
    }

    pub fn liquidate(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()> {
        instructions::liquidate::liquidate_handler(ctx, repay_amount)
    }

    pub fn deposit_savings(ctx: Context<DepositSavings>, amount: u64) -> Result<()> {
        instructions::savings::deposit_savings_handler(ctx, amount)
    }

    pub fn withdraw_savings(ctx: Context<WithdrawSavings>, shares: u64) -> Result<()> {
        instructions::savings::withdraw_savings_handler(ctx, shares)
    }

    pub fn claim_reserve(ctx: Context<ClaimReserve>, amount: u64) -> Result<()> {
        instructions::savings::claim_reserve_handler(ctx, amount)
    }
}
