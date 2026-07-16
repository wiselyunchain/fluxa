import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { FlowService } from "../services/flows";
import { getUserWalletByChain, getUserTransactions } from "../db";

export const flowRouter = router({
  deposit: protectedProcedure
    .input(
      z.object({
        nairaAmount: z.number().positive(),
        mint: z.string().min(32).max(44).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = await getUserWalletByChain(ctx.user.id, "solana");
      if (!wallet) throw new Error("User has no Solana wallet setup");

      return FlowService.handleDeposit({
        userId: ctx.user.id,
        nairaAmount: input.nairaAmount,
        userWallet: wallet,
        mint: input.mint,
      });
    }),

  withdraw: protectedProcedure
    .input(
      z.object({
        usdtAmount: z.number().positive(),
        bankId: z.string(),
        accountNumber: z.string(),
        mint: z.string().min(32).max(44).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallet = await getUserWalletByChain(ctx.user.id, "solana");
      if (!wallet) throw new Error("User has no Solana wallet setup");

      return FlowService.handleWithdrawal({
        userId: ctx.user.id,
        usdtAmount: input.usdtAmount,
        bankId: input.bankId,
        accountNumber: input.accountNumber,
        userWallet: wallet,
        mint: input.mint,
      });
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        type: z.enum(["deposit", "withdrawal", "swap"]).optional(),
        status: z.enum(["pending", "confirmed", "failed", "cancelled"]).optional(),
        limit: z.number().int().positive().max(500).default(100),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      return getUserTransactions(ctx.user.id, {
        type: input?.type,
        status: input?.status,
        limit: input?.limit,
      });
    }),

  supportedTokens: protectedProcedure.query(async () => {
    const { getNearIntentClient } = await import("../services/near-intent");
    return getNearIntentClient().supportedTokens();
  }),

  getQuote: protectedProcedure
    .input(
      z.object({
        originAsset: z.string().min(1),
        destinationAsset: z.string().min(1),
        amountBaseUnits: z.string().regex(/^\d+$/, "amount must be an integer string in base units"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const wallet = await getUserWalletByChain(ctx.user.id, "solana");
      if (!wallet) throw new Error("User has no Solana wallet setup");

      const { getNearIntentClient } = await import("../services/near-intent");
      return getNearIntentClient().quote({
        dry: true,
        swapType: "EXACT_INPUT",
        depositType: "ORIGIN_CHAIN",
        refundType: "ORIGIN_CHAIN",
        recipientType: "DESTINATION_CHAIN",
        originAsset: input.originAsset,
        destinationAsset: input.destinationAsset,
        amount: input.amountBaseUnits,
        slippageTolerance: 100,
        refundTo: wallet.address,
        recipient: wallet.address,
        deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }),

  swap: protectedProcedure
    .input(
      z.object({
        fromMintAddress: z.string().min(32),
        originAsset: z.string().min(1),
        destinationAsset: z.string().min(1),
        amountBaseUnits: z.string().regex(/^\d+$/, "amount must be an integer string in base units"),
        recipient: z.string().optional(),
        slippageBps: z.number().int().min(0).max(10_000).optional(),
        deadlineSeconds: z.number().int().min(60).max(86_400).optional(),
        isPrivate: z.boolean().default(false).optional(),
        fromChain: z.enum(["solana", "evm", "ton", "near", "bitcoin"]).default("solana").optional(),
        destinationChain: z.enum(["solana", "evm", "ton", "near", "bitcoin"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const originChain: "solana" | "evm" | "ton" | "near" | "bitcoin" = input.fromChain ?? "solana";
      const wallet = await getUserWalletByChain(ctx.user.id, originChain);
      if (!wallet) throw new Error(`User has no ${originChain} wallet`);

      return FlowService.handleSwap({
        userId: ctx.user.id,
        userWallet: wallet,
        fromMintAddress: input.fromMintAddress,
        originAsset: input.originAsset,
        destinationAsset: input.destinationAsset,
        amountBaseUnits: input.amountBaseUnits,
        recipient: input.recipient,
        slippageBps: input.slippageBps,
        deadlineSeconds: input.deadlineSeconds,
        isPrivate: input.isPrivate,
        destinationChain: input.destinationChain,
        originChain,
      });
    }),

  prepareUnsignedSwap: protectedProcedure
    .input(
      z.object({
        fromMintAddress: z.string().min(32),
        fromAddress: z.string().min(32),
        originAsset: z.string().min(1),
        destinationAsset: z.string().min(1),
        amountBaseUnits: z.string().regex(/^\d+$/, "amount must be an integer string in base units"),
        recipient: z.string().optional(),
        slippageBps: z.number().int().min(0).max(10_000).optional(),
        deadlineSeconds: z.number().int().min(60).max(86_400).optional(),
        isPrivate: z.boolean().default(false).optional(),
        destinationChain: z.enum(["solana", "evm", "ton", "near", "bitcoin"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return FlowService.prepareUnsignedSwap({
        userId: ctx.user.id,
        fromAddress: input.fromAddress,
        fromMintAddress: input.fromMintAddress,
        originAsset: input.originAsset,
        destinationAsset: input.destinationAsset,
        amountBaseUnits: input.amountBaseUnits,
        recipient: input.recipient,
        slippageBps: input.slippageBps,
        deadlineSeconds: input.deadlineSeconds,
        isPrivate: input.isPrivate,
        destinationChain: input.destinationChain,
      });
    }),

  submitSwapSigned: protectedProcedure
    .input(
      z.object({
        signedTxBase64: z.string().min(1),
        correlationId: z.string().min(1),
        depositAddress: z.string().min(1),
        depositMemo: z.string().optional(),
        originAsset: z.string().min(1),
        destinationAsset: z.string().min(1),
        fromMintAddress: z.string().min(32),
        amountBaseUnits: z.string().regex(/^\d+$/, "amount must be an integer string in base units"),
        isPrivate: z.boolean().default(false).optional(),
        fromChain: z.enum(["solana", "evm", "ton", "near", "bitcoin"]).default("solana").optional(),
        destinationChain: z.enum(["solana", "evm", "ton", "near", "bitcoin"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return FlowService.submitSignedSwap({
        userId: ctx.user.id,
        signedTxBase64: input.signedTxBase64,
        correlationId: input.correlationId,
        depositAddress: input.depositAddress,
        depositMemo: input.depositMemo,
        originAsset: input.originAsset,
        destinationAsset: input.destinationAsset,
        fromMintAddress: input.fromMintAddress,
        amountBaseUnits: input.amountBaseUnits,
        isPrivate: input.isPrivate,
        fromChain: input.fromChain as "solana" | "evm" | "ton" | "near" | "bitcoin",
        destinationChain: input.destinationChain as "solana" | "evm" | "ton" | "near" | "bitcoin" | undefined,
      });
    }),
});
