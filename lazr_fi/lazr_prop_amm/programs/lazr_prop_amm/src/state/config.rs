use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub pool: Pubkey,
    pub target_inventory_bps: u64,
    pub base_spread_bps: u64,
    pub max_spread_bps: u64,
    pub virtual_depth_k: u64,
    pub volatility_window_size: u8,
    pub crank_interval_ms: u64,
    pub max_trade_size: u64,
    pub lambda: u64,
    pub max_oracle_staleness_sec: u64,
    pub bump: u8,
}
