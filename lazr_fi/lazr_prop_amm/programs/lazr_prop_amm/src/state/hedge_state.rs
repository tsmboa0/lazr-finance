use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct HedgeState {
    pub pool: Pubkey,
    pub target_inventory_bps: u64,
    pub soft_limit_bps: u64,
    pub hard_limit_bps: u64,
    pub hedge_required: bool,
    pub last_hedge_ts: i64,
    pub bump: u8,
}
