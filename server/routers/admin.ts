import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { users, userTransactions, riskFlags, auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  or,
  sum,
  type SQL,
} from "drizzle-orm";
import { initiatePlatformSession, verifyPlatformSession } from "../services/paj-cash";

const ACTIVE_USER_WINDOW_DAYS = 30;

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

      const search = input.search?.trim();
      if (search) {
        const pattern = `%${search}%`;
        return db
          .select()
          .from(users)
          .where(
            or(
              ilike(users.username, pattern),
              ilike(users.email, pattern),
              ilike(users.name, pattern),
            ),
          )
          .limit(input.limit)
          .offset(input.offset);
      }

      return db.select().from(users).limit(input.limit).offset(input.offset);
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
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(users).set({
        accountFrozen: input.frozen,
      }).where(eq(users.id, input.userId));

      await db.insert(auditLogs).values({
        adminId: ctx.user.id,
        action: input.frozen ? "freeze_account" : "unfreeze_account",
        targetUserId: input.userId,
        details: input.reason ?? null,
      });

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
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(users).set({
        kycStatus: input.status,
      }).where(eq(users.id, input.userId));

      await db.insert(auditLogs).values({
        adminId: ctx.user.id,
        action: "update_kyc_status",
        targetUserId: input.userId,
        details: JSON.stringify({ status: input.status, notes: input.notes ?? null }),
      });

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
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(users).set({
        dailyTransactionLimit: input.limit,
      }).where(eq(users.id, input.userId));

      await db.insert(auditLogs).values({
        adminId: ctx.user.id,
        action: "update_daily_limit",
        targetUserId: input.userId,
        details: JSON.stringify({ limit: input.limit }),
      });

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

      const result = await db.select().from(userTransactions).where(
        eq(userTransactions.id, input.transactionId)
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
      type: z.enum(["deposit", "withdrawal", "swap"]).optional(),
      status: z.enum(["pending", "confirmed", "failed", "cancelled"]).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const filters: SQL[] = [];
      if (input.userId !== undefined) filters.push(eq(userTransactions.userId, input.userId));
      if (input.type) filters.push(eq(userTransactions.type, input.type));
      if (input.status) filters.push(eq(userTransactions.status, input.status));

      const where = filters.length === 0
        ? undefined
        : filters.length === 1
          ? filters[0]
          : and(...filters);

      const base = db.select().from(userTransactions);
      const filtered = where ? base.where(where) : base;
      return filtered
        .orderBy(desc(userTransactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // Flag transaction as suspicious (admin only)
  flagTransaction: adminProcedure
    .input(z.object({
      transactionId: z.number(),
      reason: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const txn = await db
        .select({ id: userTransactions.id, userId: userTransactions.userId })
        .from(userTransactions)
        .where(eq(userTransactions.id, input.transactionId))
        .limit(1);

      if (txn.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      await db.insert(riskFlags).values({
        userId: txn[0].userId,
        flagType: "manual_review",
        severity: input.severity,
        description: `Transaction #${input.transactionId} flagged: ${input.reason}`,
      });

      await db.insert(auditLogs).values({
        adminId: ctx.user.id,
        action: "flag_transaction",
        targetUserId: txn[0].userId,
        details: JSON.stringify({
          transactionId: input.transactionId,
          severity: input.severity,
          reason: input.reason,
        }),
      });

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
      includeResolved: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const base = db.select().from(riskFlags);
      const filtered = input.includeResolved
        ? base
        : base.where(eq(riskFlags.resolved, false));

      return filtered
        .orderBy(desc(riskFlags.createdAt))
        .limit(input.limit)
        .offset(input.offset);
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

      const windowStart = new Date(Date.now() - ACTIVE_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const [
        [{ value: totalUsers }],
        [{ value: activeUsers }],
        [{ value: totalTransactions }],
        [{ value: totalVolume }],
        [{ value: pendingTransactions }],
        [{ value: flaggedTransactions }],
      ] = await Promise.all([
        db.select({ value: count() }).from(users),
        db
          .select({ value: countDistinct(userTransactions.userId) })
          .from(userTransactions)
          .where(gte(userTransactions.createdAt, windowStart)),
        db.select({ value: count() }).from(userTransactions),
        db
          .select({ value: sum(userTransactions.fromAmount) })
          .from(userTransactions)
          .where(eq(userTransactions.status, "confirmed")),
        db
          .select({ value: count() })
          .from(userTransactions)
          .where(eq(userTransactions.status, "pending")),
        db
          .select({ value: count() })
          .from(riskFlags)
          .where(eq(riskFlags.resolved, false)),
      ]);

      return {
        totalUsers: Number(totalUsers ?? 0),
        activeUsers: Number(activeUsers ?? 0),
        totalTransactions: Number(totalTransactions ?? 0),
        totalVolume: (totalVolume ?? "0").toString(),
        pendingTransactions: Number(pendingTransactions ?? 0),
        flaggedTransactions: Number(flaggedTransactions ?? 0),
      };
    }),

  // Capture a Paj Cash platform session OTP (step 1: request OTP)
  pajCashInitiate: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const result = await initiatePlatformSession(input.email);
      return { ok: true, email: result.email ?? input.email };
    }),

  // Capture a Paj Cash platform session OTP (step 2: verify + persist token)
  pajCashVerify: adminProcedure
    .input(z.object({ email: z.string().email(), otp: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { expiresAt } = await verifyPlatformSession(input.email, input.otp);
      return { ok: true, expiresAt: expiresAt.toISOString() };
    }),
});
