import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { wallets } from "../drizzle/schema";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  generateMultiChainWallet,
  validateWalletAddress,
  getWalletBalance,
  encryptPrivateKey,
} from "./wallets";

export const walletRouter = router({
  // Create new multi-chain wallet for user
  createWallet: protectedProcedure
    .input(
      z.object({
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      try {
        // Generate multi-chain wallet
        const multiChainWallet = await generateMultiChainWallet();

        // Store wallet addresses (private keys encrypted)
        const walletPromises = Object.entries(multiChainWallet.wallets).map(
          ([chain, wallet]) => {
            const encryptedPrivateKey = wallet.privateKey
              ? encryptPrivateKey(wallet.privateKey, input.password)
              : null;

            return db.insert(wallets).values({
              userId: ctx.user.id,
              chain: chain as any,
              address: wallet.address,
              publicKey: wallet.publicKey,
              encryptedPrivateKey,
            });
          }
        );

        await Promise.all(walletPromises);

        // Return wallet addresses (without private keys)
        return {
          success: true,
          message: "Multi-chain wallet created successfully",
          wallets: Object.entries(multiChainWallet.wallets).map(([chain, wallet]) => ({
            chain,
            address: wallet.address,
            publicKey: wallet.publicKey,
          })),
          mnemonic: multiChainWallet.mnemonic,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create wallet: ${error.message}`,
        });
      }
    }),

  // Get user's wallets
  getWallets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    try {
      const userWallets = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, ctx.user.id));

      return userWallets.map((w) => ({
        chain: w.chain,
        address: w.address,
        publicKey: w.publicKey,
        balance: w.balance,
        createdAt: w.createdAt,
      }));
    } catch (error: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch wallets: ${error.message}`,
      });
    }
  }),

  // Get wallet balance
  getBalance: protectedProcedure
    .input(
      z.object({
        chain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
        address: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        // Validate address
        if (!validateWalletAddress(input.address, input.chain)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid ${input.chain} address`,
          });
        }

        // Get balance from blockchain
        const balance = await getWalletBalance(input.address, input.chain);

        return {
          chain: input.chain,
          address: input.address,
          balance,
          symbol: getChainSymbol(input.chain),
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch balance: ${error.message}`,
        });
      }
    }),

  // Get all balances for user
  getAllBalances: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    try {
      const userWallets = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, ctx.user.id));

      const balances = await Promise.all(
        userWallets.map(async (w) => {
          const balance = await getWalletBalance(w.address, w.chain);
          return {
            chain: w.chain,
            address: w.address,
            balance,
            symbol: getChainSymbol(w.chain),
          };
        })
      );

      return balances;
    } catch (error: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch balances: ${error.message}`,
      });
    }
  }),

  // Validate wallet address
  validateAddress: protectedProcedure
    .input(
      z.object({
        chain: z.enum(["solana", "base", "bsc", "ton", "avalanche"]),
        address: z.string(),
      })
    )
    .query(async ({ input }) => {
      const isValid = validateWalletAddress(input.address, input.chain);
      return {
        valid: isValid,
        chain: input.chain,
        address: input.address,
      };
    }),
});

function getChainSymbol(chain: string): string {
  const symbols: Record<string, string> = {
    solana: "SOL",
    base: "ETH",
    bsc: "BNB",
    ton: "TON",
    avalanche: "AVAX",
  };
  return symbols[chain] || "UNKNOWN";
}
