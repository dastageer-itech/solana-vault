use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("DS4GFpse2WfQztzucAAtk7NakqhT5bBnRUMsHWSu9CwZ");

#[program]
mod vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, mint: Pubkey) -> Result<()> {
        let bump = ctx.bumps.vault;

        let vault = &mut ctx.accounts.vault;
        vault.mint = mint;
        vault.bump = bump;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.user_token_account.mint == ctx.accounts.vault.mint,
            VaultError::InvalidToken
        );

        // Transfer tokens from user to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        let vault_seeds: &[&[u8]] = &[b"vault", &[ctx.accounts.vault.bump]];
        let signer_seeds = &[vault_seeds];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        token::transfer(cpi_ctx, amount)?;

        // Update user balance
        let user_account = &mut ctx.accounts.user_account;
        user_account.balance = user_account
            .balance
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        
        // Ensure user has enough balance
        require!(
            user_account.balance >= amount,
            VaultError::InsufficientBalance
        );
        
        // Ensure vault has enough tokens
        require!(
            ctx.accounts.vault_token_account.amount >= amount,
            VaultError::InsufficientVaultBalance
        );
        
        // Transfer tokens from vault to user
        let vault_seeds: &[&[u8]] = &[b"vault", &[ctx.accounts.vault.bump]];
        let signer_seeds = &[vault_seeds];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        
        token::transfer(cpi_ctx, amount)?;
        
        // Update user balance
        user_account.balance = user_account
            .balance
            .checked_sub(amount)
            .ok_or(VaultError::MathUnderflow)?;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + 32 + 1, seeds=[b"vault"], bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, constraint = user_token_account.mint == vault.mint)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.mint == vault.mint,
        constraint = vault_token_account.owner == vault.key()
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8,
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, constraint = user_token_account.mint == vault.mint)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.mint == vault.mint,
        constraint = vault_token_account.owner == vault.key()
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, has_one = user)]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct UserAccount {
    pub user: Pubkey,
    pub balance: u64,
}

#[account]
pub struct Vault {
    pub mint: Pubkey,
    pub bump: u8,
}

#[error_code]
pub enum VaultError {
    #[msg("Insufficient balance to withdraw")]
    InsufficientBalance,
    #[msg("Invalid token mint")]
    InvalidToken,
    #[msg("Vault does not have enough tokens")]
    InsufficientVaultBalance,
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Math underflow occurred")]
    MathUnderflow,
    #[msg("Missing bump seed")]
    MissingBump,
}
