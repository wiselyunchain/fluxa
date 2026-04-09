import { getDb } from "./db";
import { wallets } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  getWalletBalance,
  getSolanaTokenBalance,
  getTokenBalance,
} from "./rpc-provider";
import { notifyOwner } from "./_core/notification";

export interface PollingConfig {
  intervalMs: number; // How often to poll (milliseconds)
  batchSize: number; // Number of wallets to poll per batch
  maxRetries: number; // Max retries on failure
  retryDelayMs: number; // Delay between retries
  enableNotifications: boolean; // Send alerts on balance changes
  balanceChangeThreshold: number; // Percentage change to trigger alert
}

export interface PollingStats {
  totalWallets: number;
  successfulUpdates: number;
  failedUpdates: number;
  totalBalanceUpdated: string;
  lastRunTime: Date;
  nextRunTime: Date;
  averageUpdateTime: number;
}

let pollingStats: PollingStats = {
  totalWallets: 0,
  successfulUpdates: 0,
  failedUpdates: 0,
  totalBalanceUpdated: "0",
  lastRunTime: new Date(),
  nextRunTime: new Date(),
  averageUpdateTime: 0,
};

let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false;

/**
 * Start the background balance polling service
 */
export async function startBalancePolling(config: PollingConfig): Promise<void> {
  if (pollingInterval) {
    console.warn("[Balance Poller] Polling already running");
    return;
  }

  console.log("[Balance Poller] Starting background balance polling service");
  console.log(`[Balance Poller] Poll interval: ${config.intervalMs}ms`);
  console.log(`[Balance Poller] Batch size: ${config.batchSize}`);

  // Run initial poll immediately
  await pollAllWallets(config);

  // Schedule recurring polls
  pollingInterval = setInterval(async () => {
    await pollAllWallets(config);
  }, config.intervalMs);

  console.log("[Balance Poller] Background polling service started");
}

/**
 * Stop the background balance polling service
 */
export async function stopBalancePolling(): Promise<void> {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[Balance Poller] Background polling service stopped");
  }
}

/**
 * Poll all wallets and update their balances
 */
export async function pollAllWallets(config: PollingConfig): Promise<void> {
  if (isPolling) {
    console.warn("[Balance Poller] Polling already in progress, skipping");
    return;
  }

  isPolling = true;
  const startTime = Date.now();

  try {
    const db = await getDb();
    if (!db) {
      console.error("[Balance Poller] Database unavailable");
      isPolling = false;
      return;
    }

    // Fetch all wallets
    const allWallets = await db.select().from(wallets);
    pollingStats.totalWallets = allWallets.length;

    console.log(`[Balance Poller] Polling ${allWallets.length} wallets...`);

    // Process wallets in batches
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < allWallets.length; i += config.batchSize) {
      const batch = allWallets.slice(i, i + config.batchSize);

      const batchPromises = batch.map((wallet) =>
        updateWalletBalance(wallet, config, db)
      );

      const results = await Promise.allSettled(batchPromises);

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          failureCount++;
          console.error("[Balance Poller] Batch error:", result.reason);
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + config.batchSize < allWallets.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    pollingStats.successfulUpdates = successCount;
    pollingStats.failedUpdates = failureCount;
    pollingStats.lastRunTime = new Date();
    pollingStats.nextRunTime = new Date(Date.now() + config.intervalMs);
    pollingStats.averageUpdateTime = (Date.now() - startTime) / allWallets.length;

    console.log(`[Balance Poller] Poll completed: ${successCount} success, ${failureCount} failed`);
    console.log(`[Balance Poller] Average update time: ${pollingStats.averageUpdateTime.toFixed(2)}ms per wallet`);
  } catch (error: any) {
    console.error("[Balance Poller] Error during polling:", error);
  } finally {
    isPolling = false;
  }
}

/**
 * Update a single wallet's balance
 */
async function updateWalletBalance(
  wallet: any,
  config: PollingConfig,
  db: any
): Promise<{ success: boolean; oldBalance?: string; newBalance?: string }> {
  try {
    // Get current balance from blockchain
    const newBalance = await getWalletBalance(wallet.address, wallet.chain);

    // Compare with stored balance
    const oldBalance = wallet.balance?.toString() || "0";
    const oldBalanceNum = parseFloat(oldBalance);
    const newBalanceNum = parseFloat(newBalance);

    // Check if balance changed significantly
    const percentChange =
      oldBalanceNum > 0
        ? Math.abs((newBalanceNum - oldBalanceNum) / oldBalanceNum) * 100
        : 0;

    const hasSignificantChange = percentChange >= config.balanceChangeThreshold;

    // Update database
    await db
      .update(wallets)
      .set({
        balance: newBalance,
        lastBalanceUpdate: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    // Send notification if balance changed significantly
    if (hasSignificantChange && config.enableNotifications) {
      await notifyOwner({
        title: "Wallet Balance Update",
        content: `Wallet ${wallet.address} on ${wallet.chain} balance changed from ${oldBalance} to ${newBalance} (${percentChange.toFixed(2)}% change)`,
      });
    }

    return {
      success: true,
      oldBalance,
      newBalance,
    };
  } catch (error: any) {
    console.error(`[Balance Poller] Error updating wallet ${wallet.address}:`, error.message);
    return { success: false };
  }
}

/**
 * Get current polling statistics
 */
export function getPollingStats(): PollingStats {
  return { ...pollingStats };
}

/**
 * Check if polling is currently running
 */
export function isPollingActive(): boolean {
  return pollingInterval !== null;
}

/**
 * Manually trigger a balance update for a specific wallet
 */
export async function updateSingleWallet(walletId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Balance Poller] Database unavailable");
      return false;
    }

    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (wallet.length === 0) {
      console.error(`[Balance Poller] Wallet ${walletId} not found`);
      return false;
    }

    const result = await updateWalletBalance(
      wallet[0],
      {
        intervalMs: 60000,
        batchSize: 10,
        maxRetries: 3,
        retryDelayMs: 1000,
        enableNotifications: false,
        balanceChangeThreshold: 5,
      },
      db
    );

    return result.success;
  } catch (error: any) {
    console.error("[Balance Poller] Error updating single wallet:", error);
    return false;
  }
}

/**
 * Get balance update history for a wallet
 */
export async function getWalletBalanceHistory(
  walletId: number,
  limit: number = 10
): Promise<
  Array<{
    balance: string;
    timestamp: Date;
  }>
> {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[Balance Poller] Database unavailable");
      return [];
    }

    // In production, you'd have a separate balance_history table
    // For now, return the current balance
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (wallet.length === 0) {
      return [];
    }

    return [
      {
        balance: wallet[0].balance?.toString() || "0",
        timestamp: wallet[0].lastBalanceUpdate || new Date(),
      },
    ];
  } catch (error: any) {
    console.error("[Balance Poller] Error fetching balance history:", error);
    return [];
  }
}

/**
 * Reset polling statistics
 */
export function resetPollingStats(): void {
  pollingStats = {
    totalWallets: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    totalBalanceUpdated: "0",
    lastRunTime: new Date(),
    nextRunTime: new Date(),
    averageUpdateTime: 0,
  };
  console.log("[Balance Poller] Statistics reset");
}
