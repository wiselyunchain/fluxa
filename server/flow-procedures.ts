import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { FlowService } from "./flows";
import { getUserWallets } from "./db";

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
    .mutation(async () => {
      throw new Error("Swap flow not implemented yet (Phase 4)");
    }),
});
