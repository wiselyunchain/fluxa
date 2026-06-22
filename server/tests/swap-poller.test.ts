import { describe, expect, it, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.WALLET_ENCRYPTION_KEY = "0".repeat(64);
});

const mocks = vi.hoisted(() => ({
  getPendingSwapTransactions: vi.fn(async () => [] as unknown[]),
  updateUserTransactionStatus: vi.fn(async () => {}),
  getNearIntentClient: vi.fn(),
}));

vi.mock("../db", () => ({
  getPendingSwapTransactions: mocks.getPendingSwapTransactions,
  updateUserTransactionStatus: mocks.updateUserTransactionStatus,
}));

vi.mock("../services/near-intent", () => ({
  getNearIntentClient: mocks.getNearIntentClient,
}));

import { runSwapPollerOnce } from "../services/swap-poller";

function makeTxn(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 7,
    type: "swap",
    status: "pending",
    fromChain: "SOLANA",
    toChain: null,
    fromToken: "nep141:sol-usdc.omft.near",
    toToken: "nep141:arb-usdc.omft.near",
    fromAmount: "1.0",
    toAmount: "0.99",
    nearIntentId: "corr-1",
    nearIntentDepositAddress: "DEP_1",
    nearIntentDepositMemo: null,
    pajCashReference: null,
    createdAt: new Date(),
    confirmedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.updateUserTransactionStatus.mockImplementation(async () => {});
});

describe("runSwapPollerOnce", () => {
  it("no-ops on empty batch", async () => {
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([]);
    mocks.getNearIntentClient.mockReturnValue({ status: vi.fn() });

    const result = await runSwapPollerOnce();
    expect(result).toEqual({ scanned: 0, settled: 0, failed: 0, errors: 0 });
    expect(mocks.updateUserTransactionStatus).not.toHaveBeenCalled();
  });

  it("SUCCESS → confirmed with confirmedAt", async () => {
    const txn = makeTxn({ id: 1, nearIntentDepositAddress: "DEP_A" });
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);
    const statusFn = vi.fn(async () => ({
      correlationId: "c",
      status: "SUCCESS",
      updatedAt: "now",
    }));
    mocks.getNearIntentClient.mockReturnValue({ status: statusFn });

    const result = await runSwapPollerOnce();

    expect(statusFn).toHaveBeenCalledWith("DEP_A", undefined);
    expect(result).toEqual({ scanned: 1, settled: 1, failed: 0, errors: 0 });
    expect(mocks.updateUserTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        status: "confirmed",
        confirmedAt: expect.any(Date),
      }),
    );
  });

  it("FAILED → failed without confirmedAt", async () => {
    const txn = makeTxn({ id: 2, nearIntentDepositAddress: "DEP_B" });
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);
    const statusFn = vi.fn(async () => ({
      correlationId: "c",
      status: "FAILED",
      updatedAt: "now",
    }));
    mocks.getNearIntentClient.mockReturnValue({ status: statusFn });

    const result = await runSwapPollerOnce();

    expect(result).toEqual({ scanned: 1, settled: 0, failed: 1, errors: 0 });
    const call = mocks.updateUserTransactionStatus.mock.calls[0][0];
    expect(call).toMatchObject({ id: 2, status: "failed" });
    expect(call.confirmedAt).toBeUndefined();
  });

  it("REFUNDED → failed (user lost their input)", async () => {
    const txn = makeTxn({ id: 3, nearIntentDepositAddress: "DEP_C" });
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);
    mocks.getNearIntentClient.mockReturnValue({
      status: vi.fn(async () => ({ correlationId: "c", status: "REFUNDED", updatedAt: "now" })),
    });

    const result = await runSwapPollerOnce();
    expect(result.failed).toBe(1);
    expect(mocks.updateUserTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it.each([
    ["PROCESSING"],
    ["PENDING_DEPOSIT"],
    ["KNOWN_DEPOSIT_TX"],
    ["INCOMPLETE_DEPOSIT"],
  ])("%s → no-op (txn stays pending)", async (statusValue) => {
    const txn = makeTxn({ id: 4, nearIntentDepositAddress: "DEP_D" });
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);
    mocks.getNearIntentClient.mockReturnValue({
      status: vi.fn(async () => ({ correlationId: "c", status: statusValue, updatedAt: "now" })),
    });

    const result = await runSwapPollerOnce();
    expect(result).toEqual({ scanned: 1, settled: 0, failed: 0, errors: 0 });
    expect(mocks.updateUserTransactionStatus).not.toHaveBeenCalled();
  });

  it("propagates depositMemo to the status call", async () => {
    const txn = makeTxn({ id: 5, nearIntentDepositAddress: "DEP_E", nearIntentDepositMemo: "memo-77" });
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);
    const statusFn = vi.fn(async () => ({ correlationId: "c", status: "PROCESSING", updatedAt: "now" }));
    mocks.getNearIntentClient.mockReturnValue({ status: statusFn });

    await runSwapPollerOnce();
    expect(statusFn).toHaveBeenCalledWith("DEP_E", "memo-77");
  });

  it("per-row error does not break the batch", async () => {
    const txns = [
      makeTxn({ id: 10, nearIntentDepositAddress: "DEP_X" }),
      makeTxn({ id: 11, nearIntentDepositAddress: "DEP_Y" }),
      makeTxn({ id: 12, nearIntentDepositAddress: "DEP_Z" }),
    ];
    mocks.getPendingSwapTransactions.mockResolvedValueOnce(txns);

    const statusFn = vi.fn(async (depositAddress: string) => {
      if (depositAddress === "DEP_Y") throw new Error("network blip");
      return {
        correlationId: "c",
        status: depositAddress === "DEP_X" ? "SUCCESS" : "FAILED",
        updatedAt: "now",
      };
    });
    mocks.getNearIntentClient.mockReturnValue({ status: statusFn });

    const result = await runSwapPollerOnce();
    expect(result).toEqual({ scanned: 3, settled: 1, failed: 1, errors: 1 });
    expect(mocks.updateUserTransactionStatus).toHaveBeenCalledTimes(2);
  });

  it("skips rows missing nearIntentDepositAddress without calling status", async () => {
    const txn = makeTxn({ id: 99, nearIntentDepositAddress: null });
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);
    const statusFn = vi.fn();
    mocks.getNearIntentClient.mockReturnValue({ status: statusFn });

    const result = await runSwapPollerOnce();
    expect(statusFn).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, settled: 0, failed: 0, errors: 0 });
  });
});
