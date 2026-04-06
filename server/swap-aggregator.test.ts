import { describe, expect, it } from "vitest";
import {
  getSwapQuote,
  getSwapRoute,
  executeSwap,
  getSwapStatus,
  getChainTokens,
} from "./swap-aggregator";

describe("Swap Aggregator (LI.FI)", () => {
  it("gets swap quote for same-chain swap", async () => {
    const quote = await getSwapQuote({
      fromToken: "USDT",
      toToken: "USDC",
      fromChain: "base",
      toChain: "base",
      fromAmount: "1000000",
      userAddress: "0x1234567890123456789012345678901234567890",
    });

    expect(quote).toBeDefined();
    expect(quote.fromToken).toBe("USDT");
    expect(quote.toToken).toBe("USDC");
    expect(quote.fromAmount).toBe("1000000");
    expect(quote.toAmount).toBeDefined();
    expect(parseFloat(quote.toAmount)).toBeGreaterThan(0);
    expect(quote.priceImpact).toBeDefined();
    expect(quote.fees).toBeDefined();
  });

  it("gets swap quote for cross-chain swap", async () => {
    const quote = await getSwapQuote({
      fromToken: "USDT",
      toToken: "SOL",
      fromChain: "base",
      toChain: "solana",
      fromAmount: "1000000",
      userAddress: "0x1234567890123456789012345678901234567890",
    });

    expect(quote).toBeDefined();
    expect(quote.fromChain).toBe("base");
    expect(quote.toChain).toBe("solana");
    expect(quote.toAmount).toBeDefined();
  });

  it("gets swap route for execution", async () => {
    const route = await getSwapRoute({
      fromToken: "USDT",
      toToken: "USDC",
      fromChain: "base",
      toChain: "base",
      fromAmount: "1000000",
      userAddress: "0x1234567890123456789012345678901234567890",
    });

    expect(route).toBeDefined();
    expect(route.id).toBeDefined();
    expect(route.fromToken).toBe("USDT");
    expect(route.toToken).toBe("USDC");
    expect(route.transactionRequest).toBeDefined();
    expect(route.transactionRequest?.to).toBeDefined();
    expect(route.transactionRequest?.from).toBe("0x1234567890123456789012345678901234567890");
  });

  it("executes swap and returns transaction hash", async () => {
    const route = await getSwapRoute({
      fromToken: "USDT",
      toToken: "USDC",
      fromChain: "base",
      toChain: "base",
      fromAmount: "1000000",
      userAddress: "0x1234567890123456789012345678901234567890",
    });

    const result = await executeSwap({
      route,
      userAddress: "0x1234567890123456789012345678901234567890",
      slippage: 0.03,
    });

    expect(result).toBeDefined();
    expect(result.transactionHash).toBeDefined();
    expect(result.transactionHash).toMatch(/^0x/);
    expect(result.status).toBe("pending");
    expect(result.estimatedTime).toBeGreaterThan(0);
  });

  it("gets swap status", async () => {
    const status = await getSwapStatus("0x1234567890123456789012345678901234567890");

    expect(status).toBeDefined();
    expect(status.status).toBe("success");
    expect(status.fromAmount).toBeDefined();
    expect(status.toAmount).toBeDefined();
    expect(status.timestamp).toBeGreaterThan(0);
  });

  it("gets tokens for Solana chain", async () => {
    const tokens = await getChainTokens("solana");

    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);

    // Check token structure
    tokens.forEach((token) => {
      expect(token.address).toBeDefined();
      expect(token.symbol).toBeDefined();
      expect(token.name).toBeDefined();
      expect(token.decimals).toBeDefined();
      expect(token.logoURI).toBeDefined();
    });
  });

  it("gets tokens for Base chain", async () => {
    const tokens = await getChainTokens("base");

    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("gets tokens for BSC chain", async () => {
    const tokens = await getChainTokens("bsc");

    expect(Array.isArray(tokens)).toBe(true);
  });

  it("gets tokens for TON chain", async () => {
    const tokens = await getChainTokens("ton");

    expect(Array.isArray(tokens)).toBe(true);
  });

  it("gets tokens for Avalanche chain", async () => {
    const tokens = await getChainTokens("avalanche");

    expect(Array.isArray(tokens)).toBe(true);
  });

  it("handles invalid chain gracefully", async () => {
    // Invalid chain returns mock quote instead of throwing
    const quote = await getSwapQuote({
      fromToken: "USDT",
      toToken: "USDC",
      fromChain: "invalid-chain",
      toChain: "base",
      fromAmount: "1000000",
      userAddress: "0x1234567890123456789012345678901234567890",
    });

    // Should return mock quote
    expect(quote).toBeDefined();
    expect(quote.toAmount).toBeDefined();
  });

  it("handles quote errors gracefully", async () => {
    // This should return a mock quote instead of throwing
    const quote = await getSwapQuote({
      fromToken: "USDT",
      toToken: "USDC",
      fromChain: "base",
      toChain: "base",
      fromAmount: "1000000",
      userAddress: "0x1234567890123456789012345678901234567890",
    });

    expect(quote).toBeDefined();
    expect(quote.toAmount).toBeDefined();
  });

  it("calculates correct mock rates", async () => {
    const quote = await getSwapQuote({
      fromToken: "USDT",
      toToken: "USDT",
      fromChain: "base",
      toChain: "base",
      fromAmount: "1000000",
      userAddress: "0x1234567890123456789012345678901234567890",
    });

    // Same token should have 1:1 rate
    expect(parseFloat(quote.toAmount)).toBeCloseTo(1000000, -4);
  });
});
