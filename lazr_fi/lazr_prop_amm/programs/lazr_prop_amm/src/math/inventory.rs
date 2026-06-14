use crate::constants::BPS_DENOMINATOR;
use crate::error::PropAmmError;
use anchor_lang::prelude::*;

pub fn compute_inventory_ratio_bps(
    asset_balance: u64,
    usdc_balance: u64,
    fair_price_e8: i64,
) -> Result<i64> {
    require!(fair_price_e8 > 0, PropAmmError::InvalidOraclePrice);

    let asset_value_e8 = (asset_balance as i128)
        .checked_mul(fair_price_e8 as i128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let usdc_value_e8 = (usdc_balance as i128)
        .checked_mul(100_000_000i128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let total_value_e8 = asset_value_e8
        .checked_add(usdc_value_e8)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    if total_value_e8 == 0 {
        return Ok(0);
    }

    let ratio = asset_value_e8
        .checked_mul(BPS_DENOMINATOR as i128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(total_value_e8)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    i64::try_from(ratio).map_err(|_| error!(PropAmmError::MathOverflow))
}

pub fn compute_inventory_deviation_bps(
    inventory_ratio_bps: i64,
    target_inventory_bps: u64,
) -> i64 {
    inventory_ratio_bps.saturating_sub(target_inventory_bps as i64)
}

pub fn compute_cubic_penalty_bps(deviation_bps: i64, lambda: u64) -> Result<i64> {
    let dev = deviation_bps as i128;
    let bps_denom = BPS_DENOMINATOR as i128;

    let dev_cubed = dev
        .checked_mul(dev)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_mul(dev)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let penalty = dev_cubed
        .checked_mul(lambda as i128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(
            bps_denom
                .checked_mul(bps_denom)
                .ok_or_else(|| error!(PropAmmError::MathOverflow))?,
        )
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    i64::try_from(penalty).map_err(|_| error!(PropAmmError::MathOverflow))
}
