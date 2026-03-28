import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { users, wallets, Wallet } from "../drizzle/schema";
import { getDb, getUserByOpenId } from "./db";
import { eq } from "drizzle-orm";
import { fiatRouter } from "./fiat";
import { swapRouter } from "./swap";
import { adminRouter } from "./admin";

export const appRouter = router({
  system: systemRouter,
  fiat: fiatRouter,
  swap: swapRouter,
  admin: adminRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        username: z.string().min(3).max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const updateData: Record<string, any> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.phone !== undefined) updateData.phone = input.phone;
        if (input.username !== undefined) updateData.username = input.username;

        if (Object.keys(updateData).length === 0) {
          return ctx.user;
        }

        await db.update(users).set(updateData).where(eq(users.id, ctx.user.id));
        
        const updated = await getUserByOpenId(ctx.user.openId);
        return updated || ctx.user;
      }),

    verifyPhone: protectedProcedure
      .input(z.object({
        phone: z.string(),
        code: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // TODO: Implement actual phone verification with SMS provider
        // For now, accept any 6-digit code
        if (!/^\d{6}$/.test(input.code)) {
          throw new Error("Invalid verification code");
        }

        await db.update(users).set({
          phone: input.phone,
          phoneVerified: true,
        }).where(eq(users.id, ctx.user.id));

        const updated = await getUserByOpenId(ctx.user.openId);
        return updated || ctx.user;
      }),

    getWallets: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const result = await db.select().from(wallets).where(eq(wallets.userId, ctx.user.id));
      return result;
    }),

    createWallet: protectedProcedure
      .input(z.object({
        chain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // TODO: Implement actual wallet generation using blockchain SDKs
        // For now, generate a mock address
        const mockAddress = `${input.chain}_${ctx.user.id}_${Date.now()}`;
        
        const newWallet = await db.insert(wallets).values({
          userId: ctx.user.id,
          chain: input.chain,
          address: mockAddress,
          balance: "0",
        });

        return { success: true, chain: input.chain, address: mockAddress };
      }),
  }),
});

export type AppRouter = typeof appRouter;
