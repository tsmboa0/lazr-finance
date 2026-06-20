use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::{AutopilotState, AUTOPILOT_STATUS_STOPPED};

#[commit]
#[derive(Accounts, Session)]
pub struct UndelegateAutopilot<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            AUTOPILOT_SEED,
            autopilot.pool.as_ref(),
            autopilot.authority.as_ref(),
        ],
        bump = autopilot.bump,
    )]
    pub autopilot: Account<'info, AutopilotState>,

    #[session(
        signer = payer,
        authority = autopilot.authority
    )]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[session_auth_or(
    ctx.accounts.autopilot.authority == ctx.accounts.payer.key(),
    SessionError::InvalidToken
)]
pub fn handler(ctx: Context<UndelegateAutopilot>) -> Result<()> {
    require!(
        ctx.accounts.autopilot.status == AUTOPILOT_STATUS_STOPPED,
        PropAmmError::AutopilotNotActive
    );

    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.autopilot.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}
