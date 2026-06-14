use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::state::UserBank;

#[commit]
#[derive(Accounts, Session)]
pub struct UndelegateUserBank<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [USER_BANK_SEED, user_bank.authority.as_ref()],
        bump = user_bank.bump
    )]
    pub user_bank: Account<'info, UserBank>,

    #[session(
        signer = payer,
        authority = user_bank.authority
    )]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[session_auth_or(
    ctx.accounts.user_bank.authority == ctx.accounts.payer.key(),
    SessionError::InvalidToken
)]
pub fn handler(ctx: Context<UndelegateUserBank>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.user_bank.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}
