use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use magicblock_magic_program_api::args::ScheduleTaskArgs;
use magicblock_magic_program_api::instruction::MagicBlockInstruction;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetupAutopilotCrankArgs {
    pub iterations: i64,
}

#[derive(Accounts, Session)]
pub struct SetupAutopilotCrank<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Magic program for scheduling
    pub magic_program: UncheckedAccount<'info>,

    #[account(
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump,
        constraint = !pool.paused @ PropAmmError::PoolPaused
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        seeds = [CONFIG_SEED, pool.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [AUTOPILOT_SEED, pool.key().as_ref(), autopilot.authority.as_ref()],
        bump = autopilot.bump,
        constraint = autopilot.pool == pool.key() @ PropAmmError::InvalidPoolState,
        constraint = autopilot.is_active() @ PropAmmError::AutopilotNotActive,
    )]
    pub autopilot: Account<'info, AutopilotState>,

    /// CHECK: QuoteState passed to CPI
    #[account(mut, seeds = [QUOTE_STATE_SEED, pool.key().as_ref()], bump)]
    pub quote_state: UncheckedAccount<'info>,

    /// CHECK: RiskState passed to CPI
    #[account(mut, seeds = [RISK_STATE_SEED, pool.key().as_ref()], bump)]
    pub risk_state: UncheckedAccount<'info>,

    /// CHECK: UserBank PDA passed to scheduled autopilot tick.
    #[account(
        mut,
        seeds = [USER_BANK_SEED, autopilot.authority.as_ref()],
        bump,
    )]
    pub user_bank: UncheckedAccount<'info>,

    /// CHECK: Asset mint for decimals
    pub asset_mint: UncheckedAccount<'info>,

    /// CHECK: USDC mint for decimals
    pub usdc_mint: UncheckedAccount<'info>,

    /// CHECK: This program's own ID, needed for building the inner instruction
    pub program: UncheckedAccount<'info>,

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
pub fn handler(ctx: Context<SetupAutopilotCrank>, args: SetupAutopilotCrankArgs) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let autopilot = &ctx.accounts.autopilot;
    let iterations = if args.iterations <= 0 {
        CRANK_DEFAULT_ITERATIONS
    } else {
        args.iterations
    };

    let crank_ix = Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(autopilot.key(), false),
            AccountMeta::new(pool.key(), false),
            AccountMeta::new_readonly(ctx.accounts.config.key(), false),
            AccountMeta::new(ctx.accounts.quote_state.key(), false),
            AccountMeta::new(ctx.accounts.risk_state.key(), false),
            AccountMeta::new(ctx.accounts.user_bank.key(), false),
            AccountMeta::new_readonly(ctx.accounts.asset_mint.key(), false),
            AccountMeta::new_readonly(ctx.accounts.usdc_mint.key(), false),
        ],
        data: anchor_lang::InstructionData::data(
            &crate::instruction::ProcessAutopilotTick {},
        ),
    };

    let ix_data =
        bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
            task_id: autopilot.crank_task_id,
            execution_interval_millis: autopilot.tick_interval_ms as i64,
            iterations,
            instructions: vec![crank_ix],
        }))
        .map_err(|_| error!(PropAmmError::InvalidPoolState))?;

    let schedule_ix = Instruction::new_with_bytes(
        MAGIC_PROGRAM_ID,
        &ix_data,
        vec![
            AccountMeta::new(ctx.accounts.payer.key(), true),
            AccountMeta::new(autopilot.key(), false),
        ],
    );

    invoke_signed(
        &schedule_ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.autopilot.to_account_info(),
        ],
        &[],
    )?;

    Ok(())
}
