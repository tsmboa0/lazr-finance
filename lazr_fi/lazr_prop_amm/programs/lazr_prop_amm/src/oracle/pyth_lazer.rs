use crate::constants::{PRICE_DATA_OFFSET, PRICE_TIMESTAMP_OFFSET};
use crate::error::PropAmmError;
use anchor_lang::prelude::*;

pub struct OraclePrice {
    pub price: i64,
    pub confidence: u64,
    pub timestamp: i64,
}

pub fn read_pyth_lazer_price(account_info: &AccountInfo) -> Result<OraclePrice> {
    let data = account_info.try_borrow_data()?;

    require!(
        data.len() >= PRICE_DATA_OFFSET + 8,
        PropAmmError::InvalidOracleAccount
    );

    let price_bytes: [u8; 8] = data[PRICE_DATA_OFFSET..PRICE_DATA_OFFSET + 8]
        .try_into()
        .map_err(|_| error!(PropAmmError::InvalidOracleAccount))?;
    let price = i64::from_le_bytes(price_bytes);

    let confidence = if data.len() >= PRICE_DATA_OFFSET + 16 {
        let conf_bytes: [u8; 8] = data[PRICE_DATA_OFFSET + 8..PRICE_DATA_OFFSET + 16]
            .try_into()
            .map_err(|_| error!(PropAmmError::InvalidOracleAccount))?;
        u64::from_le_bytes(conf_bytes)
    } else {
        0
    };

    let timestamp = if data.len() >= PRICE_TIMESTAMP_OFFSET + 8 {
        let ts_bytes: [u8; 8] = data[PRICE_TIMESTAMP_OFFSET..PRICE_TIMESTAMP_OFFSET + 8]
            .try_into()
            .map_err(|_| error!(PropAmmError::InvalidOracleAccount))?;
        i64::from_le_bytes(ts_bytes)
    } else {
        Clock::get()?.unix_timestamp
    };

    require!(price > 0, PropAmmError::InvalidOraclePrice);

    Ok(OraclePrice {
        price,
        confidence,
        timestamp,
    })
}

pub fn validate_oracle_staleness(
    oracle_timestamp: i64,
    current_timestamp: i64,
    max_staleness_sec: u64,
) -> Result<()> {
    let age = current_timestamp
        .checked_sub(oracle_timestamp)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;

    require!(age >= 0, PropAmmError::InvalidOraclePrice);
    require!(
        (age as u64) <= max_staleness_sec,
        PropAmmError::StaleOracle
    );

    Ok(())
}
