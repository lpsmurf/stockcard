use anchor_lang::prelude::*;

#[error_code]
pub enum StockcardError {
    #[msg("This wallet isn't allowed to do that.")]
    Unauthorized,
    #[msg("Borrowing is paused. Repayments still work.")]
    Paused,
    #[msg("Price is stale.")]
    StalePrice,
    #[msg("Price must be positive.")]
    InvalidPrice,
    #[msg("That's more than your credit line.")]
    ExceedsMaxLtv,
    #[msg("This position is healthy.")]
    NotLiquidatable,
    #[msg("Repay amount exceeds the close factor.")]
    ExceedsCloseFactor,
    #[msg("The pool can't lend that much right now.")]
    InsufficientLiquidity,
    #[msg("Borrowing is full right now.")]
    PoolUtilizationCap,
    #[msg("Not enough collateral or shares.")]
    InsufficientCollateral,
    #[msg("Invalid risk parameters.")]
    InvalidRiskParams,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("Amount must be greater than zero.")]
    ZeroAmount,
    #[msg("Wrong oracle account for this market.")]
    WrongOracle,
    #[msg("Market blocked by issuer controls or impaired vault.")]
    MarketBlocked,
}
