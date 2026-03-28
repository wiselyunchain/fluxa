import { adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { users, transactions } from "../drizzle/schema";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

export const adminRouter = router({
  // Get all users (admin only)
  getUsers: adminProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // TODO: Implement search filtering
      const result = await db.select().from(users).limit(input.limit).offset(input.offset);
      return result;
    }),

  // Get user details (admin only)
  getUser: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return result[0];
    }),

  // Freeze/unfreeze user account (admin only)
  toggleAccountFreeze: adminProcedure
    .input(z.object({
      userId: z.number(),
      frozen: z.boolean(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // TODO: Log this action for audit trail
      // TODO: Notify user of account freeze

      await db.update(users).set({
        accountFrozen: input.frozen,
      }).where(eq(users.id, input.userId));

      return {
        success: true,
        message: `Account ${input.frozen ? "frozen" : "unfrozen"}`,
      };
    }),

  // Update user KYC status (admin only)
  updateKycStatus: adminProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(["none", "pending", "verified", "rejected"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // TODO: Log KYC decision for compliance
      // TODO: Notify user of KYC status change

      await db.update(users).set({
        kycStatus: input.status,
      }).where(eq(users.id, input.userId));

      return {
        success: true,
        message: `KYC status updated to ${input.status}`,
      };
    }),

  // Update daily transaction limit (admin only)
  updateDailyLimit: adminProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(users).set({
        dailyTransactionLimit: input.limit,
      }).where(eq(users.id, input.userId));

      return {
        success: true,
        message: `Daily limit updated to ₦${input.limit}`,
      };
    }),

  // Get transaction details (admin only)
  getTransaction: adminProcedure
    .input(z.object({
      transactionId: z.number(),
    }))
    .query(async ({ input }) => {
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

      return result[0];
    }),

  // Get all transactions (admin only)
  getTransactions: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      type: z.enum(["deposit", "withdrawal", "swap", "onramp", "offramp"]).optional(),
      status: z.enum(["pending", "completed", "failed", "cancelled"]).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // TODO: Implement filtering
      const result = await db.select().from(transactions).limit(input.limit).offset(input.offset);
      return result;
    }),

  // Flag transaction as suspicious (admin only)
  flagTransaction: adminProcedure
    .input(z.object({
      transactionId: z.number(),
      reason: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // TODO: Update transaction with flag
      // TODO: Create alert/notification
      // TODO: Log for compliance/audit

      return {
        success: true,
        message: `Transaction flagged as ${input.severity} severity`,
      };
    }),

  // Get risk alerts (admin only)
  getRiskAlerts: adminProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      // TODO: Implement risk alert system
      // Return mock alerts for now
      return [];
    }),

  // Get dashboard stats (admin only)
  getDashboardStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        return {
          totalUsers: 0,
          activeUsers: 0,
          totalTransactions: 0,
          totalVolume: "0",
          pendingTransactions: 0,
          flaggedTransactions: 0,
        };
      }

      // TODO: Implement real stats queries
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalTransactions: 0,
        totalVolume: "0",
        pendingTransactions: 0,
        flaggedTransactions: 0,
      };
    }),
});
