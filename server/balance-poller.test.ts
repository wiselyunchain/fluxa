import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  startBalancePolling,
  stopBalancePolling,
  getPollingStats,
  isPollingActive,
  resetPollingStats,
} from "./balance-poller";

describe("Balance Poller", () => {
  afterEach(async () => {
    // Clean up after each test
    if (isPollingActive()) {
      await stopBalancePolling();
    }
    resetPollingStats();
  });

  it("starts balance polling service", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);

    // Give it a moment to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);
  });

  it("stops balance polling service", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);

    await stopBalancePolling();

    expect(isPollingActive()).toBe(false);
  });

  it("prevents duplicate polling instances", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Try to start again - should warn but not error
    await startBalancePolling(config);

    expect(isPollingActive()).toBe(true);
  });

  it("returns polling statistics", async () => {
    const stats = getPollingStats();

    expect(stats).toBeDefined();
    expect(stats.totalWallets).toBe(0);
    expect(stats.successfulUpdates).toBe(0);
    expect(stats.failedUpdates).toBe(0);
    expect(stats.lastRunTime).toBeInstanceOf(Date);
    expect(stats.nextRunTime).toBeInstanceOf(Date);
    expect(stats.averageUpdateTime).toBe(0);
  });

  it("resets polling statistics", () => {
    resetPollingStats();
    const stats = getPollingStats();

    expect(stats.totalWallets).toBe(0);
    expect(stats.successfulUpdates).toBe(0);
    expect(stats.failedUpdates).toBe(0);
  });

  it("validates polling configuration", async () => {
    const validConfig = {
      intervalMs: 5000, // Minimum allowed
      batchSize: 1,
      maxRetries: 1,
      retryDelayMs: 100,
      enableNotifications: false,
      balanceChangeThreshold: 0,
    };

    await startBalancePolling(validConfig);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);
  });

  it("tracks polling statistics accurately", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const stats = getPollingStats();

    expect(stats.lastRunTime).toBeInstanceOf(Date);
    expect(stats.nextRunTime).toBeInstanceOf(Date);
    expect(stats.nextRunTime.getTime()).toBeGreaterThan(stats.lastRunTime.getTime());
  });

  it("handles polling with notifications enabled", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: true,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);
  });

  it("handles polling with custom batch size", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 5, // Custom batch size
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);
  });

  it("handles polling with custom retry settings", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 5, // Custom retry count
      retryDelayMs: 500, // Custom retry delay
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);
  });

  it("handles polling with custom balance change threshold", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: true,
      balanceChangeThreshold: 10, // 10% threshold
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);
  });

  it("can stop polling multiple times without error", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await stopBalancePolling();
    expect(isPollingActive()).toBe(false);

    // Should not error on second stop
    await stopBalancePolling();
    expect(isPollingActive()).toBe(false);
  });

  it("calculates average update time", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const stats = getPollingStats();

    expect(typeof stats.averageUpdateTime).toBe("number");
    expect(stats.averageUpdateTime).toBeGreaterThanOrEqual(0);
  });

  it("maintains polling state across operations", async () => {
    const config = {
      intervalMs: 60000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      enableNotifications: false,
      balanceChangeThreshold: 5,
    };

    await startBalancePolling(config);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isPollingActive()).toBe(true);

    const stats1 = getPollingStats();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stats2 = getPollingStats();

    expect(stats1.lastRunTime).toBeDefined();
    expect(stats2.lastRunTime).toBeDefined();
  });
});
