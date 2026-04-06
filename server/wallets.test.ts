import { describe, expect, it } from "vitest";
import {
  generateSolanaWallet,
  generateEthereumWallet,
  generateTonWallet,
  generateMultiChainWallet,
  validateWalletAddress,
} from "./wallets";

describe("Wallet Generation", () => {
  it("generates valid Solana wallet", () => {
    const wallet = generateSolanaWallet();

    expect(wallet.chain).toBe("solana");
    expect(wallet.address).toBeDefined();
    expect(wallet.publicKey).toBeDefined();
    expect(wallet.privateKey).toBeDefined();
    expect(wallet.address).toHaveLength(44); // Base58 encoded Solana address
  });

  it("generates valid Ethereum wallet", () => {
    const wallet = generateEthereumWallet("base");

    expect(wallet.chain).toBe("base");
    expect(wallet.address).toBeDefined();
    expect(wallet.publicKey).toBeDefined();
    expect(wallet.privateKey).toBeDefined();
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/); // Ethereum address format
  });

  it("generates valid BSC wallet", () => {
    const wallet = generateEthereumWallet("bsc");

    expect(wallet.chain).toBe("bsc");
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("generates valid Avalanche wallet", () => {
    const wallet = generateEthereumWallet("avalanche");

    expect(wallet.chain).toBe("avalanche");
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("generates valid TON wallet", async () => {
    const wallet = await generateTonWallet();

    expect(wallet.chain).toBe("ton");
    expect(wallet.address).toBeDefined();
    expect(wallet.publicKey).toBeDefined();
    expect(wallet.privateKey).toBeDefined();
    expect(wallet.address).toMatch(/^0:[a-fA-F0-9]{64}$/); // TON address format
  });

  it("generates multi-chain wallet with all chains", async () => {
    const multiChain = await generateMultiChainWallet();

    expect(multiChain.mnemonic).toBeDefined();
    expect(multiChain.mnemonic.split(" ")).toHaveLength(12);

    expect(multiChain.wallets.solana).toBeDefined();
    expect(multiChain.wallets.base).toBeDefined();
    expect(multiChain.wallets.bsc).toBeDefined();
    expect(multiChain.wallets.ton).toBeDefined();
    expect(multiChain.wallets.avalanche).toBeDefined();

    // Verify each wallet has required fields
    Object.values(multiChain.wallets).forEach((wallet) => {
      expect(wallet.address).toBeDefined();
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.chain).toBeDefined();
    });
  });

  it("validates Solana addresses correctly", () => {
    const validWallet = generateSolanaWallet();
    expect(validateWalletAddress(validWallet.address, "solana")).toBe(true);
    expect(validateWalletAddress("invalid-address", "solana")).toBe(false);
  });

  it("validates Ethereum addresses correctly", () => {
    const validWallet = generateEthereumWallet("base");
    expect(validateWalletAddress(validWallet.address, "base")).toBe(true);
    expect(validateWalletAddress("0xinvalid", "base")).toBe(false);
  });

  it("validates TON addresses correctly", async () => {
    const validWallet = await generateTonWallet();
    expect(validateWalletAddress(validWallet.address, "ton")).toBe(true);
    expect(validateWalletAddress("invalid-ton-address", "ton")).toBe(false);
  });

  it("generates unique wallets on each call", async () => {
    const wallet1 = await generateMultiChainWallet();
    const wallet2 = await generateMultiChainWallet();

    expect(wallet1.mnemonic).not.toBe(wallet2.mnemonic);
    expect(wallet1.wallets.solana.address).not.toBe(wallet2.wallets.solana.address);
  });

  it("validates all chain types", () => {
    const chains = ["solana", "base", "bsc", "ton", "avalanche"] as const;

    chains.forEach((chain) => {
      if (chain === "ton") {
        // TON validation is more complex, skip for now
        return;
      }

      if (chain === "solana") {
        const wallet = generateSolanaWallet();
        expect(validateWalletAddress(wallet.address, chain)).toBe(true);
      } else {
        const wallet = generateEthereumWallet(chain);
        expect(validateWalletAddress(wallet.address, chain)).toBe(true);
      }
    });
  });
});
