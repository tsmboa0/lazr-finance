use crate::error::PropAmmError;
use crate::math::sqrt::isqrt_e8;
use anchor_lang::prelude::*;

pub fn compute_virtual_reserves_e8(
    executable_price_e8: i64,
    virtual_depth_k: u64,
    asset_decimals: u8,
    usdc_decimals: u8,
) -> Result<(u128, u128)> {
    require!(executable_price_e8 > 0, PropAmmError::InvalidOraclePrice);

    let price_u128 = executable_price_e8 as u128;
    let k = virtual_depth_k as u128;

    let sqrt_price = isqrt_e8(price_u128)?;
    require!(sqrt_price > 0, PropAmmError::InvalidOraclePrice);

    let e8 = 100_000_000u128;

    let mut vy = k
        .checked_mul(sqrt_price)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(e8)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let mut vx = k
        .checked_mul(e8)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(sqrt_price)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let dec_diff = usdc_decimals as i32 - asset_decimals as i32;
    if dec_diff > 0 {
        let factor = 10u128
            .checked_pow(dec_diff as u32)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
        vy = vy
            .checked_mul(factor)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
    } else if dec_diff < 0 {
        let factor = 10u128
            .checked_pow((-dec_diff) as u32)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
        vx = vx
            .checked_mul(factor)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
    }

    Ok((vx, vy))
}

pub fn compute_swap_asset_for_usdc(
    amount_in: u64,
    vx: u128,
    vy: u128,
    spread_bps: u64,
) -> Result<u64> {
    require!(vx > 0 && vy > 0, PropAmmError::InvalidPoolState);

    let delta_x = amount_in as u128;

    let new_vx = vx
        .checked_add(delta_x)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let k = vx
        .checked_mul(vy)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let new_vy = k
        .checked_div(new_vx)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let gross_output = vy
        .checked_sub(new_vy)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    let spread_deduction = gross_output
        .checked_mul(spread_bps as u128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(10_000)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let net_output = gross_output
        .checked_sub(spread_deduction)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    u64::try_from(net_output).map_err(|_| error!(PropAmmError::MathOverflow))
}

pub fn compute_swap_usdc_for_asset(
    amount_in: u64,
    vx: u128,
    vy: u128,
    spread_bps: u64,
) -> Result<u64> {
    require!(vx > 0 && vy > 0, PropAmmError::InvalidPoolState);

    let delta_y = amount_in as u128;

    let new_vy = vy
        .checked_add(delta_y)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let k = vx
        .checked_mul(vy)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    let new_vx = k
        .checked_div(new_vy)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let gross_output = vx
        .checked_sub(new_vx)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    let spread_deduction = gross_output
        .checked_mul(spread_bps as u128)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(10_000)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let net_output = gross_output
        .checked_sub(spread_deduction)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    u64::try_from(net_output).map_err(|_| error!(PropAmmError::MathOverflow))
}
