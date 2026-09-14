use crate::errors::StockcardError;
use crate::instructions::validate_risk_params;
use crate::oracle;
use crate::state::{AssetClass, Config, Market, OracleKind, RateBand, COLLATERAL_VAULT_SEED, MARKET_SEED};
use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use anchor_spl::token_2022::spl_token_2022::extension::BaseStateWithExtensions;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct AddMarket<'info> {
    #[account(mut, constraint = config.admin == admin.key() @ StockcardError::Unauthorized)]
    pub admin: Signer<'info>,
    pub config: Account<'info, Config>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = admin,
        space = 8 + Market::LEN,
        seeds = [MARKET_SEED, collateral_mint.key().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = admin,
        token::mint = collateral_mint,
        token::authority = market,
        token::token_program = token_program,
        seeds = [COLLATERAL_VAULT_SEED, market.key().as_ref()],
        bump,
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn add_market_handler(
    ctx: Context<AddMarket>,
    asset_class: AssetClass,
    oracle_kind: OracleKind,
    oracle_feed: Pubkey,
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

    // Issuer controls (integrations.md): record extension flags, reject hook-enabled mints.
    let mint_ai = ctx.accounts.collateral_mint.to_account_info();
    let (mut has_permanent_delegate, mut has_transfer_hook) = (false, false);
    if mint_ai.owner == &spl_token_2022::ID {
        let data = mint_ai.try_borrow_data()?;
        if let Ok(state) = spl_token_2022::extension::StateWithExtensions::<
            spl_token_2022::state::Mint,
        >::unpack(&data)
        {
            has_permanent_delegate = state
                .get_extension::<spl_token_2022::extension::permanent_delegate::PermanentDelegate>()
                .is_ok();
            if let Ok(hook) =
                state.get_extension::<spl_token_2022::extension::transfer_hook::TransferHook>()
            {
                let program_id: Option<Pubkey> = hook.program_id.into();
                has_transfer_hook = program_id.is_some();
            }
            oracle::assert_mint_transferable(&mint_ai)?;
        }
    }
    require!(!has_transfer_hook, StockcardError::MarketBlocked);

    let market = &mut ctx.accounts.market;
    market.collateral_mint = ctx.accounts.collateral_mint.key();
    market.collateral_vault = ctx.accounts.collateral_vault.key();
    market.asset_class = asset_class;
    market.oracle_kind = oracle_kind;
    market.oracle_feed = oracle_feed;
    market.max_ltv_bps = max_ltv_bps;
    market.liq_threshold_bps = liq_threshold_bps;
    market.liq_bonus_bps = liq_bonus_bps;
    market.haircut_bps = haircut_bps;
    market.apr_bands = apr_bands;
    market.max_price_age_secs = max_price_age_secs;
    market.closed_market_age_secs = closed_market_age_secs;
    market.closed_haircut_bps = closed_haircut_bps;
    market.total_collateral = 0;
    market.decimals = ctx.accounts.collateral_mint.decimals;
    market.has_permanent_delegate = has_permanent_delegate;
    market.has_transfer_hook = has_transfer_hook;
    market.bump = ctx.bumps.market;
    Ok(())
}
