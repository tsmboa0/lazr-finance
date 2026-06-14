use anchor_lang::prelude::*;

pub const MAX_BANK_ENTRIES: usize = 20;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Default)]
pub struct BankEntry {
    pub mint: Pubkey,
    pub balance: u64,
}

#[account]
#[derive(InitSpace)]
pub struct UserBank {
    pub authority: Pubkey,
    #[max_len(20)]
    pub entries: Vec<BankEntry>,
    pub bump: u8,
}

impl UserBank {
    pub fn find_entry_index(&self, mint: &Pubkey) -> Option<usize> {
        self.entries.iter().position(|e| e.mint == *mint)
    }

    pub fn get_balance(&self, mint: &Pubkey) -> u64 {
        self.entries
            .iter()
            .find(|e| e.mint == *mint)
            .map(|e| e.balance)
            .unwrap_or(0)
    }

    pub fn credit(&mut self, mint: &Pubkey, amount: u64) -> Result<()> {
        if let Some(idx) = self.find_entry_index(mint) {
            self.entries[idx].balance = self.entries[idx]
                .balance
                .checked_add(amount)
                .ok_or_else(|| error!(crate::error::PropAmmError::MathOverflow))?;
        } else {
            require!(
                self.entries.len() < MAX_BANK_ENTRIES,
                crate::error::PropAmmError::BankFull
            );
            self.entries.push(BankEntry {
                mint: *mint,
                balance: amount,
            });
        }
        Ok(())
    }

    pub fn debit(&mut self, mint: &Pubkey, amount: u64) -> Result<()> {
        let idx = self
            .find_entry_index(mint)
            .ok_or_else(|| error!(crate::error::PropAmmError::TokenNotFound))?;
        self.entries[idx].balance = self.entries[idx]
            .balance
            .checked_sub(amount)
            .ok_or_else(|| error!(crate::error::PropAmmError::InsufficientUserBalance))?;
        Ok(())
    }
}
