use anchor_lang::prelude::*;

#[error_code]
pub enum PropAmmError {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Math underflow")]
    MathUnderflow,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Pool is paused")]
    PoolPaused,
    #[msg("Pool is not paused")]
    PoolNotPaused,
    #[msg("Oracle price is stale")]
    StaleOracle,
    #[msg("Oracle price is invalid")]
    InvalidOraclePrice,
    #[msg("Quote is stale")]
    StaleQuote,
    #[msg("Spread exceeds maximum")]
    SpreadExceedsMax,
    #[msg("Trade size exceeds maximum")]
    TradeSizeExceedsMax,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Insufficient user balance")]
    InsufficientUserBalance,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid pool state")]
    InvalidPoolState,
    #[msg("Invalid config parameter")]
    InvalidConfigParam,
    #[msg("User bank is full (max 20 tokens)")]
    BankFull,
    #[msg("Token not found in user bank")]
    TokenNotFound,
    #[msg("Invalid swap direction")]
    InvalidSwapDirection,
    #[msg("Swap order not pending")]
    SwapOrderNotPending,
    #[msg("Invalid oracle account")]
    InvalidOracleAccount,
    #[msg("Volatility window size exceeds maximum")]
    VolatilityWindowTooLarge,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Vault solvency check failed")]
    VaultInsolvency,
}
