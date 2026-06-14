use anchor_lang::prelude::*;

pub fn isqrt(n: u128) -> Result<u128> {
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

pub fn isqrt_e8(val_e8: u128) -> Result<u128> {
    let scaled = val_e8
        .checked_mul(100_000_000)
        .ok_or_else(|| error!(crate::error::PropAmmError::MathOverflow))?;
    isqrt(scaled)
}
