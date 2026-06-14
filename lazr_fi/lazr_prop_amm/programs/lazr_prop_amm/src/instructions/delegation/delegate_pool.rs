use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::*;

#[delegate]
#[derive(Accounts)]
pub struct DelegatePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ADMIN_SEED],
        bump = admin_state.bump,
        constraint = admin_state.authority == payer.key() @ PropAmmError::InvalidAuthority
    )]
    pub admin_state: Box<Account<'info, AdminState>>,

    pub asset_mint: Box<Account<'info, anchor_spl::token::Mint>>,
    pub usdc_mint: Box<Account<'info, anchor_spl::token::Mint>>,

    /// CHECK: Pool PDA to delegate
    #[account(mut, del, seeds = [POOL_SEED, asset_mint.key().as_ref(), usdc_mint.key().as_ref()], bump)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: QuoteState PDA to delegate
    #[account(mut, del, seeds = [QUOTE_STATE_SEED, pool.key().as_ref()], bump)]
    pub quote_state: UncheckedAccount<'info>,

    /// CHECK: RiskState PDA to delegate
    #[account(mut, del, seeds = [RISK_STATE_SEED, pool.key().as_ref()], bump)]
    pub risk_state: UncheckedAccount<'info>,

    /// CHECK: VolatilityState PDA to delegate
    #[account(mut, del, seeds = [VOLATILITY_STATE_SEED, pool.key().as_ref()], bump)]
    pub volatility_state: UncheckedAccount<'info>,

    /// CHECK: HedgeState PDA to delegate
    #[account(mut, del, seeds = [HEDGE_STATE_SEED, pool.key().as_ref()], bump)]
    pub hedge_state: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DelegatePool>) -> Result<()> {
    let validator = ctx.remaining_accounts.first().map(|acc| acc.key());

    let asset_mint_key = ctx.accounts.asset_mint.key();
    let usdc_mint_key = ctx.accounts.usdc_mint.key();

    ctx.accounts.delegate_pool(
        &ctx.accounts.payer,
        &[POOL_SEED, asset_mint_key.as_ref(), usdc_mint_key.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    let pool_key = ctx.accounts.pool.key();

    ctx.accounts.delegate_quote_state(
        &ctx.accounts.payer,
        &[QUOTE_STATE_SEED, pool_key.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    ctx.accounts.delegate_risk_state(
        &ctx.accounts.payer,
        &[RISK_STATE_SEED, pool_key.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    ctx.accounts.delegate_volatility_state(
        &ctx.accounts.payer,
        &[VOLATILITY_STATE_SEED, pool_key.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    ctx.accounts.delegate_hedge_state(
        &ctx.accounts.payer,
        &[HEDGE_STATE_SEED, pool_key.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    Ok(())
}
