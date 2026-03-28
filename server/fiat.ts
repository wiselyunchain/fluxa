import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { fiatRequests, transactions } from "../drizzle/schema";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";

export const fiatRouter = router({
  // Get user's fiat requests (on-ramp/off-ramp history)
  getRequests: protectedProcedure
    .input(z.object({
      type: z.enum(["onramp", "offramp"]).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions = [eq(fiatRequests.userId, ctx.user.id)];

      if (input.type) {
        conditions.push(eq(fiatRequests.type, input.type));
      }

      const query = db.select().from(fiatRequests).where(
        and(...conditions)
      );

      return query.limit(input.limit).offset(input.offset);
    }),

  // Initiate on-ramp (NGN to Crypto)
  initiateOnramp: protectedProcedure
    .input(z.object({
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/), // NGN amount
      cryptoToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      bankAccount: z.string().optional(),
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

      // TODO: Validate amount against daily limit
      // TODO: Integrate with Paystack/Flutterwave API
      // For now, create a mock payment request

      const mockPaymentReference = `PAY_${ctx.user.id}_${Date.now()}`;
      const mockVirtualAccount = `9876543210${ctx.user.id}`;

      const result = await db.insert(fiatRequests).values({
        userId: ctx.user.id,
        type: "onramp",
        amount: input.amount,
        currency: "NGN",
        cryptoToken: input.cryptoToken,
        status: "pending",
        paymentProvider: "paystack", // TODO: Make configurable
        paymentReference: mockPaymentReference,
        bankAccount: input.bankAccount || mockVirtualAccount,
      });

      return {
        success: true,
        paymentReference: mockPaymentReference,
        bankAccount: mockVirtualAccount,
        amount: input.amount,
        message: "Transfer ₦" + input.amount + " to the account above to complete your purchase",
      };
    }),

  // Initiate off-ramp (Crypto to NGN)
  initiateOfframp: protectedProcedure
    .input(z.object({
      cryptoAmount: z.string().regex(/^\d+(\.\d{1,8})?$/), // Crypto amount
      cryptoToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      bankAccount: z.string(), // User's bank account for NGN transfer
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

      // TODO: Validate crypto amount
      // TODO: Get current exchange rate
      // TODO: Integrate with Paystack/Flutterwave API

      const mockNgnAmount = (parseFloat(input.cryptoAmount) * 1500000).toFixed(2); // Mock rate
      const mockPaymentReference = `WD_${ctx.user.id}_${Date.now()}`;

      const result = await db.insert(fiatRequests).values({
        userId: ctx.user.id,
        type: "offramp",
        amount: mockNgnAmount,
        currency: "NGN",
        cryptoAmount: input.cryptoAmount,
        cryptoToken: input.cryptoToken,
        status: "pending",
        paymentProvider: "paystack",
        paymentReference: mockPaymentReference,
        bankAccount: input.bankAccount,
      });

      return {
        success: true,
        paymentReference: mockPaymentReference,
        ngnAmount: mockNgnAmount,
        cryptoAmount: input.cryptoAmount,
        message: "Withdrawal initiated. You will receive ₦" + mockNgnAmount + " to your account",
      };
    }),

  // Get exchange rate (mock)
  getExchangeRate: protectedProcedure
    .input(z.object({
      fromToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      toToken: z.enum(["ngn"]),
    }))
    .query(async ({ input }) => {
      // TODO: Integrate with real exchange rate API (CoinGecko, etc.)
      // Mock rates
      const rates: Record<string, number> = {
        usdt: 1500000,
        usdc: 1500000,
        usde: 1500000,
        sol: 75000000,
        eth: 3000000000,
        bnb: 600000000,
        ton: 75000000,
        avax: 150000000,
      };

      return {
        rate: rates[input.fromToken] || 0,
        from: input.fromToken,
        to: input.toToken,
        timestamp: new Date(),
      };
    }),

  // Confirm payment (webhook from payment provider)
  confirmPayment: protectedProcedure
    .input(z.object({
      paymentReference: z.string(),
      status: z.enum(["completed", "failed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // TODO: Verify payment with payment provider
      // TODO: Update fiat request status
      // TODO: Create transaction record
      // TODO: Update user wallet balance

      return {
        success: true,
        message: "Payment confirmed",
      };
    }),
});
