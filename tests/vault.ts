import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Vault Program - Multi-User Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;
  const wallet = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let vaultPDA: PublicKey;
  let vaultTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let user1AccountPDA: PublicKey;
  let user2AccountPDA: PublicKey;
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  before(async () => {
    mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6
    );

    [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    const user1Ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      user1.publicKey
    );
    user1TokenAccount = user1Ata.address;

    const user2Ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      user2.publicKey
    );
    user2TokenAccount = user2Ata.address;

    const vaultAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      vaultPDA,
      true
    );
    vaultTokenAccount = vaultAta.address;

    [user1AccountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), user1.publicKey.toBuffer()],
      program.programId
    );

    [user2AccountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), user2.publicKey.toBuffer()],
      program.programId
    );

    // Transfer 2 SOL from owner wallet to each user
    await sendAndConfirmTransaction(
      provider.connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: user1.publicKey,
          lamports: 2 * LAMPORTS_PER_SOL,
        })
      ),
      [wallet.payer]
    );

    await sendAndConfirmTransaction(
      provider.connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: user2.publicKey,
          lamports: 2 * LAMPORTS_PER_SOL,
        })
      ),
      [wallet.payer]
    );
  });

  it("Initializes the vault", async () => {
    await program.methods
      .initialize(mint)
      .accounts({
        authority: wallet.publicKey,
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("User1 deposits tokens", async () => {
    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      user1TokenAccount,
      wallet.publicKey,
      100_000_000
    );

    await program.methods
      .deposit(new anchor.BN(30_000_000))
      .accounts({
        user: user1.publicKey,
        userTokenAccount: user1TokenAccount,
        vaultTokenAccount,
        vault: vaultPDA,
        userAccount: user1AccountPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();
  });

  it("User1 withdraws tokens", async () => {
    await program.methods
      .withdraw(new anchor.BN(10_000_000))
      .accounts({
        user: user1.publicKey,
        userTokenAccount: user1TokenAccount,
        vaultTokenAccount,
        vault: vaultPDA,
        userAccount: user1AccountPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();
  });

  it("User2 deposits tokens", async () => {
    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      user2TokenAccount,
      wallet.publicKey,
      100_000_000
    );

    await program.methods
      .deposit(new anchor.BN(40_000_000))
      .accounts({
        user: user2.publicKey,
        userTokenAccount: user2TokenAccount,
        vaultTokenAccount,
        vault: vaultPDA,
        userAccount: user2AccountPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();
  });

  it("User1 deposits again", async () => {
    await program.methods
      .deposit(new anchor.BN(20_000_000))
      .accounts({
        user: user1.publicKey,
        userTokenAccount: user1TokenAccount,
        vaultTokenAccount,
        vault: vaultPDA,
        userAccount: user1AccountPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();
  });

  it("User2 withdraws tokens", async () => {
    await program.methods
      .withdraw(new anchor.BN(30_000_000))
      .accounts({
        user: user2.publicKey,
        userTokenAccount: user2TokenAccount,
        vaultTokenAccount,
        vault: vaultPDA,
        userAccount: user2AccountPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();
  });

  it("User1 withdraws final tokens", async () => {
    await program.methods
      .withdraw(new anchor.BN(20_000_000))
      .accounts({
        user: user1.publicKey,
        userTokenAccount: user1TokenAccount,
        vaultTokenAccount,
        vault: vaultPDA,
        userAccount: user1AccountPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();
  });
});
