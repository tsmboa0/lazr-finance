use anchor_lang::prelude::*;

#[constant]
pub const ADMIN_SEED: &[u8] = b"admin";
#[constant]
pub const POOL_SEED: &[u8] = b"pool";
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const QUOTE_STATE_SEED: &[u8] = b"quote_state";
#[constant]
pub const RISK_STATE_SEED: &[u8] = b"risk_state";
#[constant]
pub const VOLATILITY_STATE_SEED: &[u8] = b"volatility_state";
#[constant]
pub const HEDGE_STATE_SEED: &[u8] = b"hedge_state";
#[constant]
pub const USER_BANK_SEED: &[u8] = b"user_bank";
#[constant]
pub const ASSET_VAULT_SEED: &[u8] = b"asset_vault";
#[constant]
pub const USDC_VAULT_SEED: &[u8] = b"usdc_vault";

pub const DEFAULT_TARGET_INVENTORY_BPS: u64 = 5000;
pub const DEFAULT_BASE_SPREAD_BPS: u64 = 5;
pub const DEFAULT_MAX_SPREAD_BPS: u64 = 200;
pub const DEFAULT_VIRTUAL_DEPTH_K: u64 = 1_000_000_000;
pub const DEFAULT_VOLATILITY_WINDOW_SIZE: u8 = 32;
pub const DEFAULT_CRANK_INTERVAL_MS: u64 = 50;
/// MagicBlock ScheduleTask: iterations == 0 runs until cancelled.
pub const CRANK_INFINITE_ITERATIONS: i64 = 0;
pub const DEFAULT_MAX_TRADE_SIZE: u64 = 1_000_000_000_000;
pub const DEFAULT_LAMBDA: u64 = 100;
pub const DEFAULT_MAX_ORACLE_STALENESS_SEC: u64 = 10;

pub const HEDGE_SOFT_LIMIT_BPS: u64 = 7000;
pub const HEDGE_HARD_LIMIT_BPS: u64 = 8500;

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const E8_PRECISION: i128 = 100_000_000;

pub const PRICE_ORACLE_PROGRAM: &str = "PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd";
pub const PRICE_FEED_SEED_PREFIX: &[u8] = b"price_feed";
pub const PRICE_FEED_PROVIDER: &[u8] = b"pyth-lazer";
pub const PRICE_DATA_OFFSET: usize = 73;
pub const PRICE_TIMESTAMP_OFFSET: usize = 93;
