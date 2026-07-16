import { createDepositOrder, createWithdrawalOrder } from "./paj-cash";
import { getNearIntentClient } from "./near-intent";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { insertFiatRequest, insertUserTransaction, insertSolanaStealthAddress } from "../db";
import { sendSplToken, buildUnsignedSplTransfer, submitSignedTransaction } from "../utils/solana-transfer";
import { unshieldEncryptedBalance } from "./umbra";
import type { LinkedWallet } from "../../drizzle/schema";

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
    userWallet: Pick<LinkedWallet, "address">;
  }) {
    const order = await createDepositOrder({
      nairaAmount: input.nairaAmount,
      recipientAddress: input.userWallet.address,
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
    userWallet: Pick<LinkedWallet, "address" | "privateKey">;
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

    const unshieldResult = await unshieldEncryptedBalance({
      userWallet: { ...input.userWallet, userId: input.userId },
      tokenMint: order.mint,
      withdrawalAmount: BigInt(Math.floor(input.usdtAmount * 1_000_000)),
      recipient: order.address,
    });

    return {
      reference: order.id,
      transferSignature: unshieldResult.queueSignature,
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
    userWallet: Pick<LinkedWallet, "address" | "privateKey">;
    fromMintAddress: string;
    originAsset: string;
    destinationAsset: string;
    amountBaseUnits: string;
    recipient?: string;
    slippageBps?: number;
    deadlineSeconds?: number;
    isPrivate?: boolean;
    destinationChain?: "solana" | "evm" | "ton" | "near" | "bitcoin";
    originChain: "solana" | "evm" | "ton" | "near" | "bitcoin";
  }) {
    const client = getNearIntentClient();
    
    let ephemeralKeypair: Keypair | undefined;
    let recipient = input.recipient ?? input.userWallet.address;

    if (input.isPrivate) {
      const tokens = await client.supportedTokens();
      const destToken = tokens.find(t => t.assetId === input.destinationAsset);
      
      const { UMBRA_SUPPORTED_TOKENS } = await import("./umbra");
      const supportedMints = Object.values(UMBRA_SUPPORTED_TOKENS);
      
      const isDestUmbraSupported = destToken && destToken.blockchain.toLowerCase() === "solana" && destToken.contractAddress && supportedMints.includes(destToken.contractAddress);
      
      if (isDestUmbraSupported) {
        ephemeralKeypair = Keypair.generate();
        while (ephemeralKeypair.publicKey.toBase58().length !== 43) {
          ephemeralKeypair = Keypair.generate();
        }
        recipient = ephemeralKeypair.publicKey.toBase58();
      } else {
        if (!input.recipient) {
          throw new Error("A recipient address is required for cross-chain private swaps.");
        }
        recipient = input.recipient;
      }
    }

    const deadlineSeconds = input.deadlineSeconds ?? 600;

    const quote = await client.quote({
      dry: false,
      swapType: "EXACT_INPUT",
      slippageTolerance: input.slippageBps ?? 100,
      originAsset: input.originAsset,
      destinationAsset: input.destinationAsset,
      amount: input.amountBaseUnits,
      depositType: "ORIGIN_CHAIN",
      refundType: "ORIGIN_CHAIN",
      refundTo: input.userWallet.address,
      recipientType: "DESTINATION_CHAIN",
      recipient,
      deadline: new Date(Date.now() + deadlineSeconds * 1000).toISOString(),
    });

    let transferSignature: string;
    
    if (input.isPrivate) {
      // For private swap, we unshield from Umbra balance directly to solver's deposit address
      const { unshieldEncryptedBalance } = await import("./umbra");
      const unshieldResult = await unshieldEncryptedBalance({
        userWallet: { ...input.userWallet, userId: input.userId },
        tokenMint: input.fromMintAddress === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" : input.fromMintAddress,
        withdrawalAmount: BigInt(input.amountBaseUnits),
        recipient: quote.quote.depositAddress,
      });
      transferSignature = unshieldResult.queueSignature;
    } else {
      transferSignature = await sendSplToken({
        fromWallet: input.userWallet,
        toAddress: quote.quote.depositAddress,
        mint: input.fromMintAddress,
        amount: BigInt(input.amountBaseUnits),
      });
    }

    const txn = await insertUserTransaction({
      userId: input.userId,
      type: "swap",
      status: "pending",
      fromChain: input.originChain.toUpperCase(),
      toChain: input.destinationChain ? input.destinationChain.toUpperCase() : null,
      fromToken: input.originAsset,
      toToken: input.destinationAsset,
      fromAmount: quote.quote.amountInFormatted ?? input.amountBaseUnits,
      toAmount: quote.quote.amountOutFormatted ?? quote.quote.amountOut,
      nearIntentId: quote.correlationId,
      nearIntentDepositAddress: quote.quote.depositAddress,
      nearIntentDepositMemo: quote.quote.depositMemo ?? null,
      isPrivate: input.isPrivate || false,
    });

    if (input.isPrivate && ephemeralKeypair) {
      const { encryptSecret } = await import("../utils/wallet-crypto");
      await insertSolanaStealthAddress({
        userId: input.userId,
        stealthAddress: recipient,
        ephemeralKeypair: encryptSecret(ephemeralKeypair.secretKey),
        transactionId: txn.id,
        claimed: false,
      });
    }

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

  /**
   * Build an unsigned Solana SPL transfer transaction for a NEAR Intent swap.
   * The frontend signs this with the user's external wallet adapter and
   * then calls submitSignedSwap to finalize.
   */
  static async prepareUnsignedSwap(input: {
    userId: number;
    fromAddress: string;
    fromMintAddress: string;
    originAsset: string;
    destinationAsset: string;
    amountBaseUnits: string;
    recipient?: string;
    slippageBps?: number;
    deadlineSeconds?: number;
    isPrivate?: boolean;
    destinationChain?: "solana" | "evm" | "ton" | "near" | "bitcoin";
  }) {
    const client = getNearIntentClient();
    const recipient = input.recipient ?? input.fromAddress;

    const deadlineSeconds = input.deadlineSeconds ?? 600;

    const quote = await client.quote({
      dry: false,
      swapType: "EXACT_INPUT",
      slippageTolerance: input.slippageBps ?? 100,
      originAsset: input.originAsset,
      destinationAsset: input.destinationAsset,
      amount: input.amountBaseUnits,
      depositType: "ORIGIN_CHAIN",
      refundType: "ORIGIN_CHAIN",
      refundTo: input.fromAddress,
      recipientType: "DESTINATION_CHAIN",
      recipient,
      deadline: new Date(Date.now() + deadlineSeconds * 1000).toISOString(),
    });

    const { unsignedTxBase64, blockhash, lastValidBlockHeight } = await buildUnsignedSplTransfer({
      fromAddress: input.fromAddress,
      toAddress: quote.quote.depositAddress,
      mint: input.fromMintAddress,
      amount: BigInt(input.amountBaseUnits),
    });

    return {
      unsignedTxBase64,
      blockhash,
      lastValidBlockHeight,
      correlationId: quote.correlationId,
      depositAddress: quote.quote.depositAddress,
      depositMemo: quote.quote.depositMemo,
      amountIn: quote.quote.amountIn,
      amountOut: quote.quote.amountOut,
      amountInFormatted: quote.quote.amountInFormatted,
      amountOutFormatted: quote.quote.amountOutFormatted,
      deadline: quote.quote.deadline,
    };
  }

  /**
   * Submit a pre-signed swap transaction and record the swap.
   * Called after the user signs with their external wallet.
   */
  static async submitSignedSwap(input: {
    userId: number;
    signedTxBase64: string;
    correlationId: string;
    depositAddress: string;
    depositMemo?: string;
    originAsset: string;
    destinationAsset: string;
    fromMintAddress: string;
    amountBaseUnits: string;
    isPrivate?: boolean;
    fromChain: "solana" | "evm" | "ton" | "near" | "bitcoin";
    destinationChain?: "solana" | "evm" | "ton" | "near" | "bitcoin";
  }) {
    const client = getNearIntentClient();

    const transferSignature = await submitSignedTransaction(input.signedTxBase64);

    const txn = await insertUserTransaction({
      userId: input.userId,
      type: "swap",
      status: "pending",
      fromChain: input.fromChain,
      toChain: input.destinationChain ?? null,
      fromToken: input.originAsset,
      toToken: input.destinationAsset,
      fromAmount: input.amountBaseUnits,
      toAmount: null,
      nearIntentId: input.correlationId,
      nearIntentDepositAddress: input.depositAddress,
      nearIntentDepositMemo: input.depositMemo ?? null,
      isPrivate: input.isPrivate || false,
    });

    try {
      await client.submitDeposit({
        txHash: transferSignature,
        depositAddress: input.depositAddress,
      });
    } catch (err) {
      console.warn(`[Swap] submitDeposit notification failed for ${input.correlationId}:`, err);
    }

    return {
      transactionId: txn.id,
      correlationId: input.correlationId,
      transferSignature,
      depositAddress: input.depositAddress,
      depositMemo: input.depositMemo,
    };
  }
}

