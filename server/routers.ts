import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { users, linkedWallets } from "../drizzle/schema";
import { getDb, getUserByOpenId, getAllUserWallets, insertLinkedWallet, linkExternalWallet } from "./db";
import { eq, and } from "drizzle-orm";
import { flowRouter } from "./routers/flow";
import { adminRouter } from "./routers/admin";
import { umbraRouter } from "./routers/umbra";
import { Keypair } from "@solana/web3.js";
import { randomBytes } from "crypto";
import { encryptSecret } from "./utils/wallet-crypto";
import { generateTonWallet, generateNearWallet, generateBitcoinWallet } from "./utils/wallet-provision";
import { Wallet } from "ethers";
import { registerWalletOnUmbra } from "./services/umbra";

export const appRouter = router({
  system: systemRouter,
  flow: flowRouter,
  admin: adminRouter,
  umbra: umbraRouter,

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
      const wallets = await getAllUserWallets(ctx.user.id);
      return wallets;
    }),

    createWallet: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const existing = await db
          .select()
          .from(linkedWallets)
          .where(and(eq(linkedWallets.userId, ctx.user.id), eq(linkedWallets.chain, "solana")))
          .limit(1);

        if (existing.length > 0) {
          return { success: true, solanaAddress: existing[0].address, alreadyExists: true };
        }

        // Provision server-side Solana privacy keypair for Umbra operations
        const privacyKeypair = Keypair.generate();
        const privacyAddress = privacyKeypair.publicKey.toBase58();
        await db
          .update(users)
          .set({ solanaPrivacyKeypair: encryptSecret(privacyKeypair.secretKey) })
          .where(eq(users.id, ctx.user.id));

        // Provision embedded Solana wallet (used for settlement/receiving)
        const keypair = Keypair.generate();
        const mainAddress = keypair.publicKey.toBase58();
        const stealthKey = encryptSecret(randomBytes(32));
        const claimKey = encryptSecret(randomBytes(32));

        const solanaWallet = await insertLinkedWallet({
          userId: ctx.user.id,
          chain: "solana",
          address: mainAddress,
          privateKey: encryptSecret(keypair.secretKey),
          isExternal: false,
          isDefault: true,
          stealthKey,
          claimKey,
          balance: "0",
          umbraScanIndex: 0,
        });

        try {
          await registerWalletOnUmbra(solanaWallet);
        } catch (err) {
          console.warn("[createWallet] registerWalletOnUmbra failed:", err);
        }

        // Provision embedded EVM wallet
        const evmWallet = Wallet.createRandom();
        await insertLinkedWallet({
          userId: ctx.user.id,
          chain: "evm",
          address: evmWallet.address,
          privateKey: encryptSecret(Buffer.from(evmWallet.privateKey.replace("0x", ""), "hex")),
          isExternal: false,
          isDefault: true,
          balance: "0",
        });

        // Provision embedded TON wallet
        const tonW = await generateTonWallet();
        await insertLinkedWallet({
          userId: ctx.user.id,
          chain: "ton",
          address: tonW.address,
          privateKey: encryptSecret(Buffer.from(tonW.privateKey, "hex")),
          isExternal: false,
          isDefault: true,
          balance: "0",
        });

        // Provision embedded NEAR wallet
        const nearW = generateNearWallet();
        await insertLinkedWallet({
          userId: ctx.user.id,
          chain: "near",
          address: nearW.address,
          privateKey: encryptSecret(Buffer.from(nearW.privateKey, "hex")),
          isExternal: false,
          isDefault: true,
          balance: "0",
        });

        // Provision embedded Bitcoin wallet
        const btcW = await generateBitcoinWallet();
        await insertLinkedWallet({
          userId: ctx.user.id,
          chain: "bitcoin",
          address: btcW.address,
          privateKey: encryptSecret(Buffer.from(btcW.privateKey, "hex")),
          isExternal: false,
          isDefault: true,
          balance: "0",
        });

        return { success: true, solanaAddress: mainAddress };
      }),

    linkWallet: protectedProcedure
      .input(z.object({
        chain: z.enum(["solana", "evm", "ton", "near", "bitcoin"]),
        address: z.string().min(1),
        signature: z.string().optional(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const wallet = await linkExternalWallet({
          userId: ctx.user.id,
          chain: input.chain,
          address: input.address,
        });
        return { success: true, wallet };
      }),

    unlinkWallet: protectedProcedure
      .input(z.object({
        walletId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const result = await db
          .delete(linkedWallets)
          .where(and(
            eq(linkedWallets.id, input.walletId),
            eq(linkedWallets.userId, ctx.user.id),
            eq(linkedWallets.isExternal, true),
          ))
          .returning();

        return { success: result.length > 0 };
      }),
  }),
});

export type AppRouter = typeof appRouter;
