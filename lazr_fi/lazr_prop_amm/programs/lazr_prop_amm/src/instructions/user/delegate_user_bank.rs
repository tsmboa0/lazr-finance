use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;
use crate::state::UserBank;

#[delegate]
#[derive(Accounts)]
pub struct DelegateUserBank<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: UserBank PDA — authority verified manually before delegate CPI
    #[account(mut, del)]
    pub user_bank: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DelegateUserBank>) -> Result<()> {
    let authority = {
        let data = ctx.accounts.user_bank.try_borrow_data()?;
        UserBank::try_deserialize(&mut &data[..])?.authority
    };

    require!(
        authority == ctx.accounts.payer.key(),
        crate::error::PropAmmError::InvalidAuthority
    );

    let validator = ctx.remaining_accounts.first().map(|acc| acc.key());

    ctx.accounts.delegate_user_bank(
        &ctx.accounts.payer,
        &[USER_BANK_SEED, authority.as_ref()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    Ok(())
}
