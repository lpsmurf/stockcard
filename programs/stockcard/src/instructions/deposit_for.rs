use crate::errors::StockcardError;
use crate::events::CashbackDeposited;
use crate::instructions::{accrue, reselect_apr};
use crate::oracle;
use crate::state::{Config, Market, Position, SignedPrice, POSITION_SEED, PRICE_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
#[instruction(owner: Pubkey)]
pub struct DepositCollateralFor<'info> {
    #[account(mut, constraint = config.cashback_authority == authority.key() @ StockcardError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Position::LEN,
        seeds = [POSITION_SEED, market.key().as_ref(), owner.as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = source_token.mint == collateral_mint.key() @ StockcardError::Unauthorized,
        constraint = source_token.owner == authority.key() @ StockcardError::Unauthorized,
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = collateral_vault.key() == market.collateral_vault @ StockcardError::Unauthorized)]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(seeds = [PRICE_SEED, market.key().as_ref()], bump)]
    pub signed_price: Option<Account<'info, SignedPrice>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_for_handler(ctx: Context<DepositCollateralFor>, owner: Pubkey, amount: u64) -> Result<()> {
    require!(amount > 0, StockcardError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;

    let position = &mut ctx.accounts.position;
    if position.owner == Pubkey::default() {
        position.owner = owner;
        position.market = ctx.accounts.market.key();
        position.collateral_amount = 0;
        position.debt_principal = 0;
        position.last_accrual_ts = now;
        position.apr_bps = crate::math::select_apr_bps(&ctx.accounts.market.apr_bands, 0);
        position.bump = ctx.bumps.position;
    }
    accrue(position, &mut ctx.accounts.config, now)?;

    let decimals = ctx.accounts.collateral_mint.decimals;
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.source_token.to_account_info(),
                to: ctx.accounts.collateral_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
            },
        ),
        amount,
        decimals,
    )?;

    position.collateral_amount = position
        .collateral_amount
        .checked_add(amount)
        .ok_or(error!(StockcardError::MathOverflow))?;
    let market = &mut ctx.accounts.market;
    market.total_collateral = market
        .total_collateral
        .checked_add(amount)
        .ok_or(error!(StockcardError::MathOverflow))?;

    let multiplier = oracle::multiplier_micro(&ctx.accounts.collateral_mint.to_account_info(), now)?;
    reselect_apr(
        position,
        market,
        multiplier,
        ctx.accounts.signed_price.as_ref().map(|p| p.as_ref()),
        now,
    )?;

    emit!(CashbackDeposited {
        market: market.key(),
        owner,
        amount,
    });
    Ok(())
}
