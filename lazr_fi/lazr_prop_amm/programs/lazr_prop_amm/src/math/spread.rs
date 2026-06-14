use crate::error::PropAmmError;
use crate::math::fixed_point::abs_i64;
use anchor_lang::prelude::*;

pub fn compute_spread_bps(
    base_spread_bps: u64,
    inventory_penalty_bps: i64,
    volatility_bps: u64,
    max_spread_bps: u64,
) -> Result<u64> {
    let inventory_component = abs_i64(inventory_penalty_bps);

    let volatility_component = volatility_bps
        .checked_div(2)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let total = base_spread_bps
        .checked_add(inventory_component)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_add(volatility_component)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    Ok(total.min(max_spread_bps))
}

pub fn compute_bid_ask_e8(
    fair_price_e8: i64,
    spread_bps: u64,
    inventory_penalty_bps: i64,
) -> Result<(i64, i64)> {
    let price = fair_price_e8 as i128;
    let half_spread = (spread_bps / 2) as i128;
    let penalty = inventory_penalty_bps as i128;
    let bps_denom = 10_000i128;

    let bid_adjustment = half_spread
        .checked_add(penalty)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
    let ask_adjustment = half_spread
        .checked_sub(penalty)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    let bid = price
        .checked_sub(
            price
                .checked_mul(bid_adjustment)
                .ok_or_else(|| error!(PropAmmError::MathOverflow))?
                .checked_div(bps_denom)
                .ok_or_else(|| error!(PropAmmError::DivisionByZero))?,
        )
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    let ask = price
        .checked_add(
            price
                .checked_mul(ask_adjustment)
                .ok_or_else(|| error!(PropAmmError::MathOverflow))?
                .checked_div(bps_denom)
                .ok_or_else(|| error!(PropAmmError::DivisionByZero))?,
        )
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let bid_i64 = i64::try_from(bid.max(0)).map_err(|_| error!(PropAmmError::MathOverflow))?;
    let ask_i64 = i64::try_from(ask.max(0)).map_err(|_| error!(PropAmmError::MathOverflow))?;

    Ok((bid_i64, ask_i64))
}
