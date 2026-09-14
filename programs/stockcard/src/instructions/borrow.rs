use crate::errors::StockcardError;
use crate::events::Borrowed;
use crate::instructions::accrue;
use crate::math;
use crate::oracle;
use crate::state::{Config, Market, Position, SignedPrice, CONFIG_SEED, PRICE_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, constraint = !config.paused @ StockcardError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        constraint = position.owner == owner.key() @ StockcardError::Unauthorized,
        constraint = position.market == market.key() @ StockcardError::Unauthorized,
    )]
    pub position: Account<'info, Position>,
    /// CHECK: collateral mint, address-constrained; extensions read manually.
    #[account(constraint = collateral_mint.key() == market.collateral_mint @ StockcardError::Unauthorized)]
    pub collateral_mint: UncheckedAccount<'info>,
    #[account(mut, constraint = usdc_vault.key() == config.usdc_vault @ StockcardError::Unauthorized)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = usdc_mint.key() == config.usdc_mint @ StockcardError::Unauthorized)]
    pub usdc_mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,
    #[account(
        mut,
        constraint = destination_usdc.mint == config.usdc_mint @ StockcardError::Unauthorized,
    )]
    pub destination_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(
        seeds = [PRICE_SEED, market.key().as_ref()],
        bump,
        constraint = signed_price.market == market.key() @ StockcardError::WrongOracle,
    )]
    pub signed_price: Account<'info, SignedPrice>,
    #[account(mut, constraint = collateral_vault.key() == market.collateral_vault @ StockcardError::Unauthorized)]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn borrow_handler(ctx: Context<Borrow>, amount: u64) -> Result<()> {
    require!(amount > 0, StockcardError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;

    let config = &mut ctx.accounts.config;
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    accrue(position, config, now)?;

    // Issuer controls: paused mint, transfer hook, frozen/impaired vault block borrows.
    oracle::assert_mint_transferable(&ctx.accounts.collateral_mint)?;
    oracle::assert_vault_solvent(&ctx.accounts.collateral_vault, market)?;

    let quote = oracle::checked_price(market, &ctx.accounts.signed_price, now)?;
    let multiplier = oracle::multiplier_micro(&ctx.accounts.collateral_mint, now)?;
    let value = math::collateral_value_usd6(
        position.collateral_amount,
        multiplier,
        quote.price_usd6,
        quote.effective_haircut_bps,
        market.decimals,
    )?;
    let new_debt = position
        .debt_principal
        .checked_add(amount)
        .ok_or(error!(StockcardError::MathOverflow))?;
    let ltv = math::ltv_bps(new_debt, value)?;
    require!(ltv <= market.max_ltv_bps as u64, StockcardError::ExceedsMaxLtv);

    let pool_value = math::pool_value(ctx.accounts.usdc_vault.amount, config.total_borrowed, config.reserve)?;
    let utilization = math::utilization_bps(
        config
            .total_borrowed
            .checked_add(amount)
            .ok_or(error!(StockcardError::MathOverflow))?,
        pool_value,
    )?;
    require!(
        utilization <= config.max_utilization_bps as u64,
        StockcardError::PoolUtilizationCap
    );
    let idle = ctx
        .accounts
        .usdc_vault
        .amount
        .checked_sub(config.reserve)
        .ok_or(error!(StockcardError::InsufficientLiquidity))?;
    require!(idle >= amount, StockcardError::InsufficientLiquidity);

    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, &[config.bump]]];
    let usdc_decimals = ctx.accounts.usdc_mint.decimals;
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.destination_usdc.to_account_info(),
                authority: config.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        usdc_decimals,
    )?;

    position.debt_principal = new_debt;
    config.total_borrowed = config
        .total_borrowed
        .checked_add(amount)
        .ok_or(error!(StockcardError::MathOverflow))?;
    position.apr_bps = math::select_apr_bps(&market.apr_bands, ltv);

    emit!(Borrowed {
        market: market.key(),
        owner: position.owner,
        amount,
    });
    Ok(())
}
