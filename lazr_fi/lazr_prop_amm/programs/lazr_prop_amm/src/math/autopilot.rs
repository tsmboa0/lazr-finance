use anchor_lang::prelude::*;

use crate::constants::BPS_DENOMINATOR;
use crate::error::PropAmmError;
use crate::math::fixed_point::abs_i64;
use crate::math::inventory::compute_inventory_ratio_bps;
use crate::math::swap::{
    compute_swap_asset_for_usdc, compute_swap_usdc_for_asset, compute_virtual_reserves_e8,
};
use crate::state::{
    AutopilotParams, AutopilotState, AUTOPILOT_STRATEGY_AGGRESSIVE, AUTOPILOT_STRATEGY_BALANCED,
    AUTOPILOT_STRATEGY_CONSERVATIVE, AUTOPILOT_STATUS_PAUSED, AUTOPILOT_STATUS_STOPPED,
};
use crate::{
    AUTOPILOT_SKIP_COOLDOWN, AUTOPILOT_SKIP_DAILY_LIMIT, AUTOPILOT_SKIP_DRAWDOWN,
    AUTOPILOT_SKIP_INACTIVE, AUTOPILOT_SKIP_NO_SIGNAL, AUTOPILOT_SKIP_VOLATILITY,
};

pub enum AutopilotAction {
    None,
    Buy { amount_in: u64 },
    Sell { amount_in: u64 },
}

pub enum AutopilotTickEvaluation {
    Skip { reason: u8 },
    Buy { amount_in: u64, amount_out: u64 },
    Sell { amount_in: u64, amount_out: u64 },
}

pub fn strategy_params(strategy: u8) -> Result<AutopilotParams> {
    Ok(match strategy {
        AUTOPILOT_STRATEGY_CONSERVATIVE => AutopilotParams {
            target_asset_bps: 4_000,
            buy_band_bps: 100,
            sell_band_bps: 100,
            max_trade_bps: 800,
            min_edge_bps: 20,
            cooldown_sec: 900,
            max_trades_per_day: 3,
            tick_interval_ms: 300_000,
            pause_vol_bps: 150,
            stop_drawdown_bps: 650,
        },
        AUTOPILOT_STRATEGY_BALANCED => AutopilotParams {
            target_asset_bps: 5_000,
            buy_band_bps: 50,
            sell_band_bps: 50,
            max_trade_bps: 1_500,
            min_edge_bps: 12,
            cooldown_sec: 300,
            max_trades_per_day: 8,
            tick_interval_ms: 120_000,
            pause_vol_bps: 250,
            stop_drawdown_bps: 1_200,
        },
        AUTOPILOT_STRATEGY_AGGRESSIVE => AutopilotParams {
            target_asset_bps: 6_500,
            buy_band_bps: 25,
            sell_band_bps: 25,
            max_trade_bps: 3_000,
            min_edge_bps: 8,
            cooldown_sec: 60,
            max_trades_per_day: 20,
            tick_interval_ms: 60_000,
            pause_vol_bps: 400,
            stop_drawdown_bps: 2_200,
        },
        _ => return Err(error!(PropAmmError::AutopilotInvalidStrategy)),
    })
}

