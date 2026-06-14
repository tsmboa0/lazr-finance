use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::{delegate_account, DelegateAccounts, DelegateConfig};

use crate::constants::USER_BANK_SEED;

pub fn invoke_delegate_user_bank<'info>(
    payer: &AccountInfo<'info>,
    user_bank: &AccountInfo<'info>,
    owner_program: &AccountInfo<'info>,
    buffer: &AccountInfo<'info>,
    delegation_record: &AccountInfo<'info>,
    delegation_metadata: &AccountInfo<'info>,
    delegation_program: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    authority: Pubkey,
    validator: Option<Pubkey>,
) -> Result<()> {
    let seeds: &[&[u8]] = &[USER_BANK_SEED, authority.as_ref()];

    let delegate_accounts = DelegateAccounts {
        payer,
        pda: user_bank,
        owner_program,
        buffer,
        delegation_record,
        delegation_metadata,
        delegation_program,
        system_program,
    };

    delegate_account(
        delegate_accounts,
        seeds,
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    Ok(())
}
