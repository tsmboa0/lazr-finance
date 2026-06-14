use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub asset_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub asset_vault: Pubkey,
    pub usdc_vault: Pubkey,
    pub config: Pubkey,
    pub quote_state: Pubkey,
    pub risk_state: Pubkey,
    pub volatility_state: Pubkey,
    pub hedge_state: Pubkey,
    pub oracle_feed: Pubkey,
    pub pyth_lazer_id: u32,
    pub oracle_exponent: i32,
    pub paused: bool,
    pub bump: u8,
}
