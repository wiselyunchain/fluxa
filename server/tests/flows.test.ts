import { describe, expect, it, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.WALLET_ENCRYPTION_KEY = "0".repeat(64);
});

const mocks = vi.hoisted(() => ({
  getNearIntentClient: vi.fn(),
  sendSplToken: vi.fn(async () => "FAKE_SIG"),
  insertUserTransaction: vi.fn(async (row: unknown) => ({ id: 42, ...(row as object) })),
  insertFiatRequest: vi.fn(async (row: unknown) => ({ id: 1, ...(row as object) })),
  createDepositOrder: vi.fn(),
  createWithdrawalOrder: vi.fn(),
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
}));

vi.mock("../services/paj-cash", () => ({
  createDepositOrder: mocks.createDepositOrder,
  createWithdrawalOrder: mocks.createWithdrawalOrder,
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

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.sendSplToken.mockImplementation(async () => "FAKE_SIG");
  mocks.insertUserTransaction.mockImplementation(async (row: unknown) => ({ id: 42, ...(row as object) }));
});

describe("FlowService.handleSwap", () => {
  it("quotes, transfers, persists, notifies, and returns the expected shape", async () => {
    const submitDeposit = vi.fn(async () => ({}));
    mocks.getNearIntentClient.mockReturnValue({
      quote: vi.fn(async () => SAMPLE_QUOTE),
      submitDeposit,
    });

    const result = await FlowService.handleSwap({
      userId: 7,
      userWallet: WALLET,
      fromMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      originAsset: "nep141:sol-usdc.omft.near",
      destinationAsset: "nep141:arb-usdc.omft.near",
      amountBaseUnits: "1000000",
      originChain: "solana",
      destinationChain: "evm",
    });

    const client = mocks.getNearIntentClient.mock.results[0].value;
    expect(client.quote).toHaveBeenCalledTimes(1);
    const quoteCall = client.quote.mock.calls[0][0];
    expect(quoteCall).toMatchObject({
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: "nep141:sol-usdc.omft.near",
      destinationAsset: "nep141:arb-usdc.omft.near",
      amount: "1000000",
      depositType: "ORIGIN_CHAIN",
      recipientType: "DESTINATION_CHAIN",
      recipient: WALLET.address,
      refundTo: WALLET.address,
    });
    expect(typeof quoteCall.deadline).toBe("string");

    expect(mocks.sendSplToken).toHaveBeenCalledWith({
      fromWallet: WALLET,
      toAddress: "DEP_ADDR",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: 1000000n,
    });

    expect(mocks.insertUserTransaction).toHaveBeenCalledTimes(1);
    const row = mocks.insertUserTransaction.mock.calls[0][0];
    expect(row).toMatchObject({
      userId: 7,
      type: "swap",
      status: "pending",
      fromChain: "SOLANA",
      fromToken: "nep141:sol-usdc.omft.near",
      toToken: "nep141:arb-usdc.omft.near",
      fromAmount: "1.0",
      toAmount: "0.99",
      nearIntentId: "corr-abc",
      nearIntentDepositAddress: "DEP_ADDR",
      nearIntentDepositMemo: "memo-xyz",
    });

    expect(submitDeposit).toHaveBeenCalledWith({
      txHash: "FAKE_SIG",
      depositAddress: "DEP_ADDR",
    });

    expect(result).toMatchObject({
      transactionId: 42,
      correlationId: "corr-abc",
      transferSignature: "FAKE_SIG",
      depositAddress: "DEP_ADDR",
      depositMemo: "memo-xyz",
    });
  });

  it("respects custom slippageBps, recipient, and deadlineSeconds", async () => {
    const quoteFn = vi.fn(async () => SAMPLE_QUOTE);
    mocks.getNearIntentClient.mockReturnValue({
      quote: quoteFn,
      submitDeposit: vi.fn(async () => ({})),
    });

    const before = Date.now();
    await FlowService.handleSwap({
      userId: 1,
      userWallet: WALLET,
      fromMintAddress: "MINT",
      originAsset: "o",
      destinationAsset: "d",
      amountBaseUnits: "500",
      recipient: "0xCustom",
      slippageBps: 250,
      deadlineSeconds: 120,
      originChain: "solana",
    });

    const sent = quoteFn.mock.calls[0][0];
    expect(sent.slippageTolerance).toBe(250);
    expect(sent.recipient).toBe("0xCustom");
    const deadlineMs = new Date(sent.deadline).getTime();
    expect(deadlineMs).toBeGreaterThanOrEqual(before + 119_000);
    expect(deadlineMs).toBeLessThanOrEqual(before + 125_000);
  });

  it("does not throw when submitDeposit fails — the swap row still returns", async () => {
    const submitDeposit = vi.fn(async () => {
      throw new Error("network");
    });
    mocks.getNearIntentClient.mockReturnValue({
      quote: vi.fn(async () => SAMPLE_QUOTE),
      submitDeposit,
    });

    const result = await FlowService.handleSwap({
      userId: 1,
      userWallet: WALLET,
      fromMintAddress: "MINT",
      originAsset: "o",
      destinationAsset: "d",
      amountBaseUnits: "100",
      originChain: "solana",
    });

    expect(result.transferSignature).toBe("FAKE_SIG");
    expect(result.correlationId).toBe("corr-abc");
    expect(mocks.insertUserTransaction).toHaveBeenCalledTimes(1);
  });

  it("propagates quote failures and does not transfer or persist", async () => {
    mocks.getNearIntentClient.mockReturnValue({
      quote: vi.fn(async () => {
        throw new Error("quote rejected");
      }),
      submitDeposit: vi.fn(),
    });

    await expect(
      FlowService.handleSwap({
        userId: 1,
        userWallet: WALLET,
        fromMintAddress: "MINT",
        originAsset: "o",
        destinationAsset: "d",
        amountBaseUnits: "100",
        originChain: "solana",
      }),
    ).rejects.toThrow("quote rejected");

    expect(mocks.sendSplToken).not.toHaveBeenCalled();
    expect(mocks.insertUserTransaction).not.toHaveBeenCalled();
  });

  it("propagates SPL transfer failures and does not persist", async () => {
    mocks.getNearIntentClient.mockReturnValue({
      quote: vi.fn(async () => SAMPLE_QUOTE),
      submitDeposit: vi.fn(),
    });
    mocks.sendSplToken.mockRejectedValueOnce(new Error("insufficient funds"));

    await expect(
      FlowService.handleSwap({
        userId: 1,
        userWallet: WALLET,
        fromMintAddress: "MINT",
        originAsset: "o",
        destinationAsset: "d",
        amountBaseUnits: "100",
        originChain: "solana",
      }),
    ).rejects.toThrow("insufficient funds");

    expect(mocks.insertUserTransaction).not.toHaveBeenCalled();
  });
});
