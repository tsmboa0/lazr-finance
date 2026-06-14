use anchor_lang::prelude::*;

use crate::constants::*;
use crate::state::AdminState;

#[derive(Accounts)]
pub struct InitializeAdmin<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + AdminState::INIT_SPACE,
        seeds = [ADMIN_SEED],
        bump
    )]
    pub admin_state: Account<'info, AdminState>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeAdmin>) -> Result<()> {
    let admin_state = &mut ctx.accounts.admin_state;
    admin_state.authority = ctx.accounts.authority.key();
    admin_state.pool_count = 0;
    admin_state.bump = ctx.bumps.admin_state;
    Ok(())
}
