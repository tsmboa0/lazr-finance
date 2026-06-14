use anchor_lang::prelude::*;

use crate::constants::*;
use crate::state::UserBank;

#[derive(Accounts)]
pub struct InitUserBank<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + UserBank::INIT_SPACE,
        seeds = [USER_BANK_SEED, authority.key().as_ref()],
        bump
    )]
    pub user_bank: Account<'info, UserBank>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitUserBank>) -> Result<()> {
    let user_bank = &mut ctx.accounts.user_bank;
    user_bank.authority = ctx.accounts.authority.key();
    user_bank.entries = Vec::new();
    user_bank.bump = ctx.bumps.user_bank;
    Ok(())
}
