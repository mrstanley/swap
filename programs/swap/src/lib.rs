pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("CJuyrPLFyLe73HxcFcXef6cpeBCwPwbdRVCki5eYwdtW");

#[program]
pub mod swap {
    use super::*;

    pub fn make_offer(
        ctx: Context<MakeOffer>,
        id: u64,
        token_a_offered_amount: u64,
        token_b_wanted_amount: u64,
    ) -> Result<()> {
        send_offered_tokens_to_vault(&ctx, token_a_offered_amount)?;
        save_offer(ctx, id, token_b_wanted_amount)
    }

    pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
        send_wanted_tokens_to_maker(&ctx)?;
        withdraw_and_close_vault(ctx)
    }
}
