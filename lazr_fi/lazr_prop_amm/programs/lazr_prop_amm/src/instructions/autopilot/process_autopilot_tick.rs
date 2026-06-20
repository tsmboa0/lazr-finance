use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::events::{
    AutopilotTick, AUTOPILOT_OUTCOME_BUY, AUTOPILOT_OUTCOME_SELL, AUTOPILOT_OUTCOME_SKIP,
    AUTOPILOT_SKIP_INACTIVE, AUTOPILOT_SKIP_NONE,
};
use crate::math::autopilot::{evaluate_autopilot_tick, execute_autopilot_swap, AutopilotAction, AutopilotTickEvaluation};
use crate::state::*;

#[derive(Accounts)]
pub struct ProcessAutopilotTick<'info> {
    #[account(
        mut,
        seeds = [AUTOPILOT_SEED, pool.key().as_ref(), autopilot.authority.as_ref()],
        bump = autopilot.bump,
        constraint = autopilot.pool == pool.key() @ PropAmmError::InvalidPoolState,
    )]
    pub autopilot: Box<Account<'info, AutopilotState>>,

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
        seeds = [QUOTE_STATE_SEED, pool.key().as_ref()],
        bump = quote_state.bump
    )]
    pub quote_state: Account<'info, QuoteState>,

    #[account(
        seeds = [RISK_STATE_SEED, pool.key().as_ref()],
        bump = risk_state.bump
    )]
    pub risk_state: Account<'info, RiskState>,

    #[account(
        mut,
        seeds = [USER_BANK_SEED, autopilot.authority.as_ref()],
        bump = user_bank.bump,
        constraint = user_bank.authority == autopilot.authority @ PropAmmError::InvalidAuthority,
    )]
    pub user_bank: Box<Account<'info, UserBank>>,

    #[account(
        constraint = asset_mint.key() == pool.asset_mint @ PropAmmError::InvalidMint
    )]
    pub asset_mint: Account<'info, Mint>,

    #[account(
        constraint = usdc_mint.key() == pool.usdc_mint @ PropAmmError::InvalidMint
    )]
    pub usdc_mint: Account<'info, Mint>,
}

fn emit_tick_event(
    autopilot: &AutopilotState,
    outcome: u8,
    skip_reason: u8,
    amount_in: u64,
    amount_out: u64,
) {
    emit!(AutopilotTick {
        authority: autopilot.authority,
        pool: autopilot.pool,
        outcome,
        skip_reason,
        amount_in,
        amount_out,
    });
}

pub fn handler(ctx: Context<ProcessAutopilotTick>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let config = &ctx.accounts.config;
    let quote_state = &ctx.accounts.quote_state;
    let risk_state = &ctx.accounts.risk_state;
    let autopilot = &mut ctx.accounts.autopilot;
    let user_bank = &mut ctx.accounts.user_bank;
    let clock = Clock::get()?;

    if !autopilot.is_active() {
        emit_tick_event(
            autopilot,
            AUTOPILOT_OUTCOME_SKIP,
            AUTOPILOT_SKIP_INACTIVE,
            0,
            0,
        );
        return Ok(());
    }

    require!(quote_state.executable_price_e8 > 0, PropAmmError::StaleQuote);

    let quote_age = clock
        .unix_timestamp
        .checked_sub(quote_state.last_update_ts)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;
    require!(
        (quote_age as u64) <= config.max_oracle_staleness_sec,
        PropAmmError::StaleQuote
    );

    let asset_balance = user_bank.get_balance(&pool.asset_mint);
    let usdc_balance = user_bank.get_balance(&pool.usdc_mint);

    let evaluation = evaluate_autopilot_tick(
        autopilot,
        quote_state.fair_price_e8,
        quote_state.spread_bps,
        risk_state.volatility_bps,
        asset_balance,
        usdc_balance,
        ctx.accounts.asset_mint.decimals,
        ctx.accounts.usdc_mint.decimals,
        config.virtual_depth_k,
        clock.unix_timestamp,
    )?;

    match evaluation {
        AutopilotTickEvaluation::Skip { reason } => {
            emit_tick_event(
                autopilot,
                AUTOPILOT_OUTCOME_SKIP,
                reason,
                0,
                0,
            );
            return Ok(());
        }
        AutopilotTickEvaluation::Buy { amount_in, amount_out } => {
            execute_autopilot_swap(
                AutopilotAction::Buy { amount_in },
                quote_state.executable_price_e8,
                quote_state.spread_bps,
                &pool.asset_mint,
                &pool.usdc_mint,
                ctx.accounts.asset_mint.decimals,
                ctx.accounts.usdc_mint.decimals,
                config.virtual_depth_k,
                user_bank,
            )?;

            autopilot.last_trade_ts = clock.unix_timestamp;
            autopilot.last_fair_price_e8 = quote_state.fair_price_e8;
            autopilot.trades_today = autopilot.trades_today.saturating_add(1);
            autopilot.total_trades = autopilot.total_trades.saturating_add(1);

            emit_tick_event(
                autopilot,
                AUTOPILOT_OUTCOME_BUY,
                AUTOPILOT_SKIP_NONE,
                amount_in,
                amount_out,
            );
        }
        AutopilotTickEvaluation::Sell { amount_in, amount_out } => {
            execute_autopilot_swap(
                AutopilotAction::Sell { amount_in },
                quote_state.executable_price_e8,
                quote_state.spread_bps,
                &pool.asset_mint,
                &pool.usdc_mint,
                ctx.accounts.asset_mint.decimals,
                ctx.accounts.usdc_mint.decimals,
                config.virtual_depth_k,
                user_bank,
            )?;

            autopilot.last_trade_ts = clock.unix_timestamp;
            autopilot.last_fair_price_e8 = quote_state.fair_price_e8;
            autopilot.trades_today = autopilot.trades_today.saturating_add(1);
            autopilot.total_trades = autopilot.total_trades.saturating_add(1);

            emit_tick_event(
                autopilot,
                AUTOPILOT_OUTCOME_SELL,
                AUTOPILOT_SKIP_NONE,
                amount_in,
                amount_out,
            );
        }
    }

    Ok(())
}
