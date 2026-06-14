use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AdminState {
    pub authority: Pubkey,
    pub pool_count: u64,
    pub bump: u8,
}