pub fn compute_nav_usdc(
    asset_balance: u64,
    usdc_balance: u64,
    fair_price_e8: i64,
) -> Result<u64> {
    require!(fair_price_e8 > 0, PropAmmError::InvalidOraclePrice);

    let asset_value = (asset_balance as u128)
        .checked_mul(fair_price_e8 as u128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(100_000_000)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let nav = (usdc_balance as u128)
        .checked_add(asset_value)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    u64::try_from(nav).map_err(|_| error!(PropAmmError::MathOverflow))
}

fn price_move_bps(from_e8: i64, to_e8: i64) -> Result<i64> {
    require!(from_e8 > 0, PropAmmError::InvalidOraclePrice);
    let delta = to_e8
        .checked_sub(from_e8)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;
    let bps = (delta as i128)
        .checked_mul(BPS_DENOMINATOR as i128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(from_e8 as i128)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;
    i64::try_from(bps).map_err(|_| error!(PropAmmError::MathOverflow))
}

pub fn evaluate_autopilot_tick(
    autopilot: &mut AutopilotState,
    fair_price_e8: i64,
    spread_bps: u64,
    volatility_bps: u64,
    asset_balance: u64,
    usdc_balance: u64,
    asset_decimals: u8,
    usdc_decimals: u8,
    virtual_depth_k: u64,
    now_ts: i64,
) -> Result<AutopilotTickEvaluation> {
    if !autopilot.is_active() {
        return Ok(AutopilotTickEvaluation::Skip {
            reason: AUTOPILOT_SKIP_INACTIVE,
        });
    }

    if volatility_bps > autopilot.pause_vol_bps as u64 {
        autopilot.status = AUTOPILOT_STATUS_PAUSED;
        return Ok(AutopilotTickEvaluation::Skip {
            reason: AUTOPILOT_SKIP_VOLATILITY,
        });
    }

    let nav = compute_nav_usdc(asset_balance, usdc_balance, fair_price_e8)?;
    if nav > autopilot.high_water_nav_usdc {
        autopilot.high_water_nav_usdc = nav;
    }

    if autopilot.high_water_nav_usdc > 0 && autopilot.starting_nav_usdc > 0 {
        let drawdown_bps = ((autopilot.high_water_nav_usdc.saturating_sub(nav) as u128)
            .checked_mul(BPS_DENOMINATOR as u128)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?
            .checked_div(autopilot.high_water_nav_usdc as u128)
            .ok_or_else(|| error!(PropAmmError::DivisionByZero))?) as u32;

        if drawdown_bps >= autopilot.stop_drawdown_bps {
            autopilot.status = AUTOPILOT_STATUS_STOPPED;
            return Ok(AutopilotTickEvaluation::Skip {
                reason: AUTOPILOT_SKIP_DRAWDOWN,
            });
        }
    }

    if autopilot.last_trade_ts > 0 {
        let elapsed = now_ts
            .checked_sub(autopilot.last_trade_ts)
            .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;
        if (elapsed as u64) < autopilot.cooldown_sec as u64 {
            return Ok(AutopilotTickEvaluation::Skip {
                reason: AUTOPILOT_SKIP_COOLDOWN,
            });
        }
    }

    if autopilot.trades_day_start_ts > 0 {
        let day_elapsed = now_ts
            .checked_sub(autopilot.trades_day_start_ts)
            .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;
        if day_elapsed >= 86_400 {
            autopilot.trades_today = 0;
            autopilot.trades_day_start_ts = now_ts;
        }
    } else {
        autopilot.trades_day_start_ts = now_ts;
    }

    if autopilot.trades_today >= autopilot.max_trades_per_day {
        return Ok(AutopilotTickEvaluation::Skip {
            reason: AUTOPILOT_SKIP_DAILY_LIMIT,
        });
    }

    let min_edge = autopilot
        .min_edge_bps
        .max(spread_bps as u32)
        .max((spread_bps as u32).saturating_mul(12).saturating_div(10));

    let inventory_ratio_bps =
        compute_inventory_ratio_bps(asset_balance, usdc_balance, fair_price_e8)?;
    let deviation_bps = inventory_ratio_bps - autopilot.target_asset_bps as i64;
    let rebalance_threshold_bps = (autopilot.buy_band_bps / 2).max(10) as i64;

    let mut buy_signal = deviation_bps <= -rebalance_threshold_bps;
    let mut sell_signal = deviation_bps >= rebalance_threshold_bps;

    if autopilot.last_fair_price_e8 > 0 {
        let move_bps = price_move_bps(autopilot.last_fair_price_e8, fair_price_e8)?;
        if move_bps <= -(autopilot.buy_band_bps as i64) {
            buy_signal = true;
        }
        if move_bps >= autopilot.sell_band_bps as i64 {
            sell_signal = true;
        }
        if abs_i64(move_bps) < min_edge as u64 {
            buy_signal = false;
            sell_signal = false;
        }
    }

    let budget = autopilot.allocated_usdc.max(usdc_balance);
    let max_trade_usdc = ((budget as u128)
        .checked_mul(autopilot.max_trade_bps as u128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?) as u64;

    if buy_signal && !sell_signal && usdc_balance > 0 {
        let amount_in = max_trade_usdc.min(usdc_balance);
        if amount_in > 0 {
            let (vx, vy) = compute_virtual_reserves_e8(
                fair_price_e8,
                virtual_depth_k,
                asset_decimals,
                usdc_decimals,
            )?;
            let amount_out = compute_swap_usdc_for_asset(amount_in, vx, vy, spread_bps)?;
            return Ok(AutopilotTickEvaluation::Buy {
                amount_in,
                amount_out,
            });
        }
    }

    if sell_signal && !buy_signal && asset_balance > 0 {
        let asset_cap = ((max_trade_usdc as u128)
            .checked_mul(BPS_DENOMINATOR as u128)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?
            .checked_div(fair_price_e8 as u128)
            .ok_or_else(|| error!(PropAmmError::DivisionByZero))?) as u64;
        let amount_in = asset_cap.min(asset_balance);
        if amount_in > 0 {
            let (vx, vy) = compute_virtual_reserves_e8(
                fair_price_e8,
                virtual_depth_k,
                asset_decimals,
                usdc_decimals,
            )?;
            let amount_out = compute_swap_asset_for_usdc(amount_in, vx, vy, spread_bps)?;
            return Ok(AutopilotTickEvaluation::Sell {
                amount_in,
                amount_out,
            });
        }
    }

    Ok(AutopilotTickEvaluation::Skip {
        reason: AUTOPILOT_SKIP_NO_SIGNAL,
    })
}

pub fn execute_autopilot_swap(
    action: AutopilotAction,
    fair_price_e8: i64,
    spread_bps: u64,
    asset_mint: &Pubkey,
    usdc_mint: &Pubkey,
    asset_decimals: u8,
    usdc_decimals: u8,
    virtual_depth_k: u64,
    user_bank: &mut crate::state::UserBank,
) -> Result<()> {
    let (vx, vy) = compute_virtual_reserves_e8(
        fair_price_e8,
        virtual_depth_k,
        asset_decimals,
        usdc_decimals,
    )?;

    match action {
        AutopilotAction::Buy { amount_in } => {
            let amount_out = compute_swap_usdc_for_asset(amount_in, vx, vy, spread_bps)?;
            user_bank.debit(usdc_mint, amount_in)?;
            user_bank.credit(asset_mint, amount_out)?;
        }
        AutopilotAction::Sell { amount_in } => {
            let amount_out = compute_swap_asset_for_usdc(amount_in, vx, vy, spread_bps)?;
            user_bank.debit(asset_mint, amount_in)?;
            user_bank.credit(usdc_mint, amount_out)?;
        }
        AutopilotAction::None => {}
    }

    Ok(())
}
