import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserWallets, getClaimableUmbraUtxos } from "../db";
import { unshieldEncryptedBalance, scanIncomingUtxos, createReceiverClaimableUtxo, claimUtxoToEncryptedBalance } from "../services/umbra";

export const umbraRouter = router({
  /**
   * Move tokens from the user's encrypted balance back to their public Solana
   * wallet (or a recipient they specify).
   */
  withdraw: protectedProcedure
    .input(
      z.object({
        tokenMint: z.string().min(32),
        amountBaseUnits: z.string().regex(/^\d+$/, "amount must be an integer string in base units"),
        recipient: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallets = await getUserWallets(ctx.user.id);
      const wallet = wallets[0];
      if (!wallet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User has no Solana wallet setup" });
      }

      return unshieldEncryptedBalance({
        userWallet: wallet,
        tokenMint: input.tokenMint,
        withdrawalAmount: BigInt(input.amountBaseUnits),
        recipient: input.recipient,
      });
    }),

  /**
   * Trigger an indexer scan for UTXOs decryptable with the user's keys.
   * Persists discovered receiver-claimable UTXOs to `umbra_utxos` so they show
   * up in `listClaimable` even after the request returns.
   */
  scanIncoming: protectedProcedure
    .input(
      z.object({
        treeIndex: z.number().int().nonnegative().optional(),
        startInsertionIndex: z.number().int().nonnegative().optional(),
        endInsertionIndex: z.number().int().nonnegative().optional(),
      }).optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const wallets = await getUserWallets(ctx.user.id);
      const wallet = wallets[0];
      if (!wallet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User has no Solana wallet setup" });
      }

      return scanIncomingUtxos({
        userWallet: wallet,
        treeIndex: input?.treeIndex,
        startInsertionIndex: input?.startInsertionIndex,
        endInsertionIndex: input?.endInsertionIndex,
      });
    }),

  /**
   * Read the persisted set of claimable UTXOs (populated by scanIncoming).
   * The claim step itself requires a ZK prover and is not yet exposed.
   */
  listClaimable: protectedProcedure.query(async ({ ctx }) => {
    return getClaimableUmbraUtxos(ctx.user.id);
  }),

  /**
   * Send tokens anonymously to another user's stealth public key.
   */
  send: protectedProcedure
    .input(
      z.object({
        tokenMint: z.string().min(32),
        amountBaseUnits: z.string().regex(/^\d+$/, "amount must be an integer string in base units"),
        receiverStealthPublicKey: z.string().min(32),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallets = await getUserWallets(ctx.user.id);
      const wallet = wallets[0];
      if (!wallet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User has no Solana wallet setup" });
      }

      return createReceiverClaimableUtxo({
        userWallet: wallet,
        tokenMint: input.tokenMint,
        transferAmount: BigInt(input.amountBaseUnits),
        receiverStealthPublicKey: input.receiverStealthPublicKey,
      });
    }),

  /**
   * Claim a received UTXO into the user's encrypted balance.
   */
  claim: protectedProcedure
    .input(
      z.object({
        tokenMint: z.string().min(32),
        commitment: z.string().min(1),
        amountBaseUnits: z.string().regex(/^\d+$/, "amount must be an integer string in base units"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wallets = await getUserWallets(ctx.user.id);
      const wallet = wallets[0];
      if (!wallet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User has no Solana wallet setup" });
      }

      return claimUtxoToEncryptedBalance({
        userWallet: wallet,
        tokenMint: input.tokenMint,
        commitment: input.commitment,
        amount: BigInt(input.amountBaseUnits),
      });
    }),
});
