use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::math::swap::{compute_swap_usdc_for_asset, compute_virtual_reserves_e8};
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapUsdcForAssetArgs {
    pub amount_in: u64,
    pub min_amount_out: u64,
}

#[derive(Accounts, Session)]
pub struct SwapUsdcForAsset<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump,
        constraint = !pool.paused @ PropAmmError::PoolPaused
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        constraint = asset_mint.key() == pool.asset_mint @ PropAmmError::InvalidConfigParam
    )]
    pub asset_mint: Account<'info, Mint>,

    #[account(
        constraint = usdc_mint.key() == pool.usdc_mint @ PropAmmError::InvalidConfigParam
    )]
    pub usdc_mint: Account<'info, Mint>,

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
        mut,
        seeds = [USER_BANK_SEED, user_bank.authority.as_ref()],
        bump = user_bank.bump,
    )]
    pub user_bank: Account<'info, UserBank>,

    #[session(
        signer = payer,
        authority = user_bank.authority
    )]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[session_auth_or(
    ctx.accounts.user_bank.authority == ctx.accounts.payer.key(),
    SessionError::InvalidToken
)]
pub fn handler(ctx: Context<SwapUsdcForAsset>, args: SwapUsdcForAssetArgs) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let config = &ctx.accounts.config;
    let quote_state = &ctx.accounts.quote_state;
    let user_bank = &mut ctx.accounts.user_bank;

    require!(args.amount_in > 0, PropAmmError::InvalidConfigParam);
    require!(
        args.amount_in <= config.max_trade_size,
        PropAmmError::TradeSizeExceedsMax
    );
    require!(quote_state.executable_price_e8 > 0, PropAmmError::StaleQuote);

    let clock = Clock::get()?;
    let quote_age = clock
        .unix_timestamp
        .checked_sub(quote_state.last_update_ts)
        .ok_or_else(|| error!(PropAmmError::MathUnderflow))?;
    require!(
        (quote_age as u64) <= config.max_oracle_staleness_sec,
        PropAmmError::StaleQuote
    );

    let (vx, vy) = compute_virtual_reserves_e8(
        quote_state.executable_price_e8,
        config.virtual_depth_k,
        ctx.accounts.asset_mint.decimals,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let amount_out =
        compute_swap_usdc_for_asset(args.amount_in, vx, vy, quote_state.spread_bps)?;

    require!(
        amount_out >= args.min_amount_out,
        PropAmmError::SlippageExceeded
    );

    user_bank.debit(&pool.usdc_mint, args.amount_in)?;
    user_bank.credit(&pool.asset_mint, amount_out)?;

    Ok(())
}
