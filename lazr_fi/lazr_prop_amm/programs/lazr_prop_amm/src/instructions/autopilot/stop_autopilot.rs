use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::*;

#[derive(Accounts, Session)]
pub struct StopAutopilot<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub asset_mint: Account<'info, Mint>,
    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Pool PDA — may be delegated on L1
    #[account(
        seeds = [POOL_SEED, asset_mint.key().as_ref(), usdc_mint.key().as_ref()],
        bump,
    )]
    pub pool: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [AUTOPILOT_SEED, pool.key().as_ref(), autopilot.authority.as_ref()],
        bump = autopilot.bump,
        constraint = autopilot.pool == pool.key() @ PropAmmError::InvalidPoolState,
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
pub fn handler(ctx: Context<StopAutopilot>) -> Result<()> {
    let autopilot = &mut ctx.accounts.autopilot;
    if autopilot.status != AUTOPILOT_STATUS_STOPPED {
        autopilot.status = AUTOPILOT_STATUS_STOPPED;
    }
    Ok(())
}
