import { describe, expect, it, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.WALLET_ENCRYPTION_KEY = "0".repeat(64);
});

const mocks = vi.hoisted(() => ({
  getPendingSwapTransactions: vi.fn(),
  updateUserTransactionStatus: vi.fn(),
  getSolanaStealthAddressByTransaction: vi.fn(),
  markSolanaStealthAddressClaimed: vi.fn(),
  getUserWalletByChain: vi.fn(),

  shieldPublicBalance: vi.fn(),
  createReceiverClaimableUtxo: vi.fn(),

  getNearIntentClient: vi.fn(),
}));

vi.mock("../db", () => ({
  getPendingSwapTransactions: mocks.getPendingSwapTransactions,
  updateUserTransactionStatus: mocks.updateUserTransactionStatus,
  getSolanaStealthAddressByTransaction: mocks.getSolanaStealthAddressByTransaction,
  markSolanaStealthAddressClaimed: mocks.markSolanaStealthAddressClaimed,
  getUserWalletByChain: mocks.getUserWalletByChain,
}));

vi.mock("../services/near-intent", () => ({
  getNearIntentClient: mocks.getNearIntentClient,
}));

vi.mock("../services/umbra", () => ({
  shieldPublicBalance: mocks.shieldPublicBalance,
  createReceiverClaimableUtxo: mocks.createReceiverClaimableUtxo,
}));

import { runSwapPollerOnce } from "../services/swap-poller";

function makePrivateTxn() {
  return {
    id: 42,
    userId: 7,
    type: "swap",
    status: "pending",
    fromChain: "SOLANA",
    toChain: "SOLANA",
    fromToken: "nep141:sol-usdc.omft.near",
    toToken: "nep141:sol-usdt.omft.near",
    fromAmount: "1.0",
    toAmount: "1000000", // 1 USDT (6 decimals)
    nearIntentId: "corr-private",
    nearIntentDepositAddress: "DEP_PRIV",
    nearIntentDepositMemo: null,
    isPrivate: true,
    createdAt: new Date(),
    confirmedAt: null,
  };
}

describe("SwapPoller Private Swap Edge Cases (Adversarial)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("demonstrates funds stranded in ephemeral balance on step B (createReceiverClaimableUtxo) failure", async () => {
    const txn = makePrivateTxn();
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);

    const statusFn = vi.fn().mockResolvedValue({
      correlationId: "corr-private",
      status: "SUCCESS",
      updatedAt: "now",
    });
    const supportedTokensFn = vi.fn().mockResolvedValue([
      { assetId: "nep141:sol-usdt.omft.near", contractAddress: "usdt-mint-address", blockchain: "solana" }
    ]);
    mocks.getNearIntentClient.mockReturnValue({
      status: statusFn,
      supportedTokens: supportedTokensFn,
    });

    mocks.getSolanaStealthAddressByTransaction.mockResolvedValue({
      id: 100,
      stealthAddress: "stealth-pubkey",
      ephemeralKeypair: "encrypted-ephemeral-key",
      claimed: false,
    });

    mocks.getUserWalletByChain.mockResolvedValue({
      address: "user-main-address",
    });

    // Run 1: Step A (shieldPublicBalance) succeeds, but Step B (createReceiverClaimableUtxo) fails.
    mocks.shieldPublicBalance.mockResolvedValueOnce({ queueSignature: "shield-sig-1" });
    mocks.createReceiverClaimableUtxo.mockRejectedValueOnce(new Error("RPC Timeout on Step B"));

    // Run Swap Poller
    const result1 = await runSwapPollerOnce();
    expect(result1.scanned).toBe(1);
    expect(result1.settled).toBe(0);
    expect(result1.failed).toBe(0);
    expect(result1.errors).toBe(0); // Caught internally in settleOne and logs warning

    // Verify database statuses were not updated
    expect(mocks.markSolanaStealthAddressClaimed).not.toHaveBeenCalled();
    expect(mocks.updateUserTransactionStatus).not.toHaveBeenCalled();

    // Verify Umbra functions called
    expect(mocks.shieldPublicBalance).toHaveBeenCalledTimes(1);
    expect(mocks.createReceiverClaimableUtxo).toHaveBeenCalledTimes(1);

    // Run 2 (Retry): Since the transaction status remains pending, poller processes it again.
    // The public balance is now empty because Run 1's shield was successful on-chain.
    // Therefore, shieldPublicBalance will fail (throws on-chain insufficient balance error).
    mocks.getPendingSwapTransactions.mockResolvedValueOnce([txn]);
    mocks.shieldPublicBalance.mockRejectedValueOnce(new Error("Solana error: Insufficient balance / Account not found"));

    const result2 = await runSwapPollerOnce();
    expect(result2.scanned).toBe(1);
    expect(result2.settled).toBe(0);
    expect(result2.failed).toBe(0);
    expect(result2.errors).toBe(0);

    // Verify it is stuck: markSolanaStealthAddressClaimed and updateUserTransactionStatus still not called.
    expect(mocks.markSolanaStealthAddressClaimed).not.toHaveBeenCalled();
    expect(mocks.updateUserTransactionStatus).not.toHaveBeenCalled();

    // Verify we tried shieldPublicBalance again and failed, never proceeding to createReceiverClaimableUtxo
    expect(mocks.shieldPublicBalance).toHaveBeenCalledTimes(2);
    expect(mocks.createReceiverClaimableUtxo).toHaveBeenCalledTimes(1); // Still 1 from Run 1
  });
});
