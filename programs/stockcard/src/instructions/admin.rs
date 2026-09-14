use crate::errors::StockcardError;
use crate::instructions::validate_risk_params;
use crate::state::{Config, Market, RateBand};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateMarket<'info> {
    #[account(constraint = config.admin == admin.key() @ StockcardError::Unauthorized)]
    pub admin: Signer<'info>,
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[allow(clippy::too_many_arguments)]
pub fn update_market_handler(
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
    validate_risk_params(
        max_ltv_bps,
        liq_threshold_bps,
        liq_bonus_bps,
        haircut_bps,
        &apr_bands,
    )?;
    let market = &mut ctx.accounts.market;
    market.max_ltv_bps = max_ltv_bps;
    market.liq_threshold_bps = liq_threshold_bps;
    market.liq_bonus_bps = liq_bonus_bps;
    market.haircut_bps = haircut_bps;
    market.apr_bands = apr_bands;
    market.max_price_age_secs = max_price_age_secs;
    market.closed_market_age_secs = closed_market_age_secs;
    market.closed_haircut_bps = closed_haircut_bps;
    Ok(())
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(constraint = config.admin == admin.key() @ StockcardError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
}

pub fn set_pause_handler(ctx: Context<SetPause>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}
