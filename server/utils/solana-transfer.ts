import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { decryptSecret } from "./wallet-crypto";
import { ENV } from "../_core/env";
import type { SolanaWallet } from "../../drizzle/schema";

export async function sendSplToken(args: {
  fromWallet: Pick<SolanaWallet, "mainAddress" | "mainKeypair">;
  toAddress: string;
  mint: string;
  amount: bigint;
}): Promise<string> {
  const secretKey = new Uint8Array(decryptSecret(args.fromWallet.mainKeypair));
  const keypair = Keypair.fromSecretKey(secretKey);
  const connection = new Connection(ENV.solanaRpcUrl, "confirmed");
  const mint = new PublicKey(args.mint);
  const sender = new PublicKey(args.fromWallet.mainAddress);
  const recipient = new PublicKey(args.toAddress);

  const sourceAta = getAssociatedTokenAddressSync(mint, sender);
  const destAta = getAssociatedTokenAddressSync(mint, recipient);

  const tx = new Transaction().add(
    createTransferInstruction(sourceAta, destAta, sender, args.amount),
  );

  return sendAndConfirmTransaction(connection, tx, [keypair]);
}
