use anchor_lang::prelude::*;

pub const MAX_VOLATILITY_WINDOW: usize = 32;

#[account]
#[derive(InitSpace)]
pub struct VolatilityState {
    pub pool: Pubkey,
    #[max_len(32)]
    pub prices: Vec<i64>,
    pub current_index: u8,
    pub count: u8,
    pub realized_volatility_bps: u64,
    pub last_update_ts: i64,
    pub bump: u8,
}
