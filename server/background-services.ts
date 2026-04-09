import { startBalancePolling, PollingConfig } from "./balance-poller";

/**
 * Initialize all background services
 * This should be called when the server starts
 */
export async function initializeBackgroundServices(): Promise<void> {
  console.log("[Background Services] Initializing background services...");

  try {
    // Start balance polling with default configuration
    const pollingConfig: PollingConfig = {
      intervalMs: parseInt(process.env.BALANCE_POLL_INTERVAL || "60000"), // Default: 60 seconds
      batchSize: parseInt(process.env.BALANCE_POLL_BATCH_SIZE || "10"),
      maxRetries: parseInt(process.env.BALANCE_POLL_MAX_RETRIES || "3"),
      retryDelayMs: parseInt(process.env.BALANCE_POLL_RETRY_DELAY || "1000"),
      enableNotifications: process.env.BALANCE_POLL_NOTIFICATIONS === "true",
      balanceChangeThreshold: parseFloat(process.env.BALANCE_POLL_THRESHOLD || "5"),
    };

    console.log("[Background Services] Starting balance polling with config:", pollingConfig);
    await startBalancePolling(pollingConfig);

    console.log("[Background Services] All background services initialized successfully");
  } catch (error: any) {
    console.error("[Background Services] Error initializing background services:", error);
    // Don't throw - allow server to continue even if background services fail to start
  }
}

/**
 * Gracefully shutdown all background services
 * This should be called when the server shuts down
 */
export async function shutdownBackgroundServices(): Promise<void> {
  console.log("[Background Services] Shutting down background services...");

  try {
    const { stopBalancePolling } = await import("./balance-poller");
    await stopBalancePolling();

    console.log("[Background Services] All background services shut down successfully");
  } catch (error: any) {
    console.error("[Background Services] Error shutting down background services:", error);
  }
}
