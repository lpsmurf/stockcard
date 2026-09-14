use crate::errors::StockcardError;
use crate::events::Withdrawn;
use crate::instructions::{accrue, reselect_apr};
use crate::math;
use crate::oracle;
use crate::state::{Config, Market, Position, SignedPrice, PRICE_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
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
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = owner_token.mint == collateral_mint.key() @ StockcardError::Unauthorized,
        constraint = owner_token.owner == owner.key() @ StockcardError::Unauthorized,
    )]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = collateral_vault.key() == market.collateral_vault @ StockcardError::Unauthorized)]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(seeds = [PRICE_SEED, market.key().as_ref()], bump)]
    pub signed_price: Option<Account<'info, SignedPrice>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn withdraw_handler(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
    require!(amount > 0, StockcardError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;

    let position = &mut ctx.accounts.position;
    accrue(position, &mut ctx.accounts.config, now)?;
    require!(amount <= position.collateral_amount, StockcardError::InsufficientCollateral);

    let multiplier = oracle::multiplier_micro(&ctx.accounts.collateral_mint.to_account_info(), now)?;
    if position.debt_principal > 0 {
        let signed_price = ctx
            .accounts
            .signed_price
            .as_ref()
            .ok_or(error!(StockcardError::WrongOracle))?;
        let quote = oracle::checked_price(&ctx.accounts.market, signed_price, now)?;
        let remaining = position.collateral_amount - amount;
        let value = math::collateral_value_usd6(
            remaining,
            multiplier,
            quote.price_usd6,
            quote.effective_haircut_bps,
            ctx.accounts.market.decimals,
        )?;
        let ltv = math::ltv_bps(position.debt_principal, value)?;
        require!(
            ltv <= ctx.accounts.market.max_ltv_bps as u64,
            StockcardError::InsufficientCollateral
        );
    }

    let mint_key = ctx.accounts.collateral_mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        crate::state::MARKET_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.market.bump],
    ]];
    let decimals = ctx.accounts.collateral_mint.decimals;
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.collateral_vault.to_account_info(),
                to: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        decimals,
    )?;

    position.collateral_amount -= amount;
    let market = &mut ctx.accounts.market;
    market.total_collateral -= amount;

    reselect_apr(
        position,
        market,
        multiplier,
        ctx.accounts.signed_price.as_ref().map(|p| p.as_ref()),
        now,
    )?;

    emit!(Withdrawn {
        market: market.key(),
        owner: position.owner,
        amount,
    });
    Ok(())
}
