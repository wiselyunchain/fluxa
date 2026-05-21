import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { users, solanaWallets } from "../drizzle/schema";
import { getDb, getUserByOpenId } from "./db";
import { eq } from "drizzle-orm";
import { flowRouter } from "./flow-procedures";
import { adminRouter } from "./admin";

export const appRouter = router({
  system: systemRouter,
  flow: flowRouter,
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

    getWallet: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db.select().from(solanaWallets).where(eq(solanaWallets.userId, ctx.user.id)).limit(1);
      return result.length > 0 ? result[0] : null;
    }),

    createWallet: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Generate a mock stealth address for now
        const mockAddress = `solana_${ctx.user.id}_${Date.now()}`;
        
        await db.insert(solanaWallets).values({
          userId: ctx.user.id,
          mainAddress: mockAddress,
          mainKeypair: "encrypted",
          stealthKey: "encrypted",
          claimKey: "encrypted",
          balance: "0",
        });

        return { success: true, address: mockAddress };
      }),
  }),
});

export type AppRouter = typeof appRouter;
