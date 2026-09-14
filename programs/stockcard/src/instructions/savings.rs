use crate::errors::StockcardError;
use crate::math;
use crate::state::{Config, SavingsPosition, CONFIG_SEED, SAVINGS_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

#[derive(Accounts)]
pub struct DepositSavings<'info> {
    #[account(mut)]
    pub saver: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut, constraint = usdc_vault.key() == config.usdc_vault @ StockcardError::Unauthorized)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = saver_usdc.mint == config.usdc_mint @ StockcardError::Unauthorized,
        constraint = saver_usdc.owner == saver.key() @ StockcardError::Unauthorized,
    )]
    pub saver_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = usdc_mint.key() == config.usdc_mint @ StockcardError::Unauthorized)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed,
        payer = saver,
        space = 8 + SavingsPosition::LEN,
        seeds = [SAVINGS_SEED, saver.key().as_ref()],
        bump,
    )]
    pub savings_position: Account<'info, SavingsPosition>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_savings_handler(ctx: Context<DepositSavings>, amount: u64) -> Result<()> {
    require!(amount > 0, StockcardError::ZeroAmount);
    let config = &mut ctx.accounts.config;
    let pool_value = math::pool_value(ctx.accounts.usdc_vault.amount, config.total_borrowed, config.reserve)?;
    let shares = math::shares_for_deposit(amount, config.total_shares, pool_value)?;
    require!(shares > 0, StockcardError::ZeroAmount);

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.saver_usdc.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.saver.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let position = &mut ctx.accounts.savings_position;
    if position.owner == Pubkey::default() {
        position.owner = ctx.accounts.saver.key();
        position.bump = ctx.bumps.savings_position;
    }
    position.shares = position
        .shares
        .checked_add(shares)
        .ok_or(error!(StockcardError::MathOverflow))?;
    config.total_shares = config
        .total_shares
        .checked_add(shares)
        .ok_or(error!(StockcardError::MathOverflow))?;
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawSavings<'info> {
    #[account(mut)]
    pub saver: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut, constraint = usdc_vault.key() == config.usdc_vault @ StockcardError::Unauthorized)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = saver_usdc.mint == config.usdc_mint @ StockcardError::Unauthorized,
        constraint = saver_usdc.owner == saver.key() @ StockcardError::Unauthorized,
    )]
    pub saver_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = usdc_mint.key() == config.usdc_mint @ StockcardError::Unauthorized)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [SAVINGS_SEED, saver.key().as_ref()],
        bump = savings_position.bump,
        constraint = savings_position.owner == saver.key() @ StockcardError::Unauthorized,
    )]
    pub savings_position: Account<'info, SavingsPosition>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn withdraw_savings_handler(ctx: Context<WithdrawSavings>, shares: u64) -> Result<()> {
    require!(shares > 0, StockcardError::ZeroAmount);
    let config = &mut ctx.accounts.config;
    let position = &mut ctx.accounts.savings_position;
    require!(shares <= position.shares, StockcardError::InsufficientCollateral);

    let pool_value = math::pool_value(ctx.accounts.usdc_vault.amount, config.total_borrowed, config.reserve)?;
    let amount = math::amount_for_shares(shares, config.total_shares, pool_value)?;
    require!(amount > 0, StockcardError::ZeroAmount);

    let idle = ctx
        .accounts
        .usdc_vault
        .amount
        .checked_sub(config.reserve)
        .ok_or(error!(StockcardError::InsufficientLiquidity))?;
    require!(idle >= amount, StockcardError::InsufficientLiquidity);

    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, &[config.bump]]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.saver_usdc.to_account_info(),
                authority: config.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    position.shares -= shares;
    config.total_shares -= shares;
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimReserve<'info> {
    #[account(mut, constraint = config.admin == admin.key() @ StockcardError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut, constraint = usdc_vault.key() == config.usdc_vault @ StockcardError::Unauthorized)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = admin_usdc.mint == config.usdc_mint @ StockcardError::Unauthorized,
        constraint = admin_usdc.owner == admin.key() @ StockcardError::Unauthorized,
    )]
    pub admin_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(constraint = usdc_mint.key() == config.usdc_mint @ StockcardError::Unauthorized)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn claim_reserve_handler(ctx: Context<ClaimReserve>, amount: u64) -> Result<()> {
    require!(amount > 0, StockcardError::ZeroAmount);
    let config = &mut ctx.accounts.config;
    require!(amount <= config.reserve, StockcardError::InsufficientLiquidity);

    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, &[config.bump]]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.admin_usdc.to_account_info(),
                authority: config.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    config.reserve -= amount;
    Ok(())
}
