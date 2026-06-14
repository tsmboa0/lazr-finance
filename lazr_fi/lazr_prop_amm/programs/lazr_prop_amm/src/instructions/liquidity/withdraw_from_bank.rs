use anchor_lang::prelude::*;
use anchor_lang::AccountSerialize;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::{Pool, UserBank};

#[delegate]
#[derive(Accounts)]
pub struct WithdrawFromBank<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub asset_mint: Account<'info, Mint>,
    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Pool PDA — may be delegated on L1
    #[account(
        seeds = [POOL_SEED, asset_mint.key().as_ref(), usdc_mint.key().as_ref()],
        bump,
    )]
    pub pool: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == withdraw_mint.key() @ PropAmmError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: The mint of the token being withdrawn
    pub withdraw_mint: UncheckedAccount<'info>,

    /// CHECK: User bank PDA — manually deserialized to avoid Anchor exit after delegate CPI
    #[account(
        mut,
        del,
        seeds = [USER_BANK_SEED, user.key().as_ref()],
        bump,
    )]
    pub user_bank: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawFromBank>, amount: u64, redelegate: bool) -> Result<()> {
    require!(amount > 0, PropAmmError::InvalidConfigParam);

    let withdraw_mint_key = ctx.accounts.withdraw_mint.key();
    let pool = {
        let data = ctx.accounts.pool.try_borrow_data()?;
        Pool::try_deserialize(&mut &data[..])?
    };

    require!(
        withdraw_mint_key == pool.asset_mint || withdraw_mint_key == pool.usdc_mint,
        PropAmmError::InvalidMint
    );
    require!(
        ctx.accounts.vault.key() == pool.asset_vault || ctx.accounts.vault.key() == pool.usdc_vault,
        PropAmmError::InvalidPoolState
    );

    let authority = ctx.accounts.user.key();
    {
        let mut data = ctx.accounts.user_bank.try_borrow_mut_data()?;
        let mut user_bank = UserBank::try_deserialize(&mut &data[..])?;
        require!(
            user_bank.authority == authority,
            PropAmmError::InvalidAuthority
        );
        user_bank.debit(&withdraw_mint_key, amount)?;
        user_bank.try_serialize(&mut &mut data[..])?;
    }

    require!(
        ctx.accounts.vault.amount >= amount,
        PropAmmError::InsufficientVaultBalance
    );

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

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    if redelegate {
        ctx.accounts.delegate_user_bank(
            &ctx.accounts.user,
            &[USER_BANK_SEED, authority.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
    }

    Ok(())
}
