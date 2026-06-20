use anchor_lang::prelude::*;

pub const AUTOPILOT_OUTCOME_SKIP: u8 = 0;
pub const AUTOPILOT_OUTCOME_BUY: u8 = 1;
pub const AUTOPILOT_OUTCOME_SELL: u8 = 2;

pub const AUTOPILOT_SKIP_NONE: u8 = 0;
pub const AUTOPILOT_SKIP_INACTIVE: u8 = 1;
pub const AUTOPILOT_SKIP_VOLATILITY: u8 = 2;
pub const AUTOPILOT_SKIP_DRAWDOWN: u8 = 3;
pub const AUTOPILOT_SKIP_COOLDOWN: u8 = 4;
pub const AUTOPILOT_SKIP_DAILY_LIMIT: u8 = 5;
pub const AUTOPILOT_SKIP_NO_SIGNAL: u8 = 6;

#[event]
pub struct AutopilotTick {
    pub authority: Pubkey,
    pub pool: Pubkey,
    pub outcome: u8,
    pub skip_reason: u8,
    pub amount_in: u64,
    pub amount_out: u64,
}
