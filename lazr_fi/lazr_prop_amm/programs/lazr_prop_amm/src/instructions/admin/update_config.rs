use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateConfigArgs {
    pub target_inventory_bps: Option<u64>,
    pub base_spread_bps: Option<u64>,
    pub max_spread_bps: Option<u64>,
    pub virtual_depth_k: Option<u64>,
    pub volatility_window_size: Option<u8>,
    pub crank_interval_ms: Option<u64>,
    pub max_trade_size: Option<u64>,
    pub lambda: Option<u64>,
    pub max_oracle_staleness_sec: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ADMIN_SEED],
        bump = admin_state.bump,
        constraint = admin_state.authority == authority.key() @ PropAmmError::InvalidAuthority
    )]
    pub admin_state: Account<'info, AdminState>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, pool.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
}

pub fn handler(ctx: Context<UpdateConfig>, args: UpdateConfigArgs) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(val) = args.target_inventory_bps {
        require!(val <= BPS_DENOMINATOR, PropAmmError::InvalidConfigParam);
        config.target_inventory_bps = val;
    }
    if let Some(val) = args.base_spread_bps {
        config.base_spread_bps = val;
    }
    if let Some(val) = args.max_spread_bps {
        require!(val > 0, PropAmmError::InvalidConfigParam);
        config.max_spread_bps = val;
    }
    if let Some(val) = args.virtual_depth_k {
        require!(val > 0, PropAmmError::InvalidConfigParam);
        config.virtual_depth_k = val;
    }
    if let Some(val) = args.volatility_window_size {
        require!(
            (val as usize) <= volatility_state::MAX_VOLATILITY_WINDOW,
            PropAmmError::VolatilityWindowTooLarge
        );
        config.volatility_window_size = val;
    }
    if let Some(val) = args.crank_interval_ms {
        require!(val > 0, PropAmmError::InvalidConfigParam);
        config.crank_interval_ms = val;
    }
    if let Some(val) = args.max_trade_size {
        require!(val > 0, PropAmmError::InvalidConfigParam);
        config.max_trade_size = val;
    }
    if let Some(val) = args.lambda {
        config.lambda = val;
    }
    if let Some(val) = args.max_oracle_staleness_sec {
        require!(val > 0, PropAmmError::InvalidConfigParam);
        config.max_oracle_staleness_sec = val;
    }

    Ok(())
}
