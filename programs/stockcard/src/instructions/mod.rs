use crate::errors::StockcardError;
use crate::math;
use crate::state::{Config, Market, Position, SignedPrice};
use anchor_lang::prelude::*;

pub mod add_market;
pub mod admin;
pub mod borrow;
pub mod deposit;
pub mod deposit_for;
pub mod init_config;
pub mod liquidate;
pub mod repay;
pub mod savings;
pub mod set_signed_price;
pub mod withdraw;

pub use add_market::*;
pub use admin::*;
pub use borrow::*;
pub use deposit::*;
pub use deposit_for::*;
pub use init_config::*;
pub use liquidate::*;
pub use repay::*;
pub use savings::*;
pub use set_signed_price::*;
pub use withdraw::*;

// Interest accrues before any state change (constitution III).
pub fn accrue(position: &mut Position, config: &mut Config, now: i64) -> Result<()> {
    if position.debt_principal > 0 && now > position.last_accrual_ts {
        let elapsed = (now - position.last_accrual_ts) as u64;
        let interest = math::accrue_interest(position.debt_principal, position.apr_bps, elapsed)?;
        if interest > 0 {
            position.debt_principal = position
                .debt_principal
                .checked_add(interest)
                .ok_or(error!(StockcardError::MathOverflow))?;
            config.total_borrowed = config
                .total_borrowed
                .checked_add(interest)
                .ok_or(error!(StockcardError::MathOverflow))?;
            let share = math::reserve_share(interest, config.protocol_share_bps)?;
            config.reserve = config
                .reserve
                .checked_add(share)
                .ok_or(error!(StockcardError::MathOverflow))?;
        }
    }
    position.last_accrual_ts = now;
    Ok(())
}

// Re-select the APR band for the position's new LTV. Skipped silently when the
// price is missing or stale (deposit/repay paths), so those never fail on price.
pub fn reselect_apr(
    position: &mut Position,
    market: &Market,
    multiplier_micro: u64,
    signed_price: Option<&SignedPrice>,
    now: i64,
) -> Result<()> {
    if position.debt_principal == 0 {
        position.apr_bps = math::select_apr_bps(&market.apr_bands, 0);
        return Ok(());
    }
    let price = match signed_price {
        Some(p) => p,
        None => return Ok(()),
    };
    if let Ok(quote) = crate::oracle::checked_price(market, price, now) {
        let value = math::collateral_value_usd6(
            position.collateral_amount,
            multiplier_micro,
            quote.price_usd6,
            quote.effective_haircut_bps,
            market.decimals,
        )?;
        let ltv = math::ltv_bps(position.debt_principal, value)?;
        position.apr_bps = math::select_apr_bps(&market.apr_bands, ltv);
    }
    Ok(())
}

pub fn validate_risk_params(
    max_ltv_bps: u16,
    liq_threshold_bps: u16,
    liq_bonus_bps: u16,
    haircut_bps: u16,
    apr_bands: &[crate::state::RateBand; 3],
) -> Result<()> {
    require!(
        max_ltv_bps > 0 && max_ltv_bps < liq_threshold_bps && liq_threshold_bps <= 9000,
        StockcardError::InvalidRiskParams
    );
    require!(liq_bonus_bps <= 2000, StockcardError::InvalidRiskParams);
    require!(haircut_bps < 10_000, StockcardError::InvalidRiskParams);
    let mut prev_max: u16 = 0;
    let mut last_apr: u16 = 0;
    for band in apr_bands.iter() {
        if band.max_ltv_bps == 0 && band.apr_bps == 0 {
            continue;
        }
        require!(
            band.apr_bps > 0 && band.apr_bps <= 5000,
            StockcardError::InvalidRiskParams
        );
        require!(band.max_ltv_bps > prev_max, StockcardError::InvalidRiskParams);
        prev_max = band.max_ltv_bps;
        last_apr = band.apr_bps;
    }
    require!(last_apr > 0, StockcardError::InvalidRiskParams);
    require!(prev_max >= max_ltv_bps, StockcardError::InvalidRiskParams);
    Ok(())
}
