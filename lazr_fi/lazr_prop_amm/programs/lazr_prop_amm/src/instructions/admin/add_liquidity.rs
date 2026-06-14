use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::{AdminState, Pool};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddLiquidityArgs {
    pub asset_amount: u64,
    pub usdc_amount: u64,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
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

pub fn handler(ctx: Context<AddLiquidity>, args: AddLiquidityArgs) -> Result<()> {
    require!(
        args.asset_amount > 0 || args.usdc_amount > 0,
        PropAmmError::InvalidConfigParam
    );

    if args.asset_amount > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.authority_asset_account.to_account_info(),
            to: ctx.accounts.asset_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts,
        );
        token::transfer(cpi_ctx, args.asset_amount)?;
    }

    if args.usdc_amount > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.authority_usdc_account.to_account_info(),
            to: ctx.accounts.usdc_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts,
        );
        token::transfer(cpi_ctx, args.usdc_amount)?;
    }

    Ok(())
}
