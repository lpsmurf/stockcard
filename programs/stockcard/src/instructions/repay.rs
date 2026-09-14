use crate::errors::StockcardError;
use crate::events::Repaid;
use crate::instructions::{accrue, reselect_apr};
use crate::oracle;
use crate::state::{Config, Market, Position, SignedPrice, PRICE_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, constraint = position.market == market.key() @ StockcardError::Unauthorized)]
    pub position: Account<'info, Position>,
    /// CHECK: collateral mint, address-constrained; extensions read manually.
    #[account(constraint = collateral_mint.key() == market.collateral_mint @ StockcardError::Unauthorized)]
    pub collateral_mint: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = payer_usdc.mint == config.usdc_mint @ StockcardError::Unauthorized,
        constraint = payer_usdc.owner == payer.key() @ StockcardError::Unauthorized,
    )]
    pub payer_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = usdc_vault.key() == config.usdc_vault @ StockcardError::Unauthorized)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = usdc_mint.key() == config.usdc_mint @ StockcardError::Unauthorized)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(seeds = [PRICE_SEED, market.key().as_ref()], bump)]
    pub signed_price: Option<Account<'info, SignedPrice>>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn repay_handler(ctx: Context<Repay>, amount: u64) -> Result<()> {
    require!(amount > 0, StockcardError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;

    let config = &mut ctx.accounts.config;
    let position = &mut ctx.accounts.position;
    accrue(position, config, now)?;

    // u64::MAX = repay all; overpayment is never taken (spec edge cases).
    let paid = std::cmp::min(amount, position.debt_principal);
    require!(paid > 0, StockcardError::ZeroAmount);

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.payer_usdc.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
            },
        ),
        paid,
        ctx.accounts.usdc_mint.decimals,
    )?;

    position.debt_principal -= paid;
    config.total_borrowed -= paid;

    let multiplier = oracle::multiplier_micro(&ctx.accounts.collateral_mint, now)?;
    reselect_apr(
        position,
        &ctx.accounts.market,
        multiplier,
        ctx.accounts.signed_price.as_ref().map(|p| p.as_ref()),
        now,
    )?;

    emit!(Repaid {
        market: ctx.accounts.market.key(),
        owner: position.owner,
        amount: paid,
    });
    Ok(())
}
