use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::math::{
    compute_bid_ask_e8, compute_cubic_penalty_bps, compute_inventory_deviation_bps,
    compute_inventory_ratio_bps, compute_spread_bps, fixed_point::i64_to_e8,
    volatility::compute_realized_volatility_bps,
};
use crate::oracle::pyth_lazer::{read_pyth_lazer_price, validate_oracle_staleness};
use crate::state::*;

#[derive(Accounts)]
pub struct ProcessCrankTick<'info> {
    #[account(
        mut,
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump,
        constraint = !pool.paused @ PropAmmError::PoolPaused
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        seeds = [CONFIG_SEED, pool.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [QUOTE_STATE_SEED, pool.key().as_ref()],
        bump = quote_state.bump
    )]
    pub quote_state: Account<'info, QuoteState>,

    #[account(
        mut,
        seeds = [RISK_STATE_SEED, pool.key().as_ref()],
        bump = risk_state.bump
    )]
    pub risk_state: Account<'info, RiskState>,

    #[account(
        mut,
        seeds = [VOLATILITY_STATE_SEED, pool.key().as_ref()],
        bump = volatility_state.bump
    )]
    pub volatility_state: Account<'info, VolatilityState>,

    #[account(
        mut,
        seeds = [HEDGE_STATE_SEED, pool.key().as_ref()],
        bump = hedge_state.bump
    )]
    pub hedge_state: Account<'info, HedgeState>,

    /// CHECK: Pyth Lazer oracle feed account
    pub oracle_feed: UncheckedAccount<'info>,

    #[account(
        address = pool.asset_vault @ PropAmmError::InvalidPoolState
    )]
    pub asset_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        address = pool.usdc_vault @ PropAmmError::InvalidPoolState
    )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,
}

pub fn handler(ctx: Context<ProcessCrankTick>) -> Result<()> {
    let config = &ctx.accounts.config;
    let pool = &ctx.accounts.pool;
    let clock = Clock::get()?;

    let oracle_price = read_pyth_lazer_price(&ctx.accounts.oracle_feed.to_account_info())?;

    validate_oracle_staleness(
        oracle_price.timestamp,
        clock.unix_timestamp,
        config.max_oracle_staleness_sec,
    )?;

    let fair_price_e8 = i64_to_e8(oracle_price.price, pool.oracle_exponent)?;
    require!(fair_price_e8 > 0, PropAmmError::InvalidOraclePrice);

    let vol_state = &mut ctx.accounts.volatility_state;
    {
        let window_size = config.volatility_window_size;
        let max_size = (window_size as usize).min(crate::state::volatility_state::MAX_VOLATILITY_WINDOW);

        if vol_state.prices.len() < max_size {
            vol_state.prices.push(fair_price_e8);
            vol_state.count = vol_state.prices.len() as u8;
        } else {
            let idx = (vol_state.current_index as usize) % max_size;
            vol_state.prices[idx] = fair_price_e8;
        }
        vol_state.current_index = (vol_state.current_index.wrapping_add(1)) % (max_size as u8);
    }
    vol_state.realized_volatility_bps =
        compute_realized_volatility_bps(&vol_state.prices, vol_state.count)?;
    vol_state.last_update_ts = clock.unix_timestamp;

    let asset_vault_balance = ctx.accounts.asset_vault.amount;
    let usdc_vault_balance = ctx.accounts.usdc_vault.amount;

    let inventory_ratio_bps =
        compute_inventory_ratio_bps(asset_vault_balance, usdc_vault_balance, fair_price_e8)?;

    let inventory_deviation_bps =
        compute_inventory_deviation_bps(inventory_ratio_bps, config.target_inventory_bps);

    let inventory_penalty_bps =
        compute_cubic_penalty_bps(inventory_deviation_bps, config.lambda)?;

    let spread_bps = compute_spread_bps(
        config.base_spread_bps,
        inventory_penalty_bps,
        vol_state.realized_volatility_bps,
        config.max_spread_bps,
    )?;

    let inventory_skew_bps = inventory_penalty_bps.clamp(
        -(config.max_spread_bps as i64),
        config.max_spread_bps as i64,
    );
    let (bid_price_e8, ask_price_e8) =
        compute_bid_ask_e8(fair_price_e8, spread_bps, inventory_skew_bps)?;

    let risk_state = &mut ctx.accounts.risk_state;
    risk_state.inventory_ratio_bps = inventory_ratio_bps;
    risk_state.inventory_deviation_bps = inventory_deviation_bps;
    risk_state.inventory_penalty_bps = inventory_penalty_bps;
    risk_state.volatility_bps = vol_state.realized_volatility_bps;
    risk_state.oracle_confidence_bps = oracle_price.confidence;
    risk_state.last_update_ts = clock.unix_timestamp;
    risk_state.last_update_slot = clock.slot;

    let quote_state = &mut ctx.accounts.quote_state;
    quote_state.fair_price_e8 = fair_price_e8;
    quote_state.executable_price_e8 = fair_price_e8;
    quote_state.bid_price_e8 = bid_price_e8;
    quote_state.ask_price_e8 = ask_price_e8;
    quote_state.spread_bps = spread_bps;
    quote_state.last_update_slot = clock.slot;
    quote_state.last_update_ts = clock.unix_timestamp;

    let hedge_state = &mut ctx.accounts.hedge_state;
    let abs_ratio = if inventory_ratio_bps >= 0 {
        inventory_ratio_bps as u64
    } else {
        0
    };

    if abs_ratio >= hedge_state.hard_limit_bps {
        hedge_state.hedge_required = true;
    } else if abs_ratio >= hedge_state.soft_limit_bps {
        hedge_state.hedge_required = false;
    } else {
        hedge_state.hedge_required = false;
    }

    Ok(())
}
