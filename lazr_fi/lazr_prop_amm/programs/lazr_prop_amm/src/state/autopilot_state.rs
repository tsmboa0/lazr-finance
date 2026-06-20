use anchor_lang::prelude::*;

pub const AUTOPILOT_STATUS_INACTIVE: u8 = 0;
pub const AUTOPILOT_STATUS_ACTIVE: u8 = 1;
pub const AUTOPILOT_STATUS_PAUSED: u8 = 2;
pub const AUTOPILOT_STATUS_STOPPED: u8 = 3;

pub const AUTOPILOT_STRATEGY_CONSERVATIVE: u8 = 0;
pub const AUTOPILOT_STRATEGY_BALANCED: u8 = 1;
pub const AUTOPILOT_STRATEGY_AGGRESSIVE: u8 = 2;

#[derive(Clone, Copy)]
pub struct AutopilotParams {
    pub target_asset_bps: u32,
    pub buy_band_bps: u32,
    pub sell_band_bps: u32,
    pub max_trade_bps: u32,
    pub min_edge_bps: u32,
    pub cooldown_sec: u32,
    pub max_trades_per_day: u16,
    pub tick_interval_ms: u32,
    pub pause_vol_bps: u32,
    pub stop_drawdown_bps: u32,
}

#[account]
#[derive(InitSpace)]
pub struct AutopilotState {
    pub authority: Pubkey,
    pub pool: Pubkey,
    pub asset_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub status: u8,
    pub strategy: u8,
    /// Max USDC budget the bot manages (raw token units).
    pub allocated_usdc: u64,
    pub target_asset_bps: u32,
    pub buy_band_bps: u32,
    pub sell_band_bps: u32,
    pub max_trade_bps: u32,
    pub min_edge_bps: u32,
    pub cooldown_sec: u32,
    pub max_trades_per_day: u16,
    pub tick_interval_ms: u32,
    pub pause_vol_bps: u32,
    pub stop_drawdown_bps: u32,
    pub last_fair_price_e8: i64,
    pub last_trade_ts: i64,
    pub trades_today: u16,
    pub trades_day_start_ts: i64,
    pub starting_nav_usdc: u64,
    pub high_water_nav_usdc: u64,
    pub total_trades: u32,
    pub crank_task_id: i64,
    pub bump: u8,
}

impl AutopilotState {
    pub fn is_active(&self) -> bool {
        self.status == AUTOPILOT_STATUS_ACTIVE
    }

    pub fn apply_params(&mut self, params: AutopilotParams) {
        self.target_asset_bps = params.target_asset_bps;
        self.buy_band_bps = params.buy_band_bps;
        self.sell_band_bps = params.sell_band_bps;
        self.max_trade_bps = params.max_trade_bps;
        self.min_edge_bps = params.min_edge_bps;
        self.cooldown_sec = params.cooldown_sec;
        self.max_trades_per_day = params.max_trades_per_day;
        self.tick_interval_ms = params.tick_interval_ms;
        self.pause_vol_bps = params.pause_vol_bps;
        self.stop_drawdown_bps = params.stop_drawdown_bps;
    }
}
