import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { FlowService } from "./flows";
import { getDb } from "./db";
import { solanaWallets } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const flowRouter = router({
  deposit: protectedProcedure
    .input(z.object({
      nairaAmount: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      
      const userWallet = await db.select().from(solanaWallets).where(eq(solanaWallets.userId, ctx.user.id)).limit(1);
      if (userWallet.length === 0) throw new Error("User has no Solana wallet setup");
      
      return await FlowService.handleDeposit(
        ctx.user.id.toString(), 
        input.nairaAmount, 
        userWallet[0].mainAddress
      );
    }),

  withdraw: protectedProcedure
    .input(z.object({
      usdtAmount: z.number().positive(),
      bankAccount: z.string(),
      bankCode: z.string(),
      accountName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userWallet = await db.select().from(solanaWallets).where(eq(solanaWallets.userId, ctx.user.id)).limit(1);
      if (userWallet.length === 0) throw new Error("User has no Solana wallet setup");

      return await FlowService.handleWithdrawal(
        ctx.user.id.toString(),
        input.usdtAmount,
        input.bankAccount,
        input.bankCode,
        input.accountName,
        userWallet[0].mainAddress
      );
    }),

  swap: protectedProcedure
    .input(z.object({
      fromToken: z.string(),
      fromChain: z.string(),
      fromAmount: z.number().positive(),
      toToken: z.string(),
      toChain: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      
      const userWallet = await db.select().from(solanaWallets).where(eq(solanaWallets.userId, ctx.user.id)).limit(1);
      if (userWallet.length === 0) throw new Error("User has no Solana wallet setup");

      return await FlowService.handleSwap(
        ctx.user.id.toString(),
        input.fromToken,
        input.fromChain,
        input.fromAmount,
        input.toToken,
        input.toChain,
        userWallet[0].mainAddress
      );
    }),
});
