import { describe, expect, it, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.WALLET_ENCRYPTION_KEY = "0".repeat(64);
});

const mocks = vi.hoisted(() => ({
  getNearIntentClient: vi.fn(),
  sendSplToken: vi.fn(),
  insertUserTransaction: vi.fn(),
  insertFiatRequest: vi.fn(),
  createDepositOrder: vi.fn(),
  createWithdrawalOrder: vi.fn(),
  unshieldEncryptedBalance: vi.fn(),
  insertSolanaStealthAddress: vi.fn(),
}));

vi.mock("../services/near-intent", () => ({
  getNearIntentClient: mocks.getNearIntentClient,
}));

vi.mock("../utils/solana-transfer", () => ({
  sendSplToken: mocks.sendSplToken,
}));

vi.mock("../db", () => ({
  insertUserTransaction: mocks.insertUserTransaction,
  insertFiatRequest: mocks.insertFiatRequest,
  insertSolanaStealthAddress: mocks.insertSolanaStealthAddress,
}));

vi.mock("../services/paj-cash", () => ({
  createDepositOrder: mocks.createDepositOrder,
  createWithdrawalOrder: mocks.createWithdrawalOrder,
}));

vi.mock("../services/umbra", () => ({
  unshieldEncryptedBalance: mocks.unshieldEncryptedBalance,
  shieldPublicBalance: vi.fn(),
  createReceiverClaimableUtxo: vi.fn(),
  UMBRA_SUPPORTED_TOKENS: {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    wSOL: "So11111111111111111111111111111111111111112",
    UMBRA: "PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta",
  },
}));

import { FlowService } from "../services/flows";

const WALLET = {
  address: "SoLanaUser111",
  privateKey: "iv:cipher:tag",
};

const SAMPLE_QUOTE = {
  correlationId: "corr-abc",
  timestamp: "2026-06-05T00:00:00Z",
  quoteRequest: {} as unknown,
  quote: {
    depositAddress: "DEP_ADDR",
    depositMemo: "memo-xyz",
    amountIn: "1000000",
    amountInFormatted: "1.0",
    amountOut: "990000",
    amountOutFormatted: "0.99",
    deadline: "2099-01-01T00:00:00Z",
  },
};

describe("FlowService.handleSwap Adversarial Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proves lost funds / missing tracking when DB write fails AFTER public SPL transfer succeeds", async () => {
    mocks.getNearIntentClient.mockReturnValue({
      quote: vi.fn(async () => SAMPLE_QUOTE),
      submitDeposit: vi.fn(),
    });
    // On-chain transfer succeeds
    mocks.sendSplToken.mockResolvedValueOnce("ON_CHAIN_TX_SIG_123");
    // DB write throws a network/database error
    mocks.insertUserTransaction.mockRejectedValueOnce(new Error("Database offline"));

    await expect(
      FlowService.handleSwap({
        userId: 7,
        userWallet: WALLET,
        fromMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        originAsset: "nep141:sol-usdc.omft.near",
        destinationAsset: "nep141:arb-usdc.omft.near",
        amountBaseUnits: "1000000",
        originChain: "solana",
        destinationChain: "evm",
      })
    ).rejects.toThrow("Database offline");

    // CRITICAL: The on-chain SPL transfer was successfully executed!
    expect(mocks.sendSplToken).toHaveBeenCalledTimes(1);

    // CRITICAL: Since DB write failed, we have no record of this swap or the deposit address/memo in the database!
    // This is a lost-funds / tracking failure mode.
    expect(mocks.insertUserTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.insertSolanaStealthAddress).not.toHaveBeenCalled();
  });

  it("proves private swap ephemeral key is lost when DB write fails AFTER unshielding to solver", async () => {
    mocks.getNearIntentClient.mockReturnValue({
      quote: vi.fn(async () => ({
        ...SAMPLE_QUOTE,
        quote: {
          ...SAMPLE_QUOTE.quote,
          depositAddress: "SOLVER_DEP_ADDR",
        }
      })),
      supportedTokens: vi.fn(async () => [
        { assetId: "nep141:sol-usdt.omft.near", contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", blockchain: "solana" }
      ]),
      submitDeposit: vi.fn(),
    });

    // On-chain private unshield to solver succeeds
    mocks.unshieldEncryptedBalance.mockResolvedValueOnce({ queueSignature: "unshield-sig-abc" });

    // DB write throws a network/database error
    mocks.insertUserTransaction.mockRejectedValueOnce(new Error("Database disk full"));

    await expect(
      FlowService.handleSwap({
        userId: 7,
        userWallet: WALLET,
        fromMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        originAsset: "nep141:sol-usdc.omft.near",
        destinationAsset: "nep141:sol-usdt.omft.near",
        amountBaseUnits: "1000000",
        originChain: "solana",
        destinationChain: "solana",
        isPrivate: true,
      })
    ).rejects.toThrow("Database disk full");

    // CRITICAL: The unshield operation happened on-chain!
    expect(mocks.unshieldEncryptedBalance).toHaveBeenCalledTimes(1);

    // CRITICAL: The insertUserTransaction threw, so insertSolanaStealthAddress is NEVER called.
    // The generated ephemeral keypair is lost in memory, and the user's funds will be stranded.
    expect(mocks.insertSolanaStealthAddress).not.toHaveBeenCalled();
  });
});
