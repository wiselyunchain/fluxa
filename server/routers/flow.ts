import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { FlowService } from "../services/flows";
import { getUserWallets } from "../db";

export const flowRouter = router({
  deposit: protectedProcedure
    .input(
      z.object({
        nairaAmount: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallets = await getUserWallets(ctx.user.id);
      const wallet = wallets[0];
      if (!wallet) throw new Error("User has no Solana wallet setup");

      return FlowService.handleDeposit({
        userId: ctx.user.id,
        nairaAmount: input.nairaAmount,
        userWallet: wallet,
      });
    }),

  withdraw: protectedProcedure
    .input(
      z.object({
        usdtAmount: z.number().positive(),
        bankId: z.string(),
        accountNumber: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallets = await getUserWallets(ctx.user.id);
      const wallet = wallets[0];
      if (!wallet) throw new Error("User has no Solana wallet setup");

      return FlowService.handleWithdrawal({
        userId: ctx.user.id,
        usdtAmount: input.usdtAmount,
        bankId: input.bankId,
        accountNumber: input.accountNumber,
        userWallet: wallet,
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallets = await getUserWallets(ctx.user.id);
      const wallet = wallets[0];
      if (!wallet) throw new Error("User has no Solana wallet setup");

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
      });
    }),
});
