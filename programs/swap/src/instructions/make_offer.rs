use anchor_lang::prelude::*;
use anchor_spl::{  
    associated_token::AssociatedToken, // 用于关联代币账户的模块
    token_interface::{Mint, TokenAccount, TokenInterface}, // SPL Token接口相关的数据类型
};

use crate::{Offer, ANCHOR_DISCRIMILATOR, transfer_tokens};

// 定义一个带有参数id的新指令结构体，该结构体代表“创建报价”操作所需的上下文
#[derive(Accounts)]
#[instruction(id: u64)] // 指令需要一个u64类型的参数id
pub struct MakeOffer<'info> {
    #[account(mut)] // maker账户是可变的，因为可能会有余额变化
    pub maker: Signer<'info>, // 创建报价的人，必须签名以证明身份

    #[account(mint::token_program = token_program)] // 指定token_mint_a使用的token程序
    pub token_mint_a: InterfaceAccount<'info, Mint>, // 第一种代币的铸币账户

    #[account(mint::token_program = token_program)] // 指定token_mint_b使用的token程序
    pub token_mint_b: InterfaceAccount<'info, Mint>, // 第二种代币的铸币账户

    // maker的关联token账户，用于转走token_mint_a，因此设置为可变
    #[account(
      mut,
      associated_token::mint = token_mint_a, // 关联到token_mint_a
      associated_token::authority = maker, // 权限属于maker
      associated_token::token_program = token_program // 使用的token程序
    )]
    pub maker_token_account_a: InterfaceAccount<'info, TokenAccount>,

    // 初始化报价账户，由maker支付租金，并根据给定的种子和bump生成唯一的地址
    #[account(
      init,
      payer = maker, 
      space = ANCHOR_DISCRIMILATOR + Offer::INIT_SPACE, // 账户所需空间
      seeds = [b"offer", maker.key().as_ref(), id.to_le_bytes().as_ref()], // 唯一标识符
      bump
    )]
    pub offer: Account<'info, Offer>, // 新创建的报价账户

    // 报价中的代币存储账户，与token_mint_a相关联，由报价账户控制
    #[account(
      mut,
      associated_token::mint = token_mint_a, // 关联到token_mint_a
      associated_token::authority = offer, // 权限属于报价账户
      associated_token::token_program = token_program // 使用的token程序
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>, // 存储报价中代币的账户

    pub token_program: Interface<'info, TokenInterface>, // SPL Token接口实例

    pub system_program: Program<'info, System>, // Solana系统程序，用于支付租金等

    pub associate_token_program: Program<'info, AssociatedToken>
}

// 处理函数，目前仅返回成功结果
pub fn send_offered_tokens_to_vault(ctx: &Context<MakeOffer>, token_a_offered_amount: u64) -> Result<()> {
    transfer_tokens(&ctx.accounts.maker_token_account_a, &ctx.accounts.vault, token_a_offered_amount, &ctx.accounts.token_mint_a, &ctx.accounts.maker, &ctx.accounts.token_program)
}

pub fn save_offer(ctx: Context<MakeOffer>, id: u64, token_b_wanted_amount: u64) -> Result<()> {
  ctx.accounts.offer.set_inner(Offer {
    id, 
    maker: ctx.accounts.maker.to_account_info().key(), 
    token_mint_a: ctx.accounts.token_mint_a.to_account_info().key(), 
    token_mint_b: ctx.accounts.token_mint_b.to_account_info().key(),
    token_b_wanted_amount, 
    bump: ctx.bumps.offer
  });
  Ok(())
}