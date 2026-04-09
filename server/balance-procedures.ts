import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  startBalancePolling,
  stopBalancePolling,
  pollAllWallets,
  getPollingStats,
  isPollingActive,
  updateSingleWallet,
  getWalletBalanceHistory,
  resetPollingStats,
} from "./balance-poller";
import { TRPCError } from "@trpc/server";

export const balanceRouter = router({
  // Admin: Start balance polling service
  startPolling: adminProcedure
    .input(
      z.object({
        intervalMs: z.number().min(5000).default(60000), // Minimum 5 seconds
        batchSize: z.number().min(1).default(10),
        maxRetries: z.number().min(1).default(3),
        retryDelayMs: z.number().min(100).default(1000),
        enableNotifications: z.boolean().default(true),
        balanceChangeThreshold: z.number().min(0).default(5), // Percentage
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (isPollingActive()) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Balance polling is already running",
          });
        }

        await startBalancePolling(input);

        return {
          success: true,
          message: "Balance polling started",
          config: input,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to start polling: ${error.message}`,
        });
      }
    }),

  // Admin: Stop balance polling service
  stopPolling: adminProcedure.mutation(async () => {
    try {
      if (!isPollingActive()) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Balance polling is not running",
        });
      }

      await stopBalancePolling();

      return {
        success: true,
        message: "Balance polling stopped",
      };
    } catch (error: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to stop polling: ${error.message}`,
      });
    }
  }),

  // Admin: Get polling status and statistics
  getStatus: adminProcedure.query(async () => {
    try {
      const stats = getPollingStats();
      const isActive = isPollingActive();

      return {
        isActive,
        stats,
      };
    } catch (error: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to get polling status: ${error.message}`,
      });
    }
  }),

  // Admin: Manually trigger a full poll
  triggerPoll: adminProcedure
    .input(
      z.object({
        intervalMs: z.number().default(60000),
        batchSize: z.number().default(10),
        maxRetries: z.number().default(3),
        retryDelayMs: z.number().default(1000),
        enableNotifications: z.boolean().default(false),
        balanceChangeThreshold: z.number().default(5),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const startTime = Date.now();
        await pollAllWallets(input);
        const duration = Date.now() - startTime;

        const stats = getPollingStats();

        return {
          success: true,
          message: "Manual poll completed",
          duration,
          stats,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to trigger poll: ${error.message}`,
        });
      }
    }),

  // Admin: Update a single wallet balance
  updateWallet: adminProcedure
    .input(
      z.object({
        walletId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const success = await updateSingleWallet(input.walletId);

        if (!success) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Wallet ${input.walletId} not found or update failed`,
          });
        }

        return {
          success: true,
          message: "Wallet balance updated",
          walletId: input.walletId,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update wallet: ${error.message}`,
        });
      }
    }),

  // Protected: Get balance history for user's wallet
  getBalanceHistory: protectedProcedure
    .input(
      z.object({
        walletId: z.number(),
        limit: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // TODO: Verify wallet belongs to user
        const history = await getWalletBalanceHistory(input.walletId, input.limit);

        return {
          walletId: input.walletId,
          history,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch balance history: ${error.message}`,
        });
      }
    }),

  // Admin: Reset polling statistics
  resetStats: adminProcedure.mutation(async () => {
    try {
      resetPollingStats();

      return {
        success: true,
        message: "Polling statistics reset",
      };
    } catch (error: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to reset statistics: ${error.message}`,
      });
    }
  }),

  // Protected: Check if polling is active
  isActive: protectedProcedure.query(async () => {
    return {
      isActive: isPollingActive(),
    };
  }),
});
