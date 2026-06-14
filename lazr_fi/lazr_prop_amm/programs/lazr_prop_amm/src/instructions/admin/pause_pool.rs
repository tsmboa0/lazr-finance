use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::*;

#[derive(Accounts)]
pub struct PausePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ADMIN_SEED],
        bump = admin_state.bump,
        constraint = admin_state.authority == authority.key() @ PropAmmError::InvalidAuthority
    )]
    pub admin_state: Account<'info, AdminState>,

    #[account(
        mut,
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump,
        constraint = !pool.paused @ PropAmmError::PoolPaused
    )]
    pub pool: Account<'info, Pool>,
}

pub fn handler(ctx: Context<PausePool>) -> Result<()> {
    ctx.accounts.pool.paused = true;
    Ok(())
}
