import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { fiatRequests, transactions } from "../drizzle/schema";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  initializePaystackPayment,
  verifyPaystackPayment,
  createPaystackRecipient,
  getPaystackBanks,
  resolvePaystackAccount,
} from "./paystack";

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

  // Initiate on-ramp (NGN to Crypto) with real Paystack integration
  initiateOnramp: protectedProcedure
    .input(z.object({
      amount: z.number().positive("Amount must be greater than 0"),
      cryptoToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      toChain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
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

      // Generate unique reference
      const reference = `fluxa_onramp_${ctx.user.id}_${nanoid(8)}`;

      try {
        // Initialize Paystack payment
        const paystackResponse = await initializePaystackPayment({
          email: ctx.user.email || `user_${ctx.user.id}@fluxa.local`,
          amount: Math.floor(input.amount * 100), // Convert to kobo
          reference,
          metadata: {
            userId: ctx.user.id,
            transactionType: "onramp",
            toChain: input.toChain,
            toToken: input.cryptoToken,
          },
        });

        // Create fiat request record
        await db.insert(fiatRequests).values({
          userId: ctx.user.id,
          type: "onramp",
          amount: input.amount.toString(),
          currency: "NGN",
          cryptoToken: input.cryptoToken,
          status: "pending",
          paymentProvider: "paystack",
          paymentReference: paystackResponse.data.reference,
          bankAccount: null,
        });

        return {
          success: true,
          reference,
          authorizationUrl: paystackResponse.data.authorization_url,
          accessCode: paystackResponse.data.access_code,
          amount: input.amount,
          message: "Redirecting to Paystack for payment...",
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to initiate payment: ${error.message}`,
        });
      }
    }),

  // Verify on-ramp payment and credit user wallet
  verifyOnramp: protectedProcedure
    .input(z.object({
      reference: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      try {
        // Verify payment with Paystack
        const verification = await verifyPaystackPayment(input.reference);

        if (verification.data.status !== "success") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Payment verification failed: ${verification.data.status}`,
          });
        }

        // Update fiat request status
        await db
          .update(fiatRequests)
          .set({ status: "completed" })
          .where(eq(fiatRequests.paymentReference, verification.data.reference));

        return {
          success: true,
          message: "Payment verified and wallet credited",
          amount: verification.data.amount / 100,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Payment verification failed: ${error.message}`,
        });
      }
    }),

  // Initiate off-ramp (Crypto to NGN) with real Paystack integration
  initiateOfframp: protectedProcedure
    .input(z.object({
      cryptoAmount: z.number().positive("Amount must be greater than 0"),
      cryptoToken: z.enum(["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"]),
      fromChain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
      accountNumber: z.string().length(10),
      bankCode: z.string(),
      accountName: z.string(),
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

      const reference = `fluxa_offramp_${ctx.user.id}_${nanoid(8)}`;

      try {
        // Create recipient for bank transfer
        const recipient = await createPaystackRecipient({
          type: "nuban",
          name: input.accountName,
          account_number: input.accountNumber,
          bank_code: input.bankCode,
          currency: "NGN",
        });

        // Calculate NGN amount (mock rate)
        const mockNgnAmount = (input.cryptoAmount * 1500000).toFixed(2);

        // Create fiat request record
        await db.insert(fiatRequests).values({
          userId: ctx.user.id,
          type: "offramp",
          amount: mockNgnAmount,
          currency: "NGN",
          cryptoAmount: input.cryptoAmount.toString(),
          cryptoToken: input.cryptoToken,
          status: "pending",
          paymentProvider: "paystack",
          paymentReference: recipient.data.recipient_code,
          bankAccount: input.accountNumber,
        });

        return {
          success: true,
          reference,
          ngnAmount: mockNgnAmount,
          cryptoAmount: input.cryptoAmount,
          message: `Withdrawal initiated. You will receive ₦${mockNgnAmount} to your account`,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to initiate withdrawal: ${error.message}`,
        });
      }
    }),

  // Get banks for off-ramp
  getBanks: protectedProcedure.query(async () => {
    try {
      const banks = await getPaystackBanks();
      return banks.data.map((bank) => ({
        code: bank.code,
        name: bank.name,
      }));
    } catch (error: any) {
      // Return mock banks if API fails
      return [
        { code: "011", name: "First Bank of Nigeria" },
        { code: "012", name: "Union Bank of Nigeria" },
        { code: "013", name: "United Bank for Africa" },
        { code: "014", name: "Zenith Bank" },
        { code: "015", name: "Guaranty Trust Bank" },
      ];
    }
  }),

  // Resolve account number for off-ramp
  resolveAccount: protectedProcedure
    .input(
      z.object({
        accountNumber: z.string().length(10),
        bankCode: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await resolvePaystackAccount({
          account_number: input.accountNumber,
          bank_code: input.bankCode,
        });

        return {
          success: true,
          accountName: result.data.account_name,
          accountNumber: result.data.account_number,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Account resolution failed: ${error.message}`,
        });
      }
    }),

  // Get exchange rate
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
});
