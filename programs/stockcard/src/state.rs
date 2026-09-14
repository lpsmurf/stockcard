use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const USDC_VAULT_SEED: &[u8] = b"usdc_vault";
pub const MARKET_SEED: &[u8] = b"market";
pub const COLLATERAL_VAULT_SEED: &[u8] = b"collateral_vault";
pub const PRICE_SEED: &[u8] = b"price";
pub const POSITION_SEED: &[u8] = b"position";
pub const SAVINGS_SEED: &[u8] = b"savings";

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AssetClass {
    Equity,
    ArtNote,
    Collectible,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OracleKind {
    Signed,
    Switchboard,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PriceSource {
    Market,
    Appraisal,
    PartnerFmv,
    Demo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct RateBand {
    pub max_ltv_bps: u16,
    pub apr_bps: u16,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub usdc_vault: Pubkey,
    pub protocol_share_bps: u16,
    pub max_utilization_bps: u16,
    pub total_borrowed: u64,
    pub total_shares: u64,
    pub reserve: u64,
    pub close_factor_bps: u16,
    pub cashback_authority: Pubkey,
    pub price_signer: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

impl Config {
    pub const LEN: usize = 32 + 32 + 32 + 2 + 2 + 8 + 8 + 8 + 2 + 32 + 32 + 1 + 1;
}

#[account]
pub struct Market {
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub asset_class: AssetClass,
    pub oracle_kind: OracleKind,
    pub oracle_feed: Pubkey,
    pub max_ltv_bps: u16,
    pub liq_threshold_bps: u16,
    pub liq_bonus_bps: u16,
    pub haircut_bps: u16,
    pub apr_bands: [RateBand; 3],
    pub max_price_age_secs: u32,
    pub closed_market_age_secs: u32,
    pub closed_haircut_bps: u16,
    pub total_collateral: u64,
    pub decimals: u8,
    pub has_permanent_delegate: bool,
    pub has_transfer_hook: bool,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 32 + 32 + 1 + 1 + 32 + 2 + 2 + 2 + 2 + 12 + 4 + 4 + 2 + 8 + 1 + 1 + 1 + 1;
}

#[account]
pub struct SignedPrice {
    pub market: Pubkey,
    pub price: i64,
    pub expo: i32,
    pub publish_time: i64,
    pub source: PriceSource,
}

impl SignedPrice {
    pub const LEN: usize = 32 + 8 + 4 + 8 + 1;
}

#[account]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub collateral_amount: u64,
    pub debt_principal: u64,
    pub last_accrual_ts: i64,
    pub apr_bps: u16,
    pub bump: u8,
}

impl Position {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 8 + 2 + 1;
}

#[account]
pub struct SavingsPosition {
    pub owner: Pubkey,
    pub shares: u64,
    pub bump: u8,
}

impl SavingsPosition {
    pub const LEN: usize = 32 + 8 + 1;
}
