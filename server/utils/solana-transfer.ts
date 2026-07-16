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
import type { LinkedWallet } from "../../drizzle/schema";

export async function sendSplToken(args: {
  fromWallet: Pick<LinkedWallet, "address" | "privateKey">;
  toAddress: string;
  mint: string;
  amount: bigint;
}): Promise<string> {
  const pk = args.fromWallet.privateKey;
  if (!pk) throw new Error("No private key available for SPL transfer");
  const secretKey = new Uint8Array(decryptSecret(pk));
  const keypair = Keypair.fromSecretKey(secretKey);
  const connection = new Connection(ENV.solanaRpcUrl, "confirmed");
  const mint = new PublicKey(args.mint);
  const sender = new PublicKey(args.fromWallet.address);
  const recipient = new PublicKey(args.toAddress);

  const sourceAta = getAssociatedTokenAddressSync(mint, sender);
  const destAta = getAssociatedTokenAddressSync(mint, recipient);

  const tx = new Transaction().add(
    createTransferInstruction(sourceAta, destAta, sender, args.amount),
  );

  return sendAndConfirmTransaction(connection, tx, [keypair]);
}

/**
 * Build an unsigned SPL transfer transaction.
 * Returns the transaction as a base64-encoded string that the frontend
 * can deserialize, sign with a wallet adapter, and submit.
 */
export async function buildUnsignedSplTransfer(args: {
  fromAddress: string;
  toAddress: string;
  mint: string;
  amount: bigint;
}): Promise<{ unsignedTxBase64: string; blockhash: string; lastValidBlockHeight: number }> {
  const connection = new Connection(ENV.solanaRpcUrl, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const mint = new PublicKey(args.mint);
  const sender = new PublicKey(args.fromAddress);
  const recipient = new PublicKey(args.toAddress);

  const sourceAta = getAssociatedTokenAddressSync(mint, sender);
  const destAta = getAssociatedTokenAddressSync(mint, recipient);

  const tx = new Transaction({
    feePayer: sender,
    recentBlockhash: blockhash,
  });
  tx.add(createTransferInstruction(sourceAta, destAta, sender, args.amount));

  const unsignedTxBase64 = Buffer.from(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  ).toString("base64");

  return { unsignedTxBase64, blockhash, lastValidBlockHeight };
}

/**
 * Submit a pre-signed serialized transaction (base64) to Solana.
 * The transaction must already be signed by the user's external wallet.
 */
export async function submitSignedTransaction(signedTxBase64: string): Promise<string> {
  const connection = new Connection(ENV.solanaRpcUrl, "confirmed");
  const tx = Transaction.from(Buffer.from(signedTxBase64, "base64"));
  return sendAndConfirmTransaction(connection, tx, []);
}
