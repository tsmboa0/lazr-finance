pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod oracle;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("CQMGqi6qSoJPCQzVMPi4Xdob9W4SS267JbSaK5yd3rTw");

#[ephemeral]
#[program]
pub mod lazr_prop_amm {
    use super::*;

    pub fn initialize_admin(ctx: Context<InitializeAdmin>) -> Result<()> {
        instructions::admin::initialize_admin::handler(ctx)
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        args: InitializePoolArgs,
    ) -> Result<()> {
        instructions::admin::initialize_pool::handler(ctx, args)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, args: UpdateConfigArgs) -> Result<()> {
        instructions::admin::update_config::handler(ctx, args)
    }

    pub fn pause_pool(ctx: Context<PausePool>) -> Result<()> {
        instructions::admin::pause_pool::handler(ctx)
    }

    pub fn resume_pool(ctx: Context<ResumePool>) -> Result<()> {
        instructions::admin::resume_pool::handler(ctx)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, args: AddLiquidityArgs) -> Result<()> {
        instructions::admin::add_liquidity::handler(ctx, args)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, args: RemoveLiquidityArgs) -> Result<()> {
        instructions::admin::remove_liquidity::handler(ctx, args)
    }

    pub fn delegate_pool(ctx: Context<DelegatePool>) -> Result<()> {
        instructions::delegation::delegate_pool::handler(ctx)
    }

    pub fn setup_crank(ctx: Context<SetupCrank>, args: SetupCrankArgs) -> Result<()> {
        instructions::crank::setup_crank::handler(ctx, args)
    }

    pub fn process_crank_tick(ctx: Context<ProcessCrankTick>) -> Result<()> {
        instructions::crank::process_crank_tick::handler(ctx)
    }

    pub fn init_user_bank(ctx: Context<InitUserBank>) -> Result<()> {
        instructions::user::init_user_bank::handler(ctx)
    }

    pub fn delegate_user_bank(ctx: Context<DelegateUserBank>) -> Result<()> {
        instructions::user::delegate_user_bank::handler(ctx)
    }

    pub fn undelegate_user_bank(ctx: Context<UndelegateUserBank>) -> Result<()> {
        instructions::user::undelegate_user_bank::handler(ctx)
    }

    pub fn swap_asset_for_usdc(ctx: Context<SwapAssetForUsdc>, args: SwapAssetForUsdcArgs) -> Result<()> {
        instructions::user::swap_asset_for_usdc::handler(ctx, args)
    }

    pub fn swap_usdc_for_asset(ctx: Context<SwapUsdcForAsset>, args: SwapUsdcForAssetArgs) -> Result<()> {
        instructions::user::swap_usdc_for_asset::handler(ctx, args)
    }

    pub fn deposit_to_bank<'info>(
        ctx: Context<'info, DepositToBank<'info>>,
        amount: u64,
        redelegate: bool,
    ) -> Result<()> {
        instructions::liquidity::deposit_to_bank::handler(ctx, amount, redelegate)
    }

    pub fn withdraw_from_bank<'info>(
        ctx: Context<'info, WithdrawFromBank<'info>>,
        amount: u64,
        redelegate: bool,
    ) -> Result<()> {
        instructions::liquidity::withdraw_from_bank::handler(ctx, amount, redelegate)
    }

    pub fn withdraw_from_bank_er(
        ctx: Context<WithdrawFromBankEr>,
        args: WithdrawFromBankErArgs,
    ) -> Result<()> {
        instructions::liquidity::withdraw_from_bank_er::handler(ctx, args)
    }

    pub fn init_autopilot(
        ctx: Context<InitAutopilot>,
        args: InitAutopilotArgs,
    ) -> Result<()> {
        instructions::autopilot::init_autopilot::handler(ctx, args)
    }

    pub fn update_autopilot(
        ctx: Context<UpdateAutopilot>,
        args: UpdateAutopilotArgs,
    ) -> Result<()> {
        instructions::autopilot::update_autopilot::handler(ctx, args)
    }

    pub fn start_autopilot(
        ctx: Context<StartAutopilot>,
        args: StartAutopilotArgs,
    ) -> Result<()> {
        instructions::autopilot::start_autopilot::handler(ctx, args)
    }

    pub fn stop_autopilot(ctx: Context<StopAutopilot>) -> Result<()> {
        instructions::autopilot::stop_autopilot::handler(ctx)
    }

    pub fn undelegate_autopilot(ctx: Context<UndelegateAutopilot>) -> Result<()> {
        instructions::autopilot::undelegate_autopilot::handler(ctx)
    }

    pub fn delegate_autopilot(ctx: Context<DelegateAutopilot>) -> Result<()> {
        instructions::autopilot::delegate_autopilot::handler(ctx)
    }

    pub fn setup_autopilot_crank(
        ctx: Context<SetupAutopilotCrank>,
        args: SetupAutopilotCrankArgs,
    ) -> Result<()> {
        instructions::autopilot::setup_autopilot_crank::handler(ctx, args)
    }

    pub fn process_autopilot_tick(ctx: Context<ProcessAutopilotTick>) -> Result<()> {
        instructions::autopilot::process_autopilot_tick::handler(ctx)
    }
}
