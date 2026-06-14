use crate::error::PropAmmError;
use anchor_lang::prelude::*;

pub const E8: i128 = 100_000_000;
pub const E16: i128 = 10_000_000_000_000_000;

pub fn checked_mul_div(a: i128, b: i128, c: i128) -> Result<i128> {
    require!(c != 0, PropAmmError::DivisionByZero);
    a.checked_mul(b)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(c)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))
}

pub fn checked_mul_div_u128(a: u128, b: u128, c: u128) -> Result<u128> {
    require!(c != 0, PropAmmError::DivisionByZero);
    a.checked_mul(b)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?
        .checked_div(c)
        .ok_or_else(|| error!(PropAmmError::DivisionByZero))
}

pub fn i64_to_e8(val: i64, exponent: i32) -> Result<i64> {
    let val_128 = val as i128;
    let target_exp: i32 = -8;
    let shift = exponent - target_exp;

    let result = if shift > 0 {
        let factor = 10i128
            .checked_pow(shift as u32)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
        val_128
            .checked_mul(factor)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?
    } else if shift < 0 {
        let factor = 10i128
            .checked_pow((-shift) as u32)
            .ok_or_else(|| error!(PropAmmError::MathOverflow))?;
        val_128
            .checked_div(factor)
            .ok_or_else(|| error!(PropAmmError::DivisionByZero))?
    } else {
        val_128
    };

    i64::try_from(result).map_err(|_| error!(PropAmmError::MathOverflow))
}

pub fn abs_i64(val: i64) -> u64 {
    if val < 0 {
        (-(val as i128)) as u64
    } else {
        val as u64
    }
}
