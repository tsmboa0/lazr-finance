use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct QuoteState {
    pub pool: Pubkey,
    pub fair_price_e8: i64,
    pub executable_price_e8: i64,
    pub bid_price_e8: i64,
    pub ask_price_e8: i64,
    pub spread_bps: u64,
    pub last_update_slot: u64,
    pub last_update_ts: i64,
    pub bump: u8,
}
