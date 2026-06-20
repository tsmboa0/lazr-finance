use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::math::autopilot::strategy_params;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateAutopilotArgs {
    pub strategy: Option<u8>,
    pub allocated_usdc: Option<u64>,
    pub tick_interval_ms: Option<u32>,
    pub crank_task_id: Option<i64>,
}

#[derive(Accounts, Session)]
pub struct UpdateAutopilot<'info> {
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
pub fn handler(ctx: Context<UpdateAutopilot>, args: UpdateAutopilotArgs) -> Result<()> {
    let autopilot = &mut ctx.accounts.autopilot;

    if let Some(strategy) = args.strategy {
        require!(!autopilot.is_active(), PropAmmError::AutopilotAlreadyActive);
        let params = strategy_params(strategy)?;
        autopilot.strategy = strategy;
        autopilot.apply_params(params);
    }

    if let Some(allocated_usdc) = args.allocated_usdc {
        require!(!autopilot.is_active(), PropAmmError::AutopilotAlreadyActive);
        autopilot.allocated_usdc = allocated_usdc;
    }

    if let Some(tick_interval_ms) = args.tick_interval_ms {
        require!(tick_interval_ms >= 1_000, PropAmmError::InvalidConfigParam);
        autopilot.tick_interval_ms = tick_interval_ms;
    }

    if let Some(crank_task_id) = args.crank_task_id {
        autopilot.crank_task_id = crank_task_id;
    }

    Ok(())
}
