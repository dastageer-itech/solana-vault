import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

describe("Vault Program - Initialize", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;
  const wallet = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let vaultPDA: PublicKey;
  let vaultBump: number;
  let userTokenAccount: PublicKey;

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
});
