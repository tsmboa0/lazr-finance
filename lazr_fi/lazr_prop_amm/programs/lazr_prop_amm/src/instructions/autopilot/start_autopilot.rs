use anchor_lang::prelude::*;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::math::autopilot::compute_nav_usdc;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct StartAutopilotArgs {
    pub allocated_usdc: u64,
}

#[derive(Accounts, Session)]
pub struct StartAutopilot<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump,
        constraint = !pool.paused @ PropAmmError::PoolPaused,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        seeds = [QUOTE_STATE_SEED, pool.key().as_ref()],
        bump = quote_state.bump,
    )]
    pub quote_state: Account<'info, QuoteState>,

    #[account(
        mut,
        seeds = [AUTOPILOT_SEED, pool.key().as_ref(), autopilot.authority.as_ref()],
        bump = autopilot.bump,
        constraint = autopilot.pool == pool.key() @ PropAmmError::InvalidPoolState,
    )]
    pub autopilot: Account<'info, AutopilotState>,

    #[account(
        seeds = [USER_BANK_SEED, autopilot.authority.as_ref()],
        bump = user_bank.bump,
        constraint = user_bank.authority == autopilot.authority @ PropAmmError::InvalidAuthority,
    )]
    pub user_bank: Account<'info, UserBank>,

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
pub fn handler(ctx: Context<StartAutopilot>, args: StartAutopilotArgs) -> Result<()> {
    require!(args.allocated_usdc > 0, PropAmmError::InvalidConfigParam);

    let autopilot = &mut ctx.accounts.autopilot;
    let quote_state = &ctx.accounts.quote_state;
    let user_bank = &ctx.accounts.user_bank;
    let pool = &ctx.accounts.pool;

    require!(!autopilot.is_active(), PropAmmError::AutopilotAlreadyActive);
    require!(quote_state.fair_price_e8 > 0, PropAmmError::StaleQuote);

    let usdc_balance = user_bank.get_balance(&pool.usdc_mint);
    require!(
        usdc_balance >= args.allocated_usdc,
        PropAmmError::AutopilotInsufficientCapital
    );

    let asset_balance = user_bank.get_balance(&pool.asset_mint);
    let nav = compute_nav_usdc(asset_balance, usdc_balance, quote_state.fair_price_e8)?;

    autopilot.allocated_usdc = args.allocated_usdc;
    autopilot.status = AUTOPILOT_STATUS_ACTIVE;
    autopilot.starting_nav_usdc = nav;
    autopilot.high_water_nav_usdc = nav;
    autopilot.last_fair_price_e8 = quote_state.fair_price_e8;
    autopilot.last_trade_ts = 0;
    autopilot.trades_today = 0;
    autopilot.trades_day_start_ts = Clock::get()?.unix_timestamp;

    Ok(())
}
