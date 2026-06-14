use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RiskState {
    pub pool: Pubkey,
    pub inventory_ratio_bps: i64,
    pub inventory_deviation_bps: i64,
    pub inventory_penalty_bps: i64,
    pub volatility_bps: u64,
    pub oracle_confidence_bps: u64,
    pub last_update_ts: i64,
    pub last_update_slot: u64,
    pub bump: u8,
}
