use crate::errors::StockcardError;
use crate::events::Liquidated;
use crate::instructions::accrue;
use crate::math;
use crate::oracle;
use crate::state::{Config, Market, Position, SignedPrice, MARKET_SEED, PRICE_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, constraint = position.market == market.key() @ StockcardError::Unauthorized)]
    pub position: Account<'info, Position>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = liquidator_usdc.mint == config.usdc_mint @ StockcardError::Unauthorized,
        constraint = liquidator_usdc.owner == liquidator.key() @ StockcardError::Unauthorized,
    )]
    pub liquidator_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = usdc_vault.key() == config.usdc_vault @ StockcardError::Unauthorized)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = usdc_mint.key() == config.usdc_mint @ StockcardError::Unauthorized)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = liquidator_collateral.mint == market.collateral_mint @ StockcardError::Unauthorized,
        constraint = liquidator_collateral.owner == liquidator.key() @ StockcardError::Unauthorized,
    )]
    pub liquidator_collateral: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = collateral_vault.key() == market.collateral_vault @ StockcardError::Unauthorized)]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        seeds = [PRICE_SEED, market.key().as_ref()],
        bump,
        constraint = signed_price.market == market.key() @ StockcardError::WrongOracle,
    )]
    pub signed_price: Account<'info, SignedPrice>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn liquidate_handler(ctx: Context<Liquidate>, repay_amount: u64) -> Result<()> {
    require!(repay_amount > 0, StockcardError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;

    let config = &mut ctx.accounts.config;
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    accrue(position, config, now)?;

    let quote = oracle::checked_price(market, &ctx.accounts.signed_price, now)?;
    let multiplier = oracle::multiplier_micro(&ctx.accounts.collateral_mint.to_account_info(), now)?;
    let value = math::collateral_value_usd6(
        position.collateral_amount,
        multiplier,
        quote.price_usd6,
        quote.effective_haircut_bps,
        market.decimals,
    )?;
    let ltv = math::ltv_bps(position.debt_principal, value)?;
    require!(ltv > market.liq_threshold_bps as u64, StockcardError::NotLiquidatable);

    let max_repay = (position.debt_principal as u128)
        .checked_mul(config.close_factor_bps as u128)
        .ok_or(error!(StockcardError::MathOverflow))?
        / math::BPS;
    require!(
        (repay_amount as u128) <= max_repay,
        StockcardError::ExceedsCloseFactor
    );

    let seize = math::seize_amount(
        repay_amount,
        market.liq_bonus_bps,
        quote.price_usd6,
        multiplier,
        market.decimals,
    )?;
    let seize = std::cmp::min(seize, position.collateral_amount);

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.liquidator_usdc.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.liquidator.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
            },
        ),
        repay_amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let mint_key = market.collateral_mint;
    let signer_seeds: &[&[&[u8]]] = &[&[MARKET_SEED, mint_key.as_ref(), &[market.bump]]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.collateral_token_program.key(),
            TransferChecked {
                from: ctx.accounts.collateral_vault.to_account_info(),
                to: ctx.accounts.liquidator_collateral.to_account_info(),
                authority: market.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
            },
            signer_seeds,
        ),
        seize,
        market.decimals,
    )?;

    position.debt_principal -= repay_amount;
    position.collateral_amount -= seize;
    config.total_borrowed -= repay_amount;
    market.total_collateral -= seize;

    // Reselect band with the post-liquidation LTV (price is fresh here).
    let new_value = math::collateral_value_usd6(
        position.collateral_amount,
        multiplier,
        quote.price_usd6,
        quote.effective_haircut_bps,
        market.decimals,
    )?;
    let new_ltv = math::ltv_bps(position.debt_principal, new_value)?;
    position.apr_bps = math::select_apr_bps(&market.apr_bands, new_ltv);

    emit!(Liquidated {
        market: market.key(),
        owner: position.owner,
        liquidator: ctx.accounts.liquidator.key(),
        repay_amount,
        seized: seize,
    });
    Ok(())
}
