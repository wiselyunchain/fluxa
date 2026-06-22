import { createDepositOrder, createWithdrawalOrder } from "./paj-cash";
import { getNearIntentClient } from "./near-intent";
import { insertFiatRequest, insertUserTransaction } from "../db";
import { sendSplToken } from "../utils/solana-transfer";
import type { SolanaWallet } from "../../drizzle/schema";

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
   * USDC (or other SPL) -> any destination via NEAR Intents 1Click.
   * Requests a quote, transfers the input tokens to the solver-controlled deposit
   * address, persists a swap row in user_transactions, and notifies 1Click of the
   * deposit so it can settle.
   */
  static async handleSwap(input: {
    userId: number;
    userWallet: Pick<SolanaWallet, "mainAddress" | "mainKeypair">;
    fromMintAddress: string;       // SPL mint to transfer from the user's wallet
    originAsset: string;            // 1Click assetId, e.g. nep141:sol-...omft.near
    destinationAsset: string;
    amountBaseUnits: string;        // integer string per 1Click spec
    recipient?: string;             // defaults to user's main address
    slippageBps?: number;
    deadlineSeconds?: number;
  }) {
    const client = getNearIntentClient();
    const recipient = input.recipient ?? input.userWallet.mainAddress;
    const deadlineSeconds = input.deadlineSeconds ?? 600;

    const quote = await client.quote({
      swapType: "EXACT_INPUT",
      slippageTolerance: input.slippageBps ?? 100,
      originAsset: input.originAsset,
      destinationAsset: input.destinationAsset,
      amount: input.amountBaseUnits,
      depositType: "ORIGIN_CHAIN",
      refundType: "ORIGIN_CHAIN",
      refundTo: input.userWallet.mainAddress,
      recipientType: "DESTINATION_CHAIN",
      recipient,
      deadline: new Date(Date.now() + deadlineSeconds * 1000).toISOString(),
    });

    const transferSignature = await sendSplToken({
      fromWallet: input.userWallet,
      toAddress: quote.quote.depositAddress,
      mint: input.fromMintAddress,
      amount: BigInt(input.amountBaseUnits),
    });

    const txn = await insertUserTransaction({
      userId: input.userId,
      type: "swap",
      status: "pending",
      fromChain: "SOLANA",
      toChain: null,
      fromToken: input.originAsset,
      toToken: input.destinationAsset,
      fromAmount: quote.quote.amountInFormatted ?? input.amountBaseUnits,
      toAmount: quote.quote.amountOutFormatted ?? quote.quote.amountOut,
      nearIntentId: quote.correlationId,
      nearIntentDepositAddress: quote.quote.depositAddress,
      nearIntentDepositMemo: quote.quote.depositMemo ?? null,
    });

    // Best-effort deposit notification so the solver can pick up the transfer
    // sooner. If this fails, the solver's deposit-watcher will still detect the
    // on-chain transfer; we don't want to roll back the user-visible swap row.
    try {
      await client.submitDeposit({
        txHash: transferSignature,
        depositAddress: quote.quote.depositAddress,
      });
    } catch (err) {
      console.warn(`[Swap] submitDeposit notification failed for ${quote.correlationId}:`, err);
    }

    return {
      transactionId: txn.id,
      correlationId: quote.correlationId,
      transferSignature,
      depositAddress: quote.quote.depositAddress,
      depositMemo: quote.quote.depositMemo,
      amountIn: quote.quote.amountIn,
      amountOut: quote.quote.amountOut,
      amountInFormatted: quote.quote.amountInFormatted,
      amountOutFormatted: quote.quote.amountOutFormatted,
      deadline: quote.quote.deadline,
    };
  }
}

