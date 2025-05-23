use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub id: u64,
    // 提供者的公钥
    pub maker: Pubkey,
    // 提供的token
    pub token_mint_a: Pubkey,
    // 想要兑换的token
    pub token_mint_b: Pubkey,
    // 想要兑换的数量
    pub token_b_wanted_amount: u64,
    // ？ 不知什么作用
    pub bump: u8,
}
