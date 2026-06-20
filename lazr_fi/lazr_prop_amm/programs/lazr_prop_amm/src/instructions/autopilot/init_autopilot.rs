use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::math::autopilot::strategy_params;
use crate::state::*;

#[derive(Accounts)]
pub struct InitAutopilot<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub asset_mint: Account<'info, Mint>,
    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Pool PDA — may be delegated on L1
    #[account(
        seeds = [POOL_SEED, asset_mint.key().as_ref(), usdc_mint.key().as_ref()],
        bump,
    )]
    pub pool: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + AutopilotState::INIT_SPACE,
        seeds = [AUTOPILOT_SEED, pool.key().as_ref(), authority.key().as_ref()],
        bump
    )]
    pub autopilot: Account<'info, AutopilotState>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitAutopilotArgs {
    pub strategy: u8,
    pub crank_task_id: i64,
}

pub fn handler(ctx: Context<InitAutopilot>, args: InitAutopilotArgs) -> Result<()> {
    let pool = {
        let data = ctx.accounts.pool.try_borrow_data()?;
        Pool::try_deserialize(&mut &data[..])?
    };
    require!(
        pool.asset_mint == ctx.accounts.asset_mint.key(),
        PropAmmError::InvalidMint
    );
    require!(
        pool.usdc_mint == ctx.accounts.usdc_mint.key(),
        PropAmmError::InvalidMint
    );

    let pool_key = ctx.accounts.pool.key();
    let autopilot = &mut ctx.accounts.autopilot;
    let params = strategy_params(args.strategy)?;

    autopilot.authority = ctx.accounts.authority.key();
    autopilot.pool = pool_key;
    autopilot.asset_mint = pool.asset_mint;
    autopilot.usdc_mint = pool.usdc_mint;
    autopilot.status = AUTOPILOT_STATUS_INACTIVE;
    autopilot.strategy = args.strategy;
    autopilot.allocated_usdc = 0;
    autopilot.apply_params(params);
    autopilot.last_fair_price_e8 = 0;
    autopilot.last_trade_ts = 0;
    autopilot.trades_today = 0;
    autopilot.trades_day_start_ts = 0;
    autopilot.starting_nav_usdc = 0;
    autopilot.high_water_nav_usdc = 0;
    autopilot.total_trades = 0;
    autopilot.crank_task_id = args.crank_task_id;
    autopilot.bump = ctx.bumps.autopilot;

    Ok(())
}
