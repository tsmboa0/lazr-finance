use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use magicblock_magic_program_api::args::ScheduleTaskArgs;
use magicblock_magic_program_api::instruction::MagicBlockInstruction;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetupCrankArgs {
    pub task_id: i64,
    pub iterations: i64,
}

#[derive(Accounts)]
pub struct SetupCrank<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Magic program for scheduling
    pub magic_program: UncheckedAccount<'info>,

    #[account(
        mut,
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

    /// CHECK: QuoteState passed to CPI
    #[account(mut, seeds = [QUOTE_STATE_SEED, pool.key().as_ref()], bump)]
    pub quote_state: UncheckedAccount<'info>,

    /// CHECK: RiskState passed to CPI
    #[account(mut, seeds = [RISK_STATE_SEED, pool.key().as_ref()], bump)]
    pub risk_state: UncheckedAccount<'info>,

    /// CHECK: VolatilityState passed to CPI
    #[account(mut, seeds = [VOLATILITY_STATE_SEED, pool.key().as_ref()], bump)]
    pub volatility_state: UncheckedAccount<'info>,

    /// CHECK: HedgeState passed to CPI
    #[account(mut, seeds = [HEDGE_STATE_SEED, pool.key().as_ref()], bump)]
    pub hedge_state: UncheckedAccount<'info>,

    /// CHECK: Oracle feed account
    pub oracle_feed: UncheckedAccount<'info>,

    /// CHECK: This program's own ID, needed for building the inner instruction
    pub program: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<SetupCrank>, args: SetupCrankArgs) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let config = &ctx.accounts.config;
    let iterations = if args.iterations <= 0 {
        crate::constants::CRANK_DEFAULT_ITERATIONS
    } else {
        args.iterations
    };

    let crank_ix = Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(pool.key(), false),
            AccountMeta::new_readonly(config.key(), false),
            AccountMeta::new(ctx.accounts.quote_state.key(), false),
            AccountMeta::new(ctx.accounts.risk_state.key(), false),
            AccountMeta::new(ctx.accounts.volatility_state.key(), false),
            AccountMeta::new(ctx.accounts.hedge_state.key(), false),
            AccountMeta::new_readonly(ctx.accounts.oracle_feed.key(), false),
            AccountMeta::new_readonly(pool.asset_vault, false),
            AccountMeta::new_readonly(pool.usdc_vault, false),
        ],
        data: anchor_lang::InstructionData::data(&crate::instruction::ProcessCrankTick {}),
    };

    let ix_data =
        bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
            task_id: args.task_id,
            execution_interval_millis: config.crank_interval_ms as i64,
            iterations,
            instructions: vec![crank_ix],
        }))
        .map_err(|_| error!(PropAmmError::InvalidPoolState))?;

    let schedule_ix = Instruction::new_with_bytes(
        MAGIC_PROGRAM_ID,
        &ix_data,
        vec![
            AccountMeta::new(ctx.accounts.payer.key(), true),
            AccountMeta::new(pool.key(), false),
        ],
    );

    invoke_signed(
        &schedule_ix,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.pool.to_account_info(),
        ],
        &[],
    )?;

    Ok(())
}
