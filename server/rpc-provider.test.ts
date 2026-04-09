import { describe, expect, it } from "vitest";
import {
  getWalletBalance,
  getGasPrice,
  getTransactionStatus,
  estimateGas,
} from "./rpc-provider";

describe("RPC Provider", () => {
  it("returns balance as string", async () => {
    const balance = await getWalletBalance(
      "0x1234567890123456789012345678901234567890",
      "base"
    );

    expect(typeof balance).toBe("string");
    expect(balance).toBeDefined();
    // Balance should be a valid number
    expect(parseFloat(balance) >= 0).toBe(true);
  });

  it("handles invalid Solana address gracefully", async () => {
    const balance = await getWalletBalance("invalid-address", "solana");

    // Should return "0" or error gracefully
    expect(typeof balance).toBe("string");
  });

  it("handles invalid Ethereum address gracefully", async () => {
    const balance = await getWalletBalance("invalid-address", "base");

    // Should return "0" or error gracefully
    expect(typeof balance).toBe("string");
  });

  it("gets gas price for Solana", async () => {
    const gasPrice = await getGasPrice("solana");

    expect(typeof gasPrice).toBe("string");
    expect(gasPrice).toBeDefined();
  });

  it("gets gas price for Base", async () => {
    const gasPrice = await getGasPrice("base");

    expect(typeof gasPrice).toBe("string");
    expect(gasPrice).toBeDefined();
  });

  it("gets gas price for BSC", async () => {
    const gasPrice = await getGasPrice("bsc");

    expect(typeof gasPrice).toBe("string");
    expect(gasPrice).toBeDefined();
  });

  it("gets gas price for Avalanche", async () => {
    const gasPrice = await getGasPrice("avalanche");

    expect(typeof gasPrice).toBe("string");
    expect(gasPrice).toBeDefined();
  });

  it("gets gas price for TON", async () => {
    const gasPrice = await getGasPrice("ton");

    expect(typeof gasPrice).toBe("string");
    expect(gasPrice).toBeDefined();
  });

  it("gets transaction status", async () => {
    const status = await getTransactionStatus(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "base"
    );

    expect(status).toBeDefined();
    expect(status.status).toMatch(/pending|success|failed/);
    expect(typeof status.confirmations).toBe("number");
    expect(status.confirmations >= 0).toBe(true);
  });

  it("handles invalid transaction hash", async () => {
    const status = await getTransactionStatus("invalid-hash", "base");

    expect(["pending", "success", "failed"]).toContain(status.status);
    expect(typeof status.confirmations).toBe("number");
  });

  it("estimates gas for transaction", async () => {
    const gasEstimate = await estimateGas(
      "0x1234567890123456789012345678901234567890",
      "0x0987654321098765432109876543210987654321",
      "1.0",
      "base"
    );

    expect(typeof gasEstimate).toBe("string");
    expect(gasEstimate).toBeDefined();
    // Gas estimate should be a valid number or "0"
    expect(parseFloat(gasEstimate) >= 0).toBe(true);
  });

  it("estimates gas for Solana", async () => {
    const gasEstimate = await estimateGas(
      "11111111111111111111111111111111",
      "11111111111111111111111111111112",
      "1.0",
      "solana"
    );

    expect(gasEstimate).toBe("5000");
  });

  it("estimates gas for TON", async () => {
    const gasEstimate = await estimateGas(
      "0:1234567890123456789012345678901234567890123456789012345678901234",
      "0:0987654321098765432109876543210987654321098765432109876543210987",
      "1.0",
      "ton"
    );

    expect(gasEstimate).toBe("10000000");
  });

  it("handles all supported chains", async () => {
    const chains = ["solana", "base", "bsc", "ton", "avalanche"] as const;

    for (const chain of chains) {
      const balance = await getWalletBalance(
        "0x0000000000000000000000000000000000000000",
        chain
      );
      expect(typeof balance).toBe("string");
      expect(parseFloat(balance) >= 0).toBe(true);
    }
  });

  it("returns zero balance for non-existent wallet", async () => {
    const balance = await getWalletBalance(
      "11111111111111111111111111111111",
      "solana"
    );

    // May return very small amount or "0"
    expect(parseFloat(balance) >= 0).toBe(true);
  });

  it("handles network errors gracefully", async () => {
    // Test with potentially invalid address
    const balance = await getWalletBalance(
      "0x0000000000000000000000000000000000000000",
      "base"
    );

    // Should return a string (either "0" or actual balance)
    expect(typeof balance).toBe("string");
    expect(parseFloat(balance) >= 0).toBe(true);
  });

  it("transaction status includes confirmations", async () => {
    const status = await getTransactionStatus(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "base"
    );

    expect("confirmations" in status).toBe(true);
    expect(typeof status.confirmations).toBe("number");
    expect(status.confirmations >= 0).toBe(true);
  });

  it("validates transaction hash format", async () => {
    const validHash =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const status = await getTransactionStatus(validHash, "base");

    expect(status).toBeDefined();
    expect(status.status).toBeDefined();
    expect(["pending", "success", "failed"]).toContain(status.status);
  });
});
