use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::{AdminState, Pool};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RemoveLiquidityArgs {
    pub asset_amount: u64,
    pub usdc_amount: u64,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ADMIN_SEED],
        bump = admin_state.bump,
        constraint = admin_state.authority == authority.key() @ PropAmmError::InvalidAuthority
    )]
    pub admin_state: Account<'info, AdminState>,

    #[account(
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        constraint = authority_asset_account.owner == authority.key(),
        constraint = authority_asset_account.mint == pool.asset_mint @ PropAmmError::InvalidMint
    )]
    pub authority_asset_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = authority_usdc_account.owner == authority.key(),
        constraint = authority_usdc_account.mint == pool.usdc_mint @ PropAmmError::InvalidMint
    )]
    pub authority_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address = pool.asset_vault @ PropAmmError::InvalidPoolState
    )]
    pub asset_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address = pool.usdc_vault @ PropAmmError::InvalidPoolState
    )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RemoveLiquidity>, args: RemoveLiquidityArgs) -> Result<()> {
    require!(
        args.asset_amount > 0 || args.usdc_amount > 0,
        PropAmmError::InvalidConfigParam
    );

    let pool = &ctx.accounts.pool;
    let asset_mint_key = pool.asset_mint;
    let usdc_mint_key = pool.usdc_mint;
    let pool_bump = pool.bump;

    let seeds = &[
        POOL_SEED,
        asset_mint_key.as_ref(),
        usdc_mint_key.as_ref(),
        &[pool_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    if args.asset_amount > 0 {
        require!(
            ctx.accounts.asset_vault.amount >= args.asset_amount,
            PropAmmError::InsufficientVaultBalance
        );

        let cpi_accounts = Transfer {
            from: ctx.accounts.asset_vault.to_account_info(),
            to: ctx.accounts.authority_asset_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, args.asset_amount)?;
    }

    if args.usdc_amount > 0 {
        require!(
            ctx.accounts.usdc_vault.amount >= args.usdc_amount,
            PropAmmError::InsufficientVaultBalance
        );

        let cpi_accounts = Transfer {
            from: ctx.accounts.usdc_vault.to_account_info(),
            to: ctx.accounts.authority_usdc_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, args.usdc_amount)?;
    }

    Ok(())
}
