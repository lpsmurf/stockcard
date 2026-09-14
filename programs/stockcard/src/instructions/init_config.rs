use crate::errors::StockcardError;
use crate::state::{Config, CONFIG_SEED, USDC_VAULT_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::LEN,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = config,
        token::token_program = token_program,
        seeds = [USDC_VAULT_SEED],
        bump,
    )]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn init_config_handler(
    ctx: Context<InitConfig>,
    protocol_share_bps: u16,
    max_utilization_bps: u16,
    close_factor_bps: u16,
    cashback_authority: Pubkey,
    price_signer: Pubkey,
) -> Result<()> {
    require!(protocol_share_bps <= 10_000, StockcardError::InvalidRiskParams);
    require!(max_utilization_bps <= 10_000, StockcardError::InvalidRiskParams);
    require!(close_factor_bps <= 10_000, StockcardError::InvalidRiskParams);
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.usdc_vault = ctx.accounts.usdc_vault.key();
    config.protocol_share_bps = protocol_share_bps;
    config.max_utilization_bps = max_utilization_bps;
    config.total_borrowed = 0;
    config.total_shares = 0;
    config.reserve = 0;
    config.close_factor_bps = close_factor_bps;
    config.cashback_authority = cashback_authority;
    config.price_signer = price_signer;
    config.paused = false;
    config.bump = ctx.bumps.config;
    Ok(())
}
