use crate::errors::StockcardError;
use crate::events::PriceSet;
use crate::state::{Config, Market, OracleKind, PriceSource, SignedPrice, PRICE_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetSignedPrice<'info> {
    #[account(mut, constraint = config.price_signer == signer.key() @ StockcardError::Unauthorized)]
    pub signer: Signer<'info>,
    pub config: Account<'info, Config>,
    #[account(constraint = market.oracle_kind == OracleKind::Signed @ StockcardError::WrongOracle)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + SignedPrice::LEN,
        seeds = [PRICE_SEED, market.key().as_ref()],
        bump,
    )]
    pub signed_price: Account<'info, SignedPrice>,
    pub system_program: Program<'info, System>,
}

pub fn set_signed_price_handler(ctx: Context<SetSignedPrice>, price: i64, expo: i32, source: PriceSource) -> Result<()> {
    require!(price > 0, StockcardError::InvalidPrice);
    require!((-12..=0).contains(&expo), StockcardError::InvalidPrice);
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.signed_price;
    p.market = ctx.accounts.market.key();
    p.price = price;
    p.expo = expo;
    p.publish_time = now;
    p.source = source;
    emit!(PriceSet {
        market: p.market,
        price,
        expo,
        source,
    });
    Ok(())
}
