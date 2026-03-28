import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { transactions } from "../drizzle/schema";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

export const swapRouter = router({
  // Get user's transaction history (private - only user can see their own)
  getHistory: protectedProcedure
    .input(z.object({
      type: z.enum(["deposit", "withdrawal", "swap", "onramp", "offramp"]).optional(),
      status: z.enum(["pending", "completed", "failed", "cancelled"]).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const { and } = await import("drizzle-orm");
      let conditions = [eq(transactions.userId, ctx.user.id)];

      if (input.type) {
        conditions.push(eq(transactions.type, input.type));
      }

      if (input.status) {
        conditions.push(eq(transactions.status, input.status));
      }

      const query = db.select().from(transactions).where(
        and(...conditions)
      );

      return query.limit(input.limit).offset(input.offset);
    }),

  // Get transaction details (private - only user can see their own)
  getTransaction: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db.select().from(transactions).where(
        eq(transactions.id, input.transactionId)
      ).limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      const transaction = result[0];

      // Verify user owns this transaction
      if (transaction.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this transaction",
        });
      }

      return transaction;
    }),

  // Initiate swap (multi-chain)
  initiateSwap: protectedProcedure
    .input(z.object({
      fromChain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
      toChain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
      fromToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      toToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      fromAmount: z.string().regex(/^\d+(\.\d{1,8})?$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Check if user is frozen
      if (ctx.user.accountFrozen) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been frozen",
        });
      }

      // TODO: Validate user has sufficient balance
      // TODO: Integrate with swap aggregator API (LI.FI or 0x)
      // For now, create a mock swap transaction

      const mockToAmount = (parseFloat(input.fromAmount) * 0.99).toFixed(8); // 1% slippage
      const mockFee = (parseFloat(input.fromAmount) * 0.01).toFixed(8);

      const result = await db.insert(transactions).values({
        userId: ctx.user.id,
        type: "swap",
        status: "pending",
        fromChain: input.fromChain,
        toChain: input.toChain,
        fromToken: input.fromToken,
        toToken: input.toToken,
        fromAmount: input.fromAmount,
        toAmount: mockToAmount,
        fee: mockFee,
        slippage: "1.00",
        description: `Swap ${input.fromAmount} ${input.fromToken.toUpperCase()} on ${input.fromChain} for ${input.toToken.toUpperCase()} on ${input.toChain}`,
      });

      return {
        success: true,
        transactionId: result[0].insertId,
        fromAmount: input.fromAmount,
        toAmount: mockToAmount,
        fee: mockFee,
        slippage: "1.00",
        message: "Swap initiated. Processing your transaction...",
      };
    }),

  // Get swap quote (estimated output)
  getSwapQuote: protectedProcedure
    .input(z.object({
      fromChain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
      toChain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
      fromToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      toToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      fromAmount: z.string().regex(/^\d+(\.\d{1,8})?$/),
    }))
    .query(async ({ input }) => {
      // TODO: Integrate with real swap aggregator API
      // Mock quote
      const fromAmount = parseFloat(input.fromAmount);
      const toAmount = fromAmount * 0.99; // 1% slippage
      const fee = fromAmount * 0.01;

      return {
        fromAmount: input.fromAmount,
        toAmount: toAmount.toFixed(8),
        fee: fee.toFixed(8),
        slippage: "1.00",
        estimatedTime: "2-5 minutes",
        priceImpact: "0.50%",
      };
    }),

  // Search/filter transaction history
  searchTransactions: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      minAmount: z.string().optional(),
      maxAmount: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      // TODO: Implement advanced search with full-text search or better filtering
      // For now, return recent transactions
      const result = await db.select().from(transactions).where(
        eq(transactions.userId, ctx.user.id)
      ).limit(input.limit);

      return result;
    }),
});
