import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  transfer,
} from "@solana/spl-token";

describe("Vault Program - Initialize, Deposit, Withdraw", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;
  const wallet = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let vaultPDA: PublicKey;
  let vaultBump: number;
  let userTokenAccount: PublicKey;
  let vaultTokenAccount: PublicKey;
  let userAccountPDA: PublicKey;
  let userAccountBump: number;

  before(async () => {
    // Create a new SPL token mint
    mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6 // 6 decimal places
    );

    // Find the PDA for the vault account
    [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // Create an associated token account for the user
    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );
    userTokenAccount = userAta.address;

    // Create an associated token account for the vault
    const vaultAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      vaultPDA,
      true
    );
    vaultTokenAccount = vaultAta.address;

    // Find the PDA for the user's vault account
    [userAccountPDA, userAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), wallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes the vault", async () => {
    try {
      const tx = await program.methods
        .initialize(mint)
        .accounts({
          authority: wallet.publicKey,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Vault initialized, transaction signature:", tx);
    } catch (error) {
      console.error("Failed to initialize vault:", error);
    }
  });

  it("Deposits tokens into the vault", async () => {
    // Mint tokens to the user's token account
    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      userTokenAccount,
      wallet.publicKey,
      100_000_000 // 100 tokens (assuming 6 decimals)
    );

    try {
      const tx = await program.methods
        .deposit(new anchor.BN(50_000_000)) // 50 tokens
        .accounts({
          user: wallet.publicKey,
          userTokenAccount,
          vaultTokenAccount,
          vault: vaultPDA,
          userAccount: userAccountPDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Tokens deposited, transaction signature:", tx);
    } catch (error) {
      console.error("Failed to deposit tokens:", error);
    }
  });

  it("Withdraws tokens from the vault", async () => {
    try {
      const tx = await program.methods
        .withdraw(new anchor.BN(30_000_000)) // Withdraw 30 tokens
        .accounts({
          user: wallet.publicKey,
          userTokenAccount,
          vaultTokenAccount,
          vault: vaultPDA,
          userAccount: userAccountPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Tokens withdrawn, transaction signature:", tx);
    } catch (error) {
      console.error("Failed to withdraw tokens:", error);
    }
  });
});
