import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { createDepositOrder, createWithdrawalOrder } from "./paj-cash";
import { insertFiatRequest } from "./db";
import { decryptSecret } from "./wallet-crypto";
import { ENV } from "./_core/env";
import type { SolanaWallet } from "../drizzle/schema";

export class FlowService {
  /**
   * NGN -> Private USDC.
   * Initiates a Paj Cash on-ramp order with the user's main Solana address as recipient,
   * persists a fiat_requests row, and returns the bank instructions for the UI.
   * Webhook completes the loop: Paj Cash funds the wallet → server shields into encrypted balance.
   */
  static async handleDeposit(input: {
    userId: number;
    nairaAmount: number;
    userWallet: Pick<SolanaWallet, "mainAddress">;
  }) {
    const order = await createDepositOrder({
      nairaAmount: input.nairaAmount,
      recipientAddress: input.userWallet.mainAddress,
    });

    await insertFiatRequest({
      userId: input.userId,
      type: "deposit",
      amount: input.nairaAmount.toString(),
      currency: "NGN",
      pajCashReference: order.id,
      status: "pending",
    });

    return {
      reference: order.id,
      accountNumber: order.accountNumber,
      accountName: order.accountName,
      bank: order.bank,
      fiatAmount: order.fiatAmount,
      usdtAmount: order.amount,
      rate: order.rate,
      fee: order.fee,
      mint: order.mint,
    };
  }

  /**
   * USDC -> NGN.
   * Initiates a Paj Cash off-ramp order, persists a fiat_requests row, and submits an SPL
   * transfer of the requested amount from the user's main wallet to Paj Cash's address.
   * Webhook completes the loop with the NGN settlement.
   */
  static async handleWithdrawal(input: {
    userId: number;
    usdtAmount: number;
    bankId: string;
    accountNumber: string;
    userWallet: Pick<SolanaWallet, "mainAddress" | "mainKeypair">;
  }) {
    const order = await createWithdrawalOrder({
      usdtAmount: input.usdtAmount,
      bankId: input.bankId,
      accountNumber: input.accountNumber,
    });

    await insertFiatRequest({
      userId: input.userId,
      type: "withdrawal",
      amount: order.fiatAmount.toString(),
      currency: "NGN",
      pajCashReference: order.id,
      status: "pending",
      bankAccount: `${input.bankId}:${input.accountNumber}`,
    });

    const transferSignature = await sendSplToken({
      fromWallet: input.userWallet,
      toAddress: order.address,
      mint: order.mint,
      amount: BigInt(Math.floor(input.usdtAmount)),
    });

    return {
      reference: order.id,
      transferSignature,
      pajCashAddress: order.address,
      fiatAmount: order.fiatAmount,
      rate: order.rate,
      fee: order.fee,
    };
  }

  /**
   * NEAR Intent path stubbed until Phase 4 lands real wiring.
   */
  static async handleSwap(): Promise<never> {
    throw new Error("Swap flow not implemented yet (Phase 4)");
  }
}

async function sendSplToken(args: {
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
