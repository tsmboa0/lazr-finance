use crate::error::PropAmmError;
use crate::state::volatility_state::MAX_VOLATILITY_WINDOW;
use anchor_lang::prelude::*;

pub fn update_volatility_buffer(
    prices: &mut Vec<i64>,
    current_index: &mut u8,
    count: &mut u8,
    new_price: i64,
    window_size: u8,
) {
    let max_size = (window_size as usize).min(MAX_VOLATILITY_WINDOW);

    if prices.len() < max_size {
        prices.push(new_price);
        *count = prices.len() as u8;
    } else {
        let idx = (*current_index as usize) % max_size;
        prices[idx] = new_price;
    }

    *current_index = ((*current_index).wrapping_add(1)) % (max_size as u8);
}

pub fn compute_realized_volatility_bps(prices: &[i64], count: u8) -> Result<u64> {
    let n = count as usize;
    if n < 2 {
        return Ok(0);
    }

    let mut sum_sq_returns: i128 = 0;
    let mut valid_returns: u64 = 0;

    for i in 1..n.min(prices.len()) {
        let prev = prices[i - 1];
        let curr = prices[i];

        if prev <= 0 || curr <= 0 {
            continue;
        }

        let log_return_bps = compute_log_return_bps(prev, curr)?;

        sum_sq_returns = sum_sq_returns
            .checked_add(
                (log_return_bps as i128)
                    .checked_mul(log_return_bps as i128)
                    .ok_or_else(|| error!(PropAmmError::MathOverflow))?,
            )
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

        valid_returns = valid_returns
            .checked_add(1)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
    }

    if valid_returns == 0 {
        return Ok(0);
    }

    let variance = sum_sq_returns
        .checked_div(valid_returns as i128)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let vol_bps = isqrt_i128(variance.unsigned_abs())?;

    Ok(vol_bps as u64)
}

fn compute_log_return_bps(prev_price: i64, curr_price: i64) -> Result<i64> {
    if prev_price <= 0 {
        return Ok(0);
    }

    let ratio_bps = (curr_price as i128)
        .checked_mul(10_000)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(prev_price as i128)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))?;

    let log_approx_bps = ratio_bps
        .checked_sub(10_000)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    i64::try_from(log_approx_bps).map_err(|_| error!(PropAmmError::MathOverflow))
}

fn isqrt_i128(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }
    if n == 1 {
        return Ok(1);
    }

    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    Ok(x)
}
