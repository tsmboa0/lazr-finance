use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

use crate::constants::*;
use crate::error::PropAmmError;
use crate::state::{Pool, UserBank};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawFromBankErArgs {
    pub amount: u64,
    pub withdraw_mint: Pubkey,
}

/// ER withdraw step 1: commit+undelegate user bank to L1.
/// Client completes withdrawal with L1 `withdraw_from_bank(redelegate=true)`.
#[commit]
#[derive(Accounts, Session)]
pub struct WithdrawFromBankEr<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [POOL_SEED, pool.asset_mint.as_ref(), pool.usdc_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

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
pub fn handler(ctx: Context<WithdrawFromBankEr>, args: WithdrawFromBankErArgs) -> Result<()> {
    require!(args.amount > 0, PropAmmError::InvalidConfigParam);

    let pool = &ctx.accounts.pool;
    require!(
        args.withdraw_mint == pool.asset_mint || args.withdraw_mint == pool.usdc_mint,
        PropAmmError::InvalidMint
    );

    let bank_balance = ctx.accounts.user_bank.get_balance(&args.withdraw_mint);
    require!(bank_balance >= args.amount, PropAmmError::InsufficientUserBalance);

    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.user_bank.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}
