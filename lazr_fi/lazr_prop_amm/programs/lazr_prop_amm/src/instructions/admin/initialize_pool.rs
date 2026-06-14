use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializePoolArgs {
    pub pyth_lazer_id: u32,
    pub oracle_exponent: i32,
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
#[instruction(args: InitializePoolArgs)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ADMIN_SEED],
        bump = admin_state.bump,
        constraint = admin_state.authority == authority.key() @ PropAmmError::InvalidAuthority
    )]
    pub admin_state: Box<Account<'info, AdminState>>,

    pub asset_mint: Box<Account<'info, Mint>>,
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED, asset_mint.key().as_ref(), usdc_mint.key().as_ref()],
        bump
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED, pool.key().as_ref()],
        bump
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(
        init,
        payer = authority,
        space = 8 + QuoteState::INIT_SPACE,
        seeds = [QUOTE_STATE_SEED, pool.key().as_ref()],
        bump
    )]
    pub quote_state: Box<Account<'info, QuoteState>>,

    #[account(
        init,
        payer = authority,
        space = 8 + RiskState::INIT_SPACE,
        seeds = [RISK_STATE_SEED, pool.key().as_ref()],
        bump
    )]
    pub risk_state: Box<Account<'info, RiskState>>,

    #[account(
        init,
        payer = authority,
        space = 8 + VolatilityState::INIT_SPACE,
        seeds = [VOLATILITY_STATE_SEED, pool.key().as_ref()],
        bump
    )]
    pub volatility_state: Box<Account<'info, VolatilityState>>,

    #[account(
        init,
        payer = authority,
        space = 8 + HedgeState::INIT_SPACE,
        seeds = [HEDGE_STATE_SEED, pool.key().as_ref()],
        bump
    )]
    pub hedge_state: Box<Account<'info, HedgeState>>,

    #[account(
        init,
        payer = authority,
        token::mint = asset_mint,
        token::authority = pool,
        seeds = [ASSET_VAULT_SEED, pool.key().as_ref()],
        bump
    )]
    pub asset_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = pool,
        seeds = [USDC_VAULT_SEED, pool.key().as_ref()],
        bump
    )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: Oracle feed account from Pyth Lazer
    pub oracle_feed: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializePool>, args: InitializePoolArgs) -> Result<()> {
    let vol_window = args
        .volatility_window_size
        .unwrap_or(DEFAULT_VOLATILITY_WINDOW_SIZE);
    require!(
        vol_window as usize <= volatility_state::MAX_VOLATILITY_WINDOW,
        PropAmmError::VolatilityWindowTooLarge
    );

    let pool = &mut ctx.accounts.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.asset_mint = ctx.accounts.asset_mint.key();
    pool.usdc_mint = ctx.accounts.usdc_mint.key();
    pool.asset_vault = ctx.accounts.asset_vault.key();
    pool.usdc_vault = ctx.accounts.usdc_vault.key();
    pool.config = ctx.accounts.config.key();
    pool.quote_state = ctx.accounts.quote_state.key();
    pool.risk_state = ctx.accounts.risk_state.key();
    pool.volatility_state = ctx.accounts.volatility_state.key();
    pool.hedge_state = ctx.accounts.hedge_state.key();
    pool.oracle_feed = ctx.accounts.oracle_feed.key();
    pool.pyth_lazer_id = args.pyth_lazer_id;
    pool.oracle_exponent = args.oracle_exponent;
    pool.paused = false;
    pool.bump = ctx.bumps.pool;

    let config = &mut ctx.accounts.config;
    config.pool = ctx.accounts.pool.key();
    config.target_inventory_bps = args.target_inventory_bps.unwrap_or(DEFAULT_TARGET_INVENTORY_BPS);
    config.base_spread_bps = args.base_spread_bps.unwrap_or(DEFAULT_BASE_SPREAD_BPS);
    config.max_spread_bps = args.max_spread_bps.unwrap_or(DEFAULT_MAX_SPREAD_BPS);
    config.virtual_depth_k = args.virtual_depth_k.unwrap_or(DEFAULT_VIRTUAL_DEPTH_K);
    config.volatility_window_size = vol_window;
    config.crank_interval_ms = args.crank_interval_ms.unwrap_or(DEFAULT_CRANK_INTERVAL_MS);
    config.max_trade_size = args.max_trade_size.unwrap_or(DEFAULT_MAX_TRADE_SIZE);
    config.lambda = args.lambda.unwrap_or(DEFAULT_LAMBDA);
    config.max_oracle_staleness_sec = args
        .max_oracle_staleness_sec
        .unwrap_or(DEFAULT_MAX_ORACLE_STALENESS_SEC);
    config.bump = ctx.bumps.config;

    let quote_state = &mut ctx.accounts.quote_state;
    quote_state.pool = ctx.accounts.pool.key();
    quote_state.fair_price_e8 = 0;
    quote_state.executable_price_e8 = 0;
    quote_state.bid_price_e8 = 0;
    quote_state.ask_price_e8 = 0;
    quote_state.spread_bps = 0;
    quote_state.last_update_slot = 0;
    quote_state.last_update_ts = 0;
    quote_state.bump = ctx.bumps.quote_state;

    let risk_state = &mut ctx.accounts.risk_state;
    risk_state.pool = ctx.accounts.pool.key();
    risk_state.inventory_ratio_bps = 0;
    risk_state.inventory_deviation_bps = 0;
    risk_state.inventory_penalty_bps = 0;
    risk_state.volatility_bps = 0;
    risk_state.oracle_confidence_bps = 0;
    risk_state.last_update_ts = 0;
    risk_state.last_update_slot = 0;
    risk_state.bump = ctx.bumps.risk_state;

    let volatility_state = &mut ctx.accounts.volatility_state;
    volatility_state.pool = ctx.accounts.pool.key();
    volatility_state.prices = Vec::new();
    volatility_state.current_index = 0;
    volatility_state.count = 0;
    volatility_state.realized_volatility_bps = 0;
    volatility_state.last_update_ts = 0;
    volatility_state.bump = ctx.bumps.volatility_state;

    let hedge_state = &mut ctx.accounts.hedge_state;
    hedge_state.pool = ctx.accounts.pool.key();
    hedge_state.target_inventory_bps = config.target_inventory_bps;
    hedge_state.soft_limit_bps = HEDGE_SOFT_LIMIT_BPS;
    hedge_state.hard_limit_bps = HEDGE_HARD_LIMIT_BPS;
    hedge_state.hedge_required = false;
    hedge_state.last_hedge_ts = 0;
    hedge_state.bump = ctx.bumps.hedge_state;

    let admin_state = &mut ctx.accounts.admin_state;
    admin_state.pool_count = admin_state
        .pool_count
        .checked_add(1)
        .ok_or_else(|| error!(PropAmmError::MathOverflow))?;

    Ok(())
}
