use crate::errors::StockcardError;
use crate::math;
use crate::state::{Market, OracleKind, SignedPrice};
use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use anchor_spl::token_2022::spl_token_2022::extension::BaseStateWithExtensions;
use anchor_spl::token_interface::TokenAccount;

pub struct PriceQuote {
    pub price_usd6: u64,
    pub effective_haircut_bps: u16,
}

// Reads the market's price with staleness + closed-market fallback.
// Signed: from the SignedPrice PDA. Switchboard: added in T029b only if the spike passes.
pub fn checked_price(market: &Market, signed_price: &SignedPrice, now: i64) -> Result<PriceQuote> {
    match market.oracle_kind {
        OracleKind::Signed => {}
        OracleKind::Switchboard => return err!(StockcardError::WrongOracle),
    }
    if signed_price.price <= 0 {
        return err!(StockcardError::InvalidPrice);
    }
    let age = now
        .checked_sub(signed_price.publish_time)
        .ok_or(error!(StockcardError::InvalidPrice))?;
    if age < 0 {
        return err!(StockcardError::InvalidPrice);
    }
    let age = age as u64;
    let effective_haircut_bps = if age <= market.max_price_age_secs as u64 {
        market.haircut_bps
    } else if market.closed_market_age_secs > 0 && age <= market.closed_market_age_secs as u64 {
        market.closed_haircut_bps
    } else {
        return err!(StockcardError::StalePrice);
    };
    Ok(PriceQuote {
        price_usd6: math::price_to_usd6(signed_price.price, signed_price.expo)?,
        effective_haircut_bps,
    })
}

// Token-2022 Scaled UI Amount multiplier, scaled by 1e6. 1.0 when the mint has no extension.
pub fn multiplier_micro(mint_ai: &AccountInfo, now: i64) -> Result<u64> {
    if mint_ai.owner != &spl_token_2022::ID {
        return Ok(math::MULTIPLIER_SCALE as u64);
    }
    let data = mint_ai.try_borrow_data()?;
    let state = spl_token_2022::extension::StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&data)
        .map_err(|_| error!(StockcardError::WrongOracle))?;
    let ext = match state.get_extension::<spl_token_2022::extension::scaled_ui_amount::ScaledUiAmountConfig>() {
        Ok(e) => e,
        Err(_) => return Ok(math::MULTIPLIER_SCALE as u64),
    };
    let current: f64 = ext.multiplier.into();
    let new_effective: i64 = ext.new_multiplier_effective_timestamp.into();
    let effective = if new_effective > 0 && new_effective <= now {
        let new: f64 = ext.new_multiplier.into();
        new
    } else {
        current
    };
    if !(effective > 0.0 && effective.is_finite()) {
        return err!(StockcardError::InvalidPrice);
    }
    Ok((effective * math::MULTIPLIER_SCALE as f64).round() as u64)
}

// Issuer controls (integrations.md): block when the issuer paused transfers or set a
// transfer hook program. Called before borrows; CPI failures cover withdraw/liquidate.
pub fn assert_mint_transferable(mint_ai: &AccountInfo) -> Result<()> {
    if mint_ai.owner != &spl_token_2022::ID {
        return Ok(());
    }
    let data = mint_ai.try_borrow_data()?;
    let state = spl_token_2022::extension::StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&data)
        .map_err(|_| error!(StockcardError::MarketBlocked))?;
    if let Ok(pausable) = state.get_extension::<spl_token_2022::extension::pausable::PausableConfig>() {
        let paused: bool = pausable.paused.into();
        if paused {
            return err!(StockcardError::MarketBlocked);
        }
    }
    if let Ok(hook) = state.get_extension::<spl_token_2022::extension::transfer_hook::TransferHook>() {
        let program_id: Option<Pubkey> = hook.program_id.into();
        if program_id.is_some() {
            return err!(StockcardError::MarketBlocked);
        }
    }
    Ok(())
}

// Vault reconciliation: frozen vault or vault balance below total_collateral blocks borrows.
pub fn assert_vault_solvent(vault: &InterfaceAccount<TokenAccount>, market: &Market) -> Result<()> {
    if vault.state == spl_token_2022::state::AccountState::Frozen {
        return err!(StockcardError::MarketBlocked);
    }
    if vault.amount < market.total_collateral {
        return err!(StockcardError::MarketBlocked);
    }
    Ok(())
}
