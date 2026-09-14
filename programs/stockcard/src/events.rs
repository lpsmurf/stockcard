use crate::state::PriceSource;
use anchor_lang::prelude::*;

#[event]
pub struct Deposited {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Withdrawn {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Borrowed {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Repaid {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Liquidated {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub liquidator: Pubkey,
    pub repay_amount: u64,
    pub seized: u64,
}

#[event]
pub struct CashbackDeposited {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PriceSet {
    pub market: Pubkey,
    pub price: i64,
    pub expo: i32,
    pub source: PriceSource,
}
