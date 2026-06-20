use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::{AutopilotState, Pool};

#[delegate]
#[derive(Accounts)]
pub struct DelegateAutopilot<'info> {
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

    /// CHECK: AutopilotState PDA — authority verified manually before delegate CPI
    #[account(mut, del)]
    pub autopilot: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DelegateAutopilot>) -> Result<()> {
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

    let (authority, pool_key) = {
        let data = ctx.accounts.autopilot.try_borrow_data()?;
        let state = AutopilotState::try_deserialize(&mut &data[..])?;
        (state.authority, state.pool)
    };

    require!(
        authority == ctx.accounts.payer.key(),
        PropAmmError::InvalidAuthority
    );
    require!(
        pool_key == ctx.accounts.pool.key(),
        PropAmmError::InvalidPoolState
    );

    let validator = ctx.remaining_accounts.first().map(|acc| acc.key());

    ctx.accounts.delegate_autopilot(
        &ctx.accounts.payer,
        &[
            AUTOPILOT_SEED,
            ctx.accounts.pool.key().as_ref(),
            authority.as_ref(),
        ],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    Ok(())
}
