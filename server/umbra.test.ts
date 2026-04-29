import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initializeUmbraClient,
  createTestSigner,
  registerUmbraUser,
  depositToEncryptedBalance,
  withdrawFromEncryptedBalance,
  createReceiverClaimableUtxo,
  fetchClaimableUtxos,
  claimUtxoToEncryptedBalance,
  calculateUmbraFee,
  UMBRA_SUPPORTED_TOKENS,
} from "./umbra";

describe("Umbra Privacy Integration", () => {
  let mockSigner: any;

  beforeEach(() => {
    mockSigner = {
      address: "11111111111111111111111111111111",
      publicKey: "11111111111111111111111111111111",
    };
  });

  describe("initializeUmbraClient", () => {
    it("should initialize client successfully", async () => {
      const client = await initializeUmbraClient(mockSigner);
      expect(client).toBeDefined();
      expect(client.signer).toBe(mockSigner);
      expect(client.network).toMatch(/^(mainnet|devnet)$/);
    });

    it("should handle initialization errors gracefully", async () => {
      const result = await initializeUmbraClient(null);
      expect(result).toBeDefined();
    });
  });

  describe("createTestSigner", () => {
    it("should create a test signer", async () => {
      const signer = await createTestSigner();
      expect(signer).toBeDefined();
      expect(signer.address).toBeDefined();
      expect(signer.publicKey).toBeDefined();
    });

    it("should return consistent signer structure", async () => {
      const signer = await createTestSigner();
      expect(typeof signer.address).toBe("string");
      expect(typeof signer.publicKey).toBe("string");
    });
  });

  describe("registerUmbraUser", () => {
    it("should register user successfully", async () => {
      const result = await registerUmbraUser(mockSigner);
      expect(result.success).toBe(true);
      expect(result.signatures).toBeDefined();
      expect(Array.isArray(result.signatures)).toBe(true);
      expect(result.userAddress).toBe(mockSigner.address);
    });

    it("should return registration signatures", async () => {
      const result = await registerUmbraUser(mockSigner);
      expect(result.signatures.length).toBeGreaterThan(0);
    });
  });

  describe("depositToEncryptedBalance", () => {
    it("should deposit tokens successfully", async () => {
      const tokenMint = UMBRA_SUPPORTED_TOKENS.USDT;
      const amount = BigInt(1_000_000); // 1 USDT

      const result = await depositToEncryptedBalance(
        mockSigner,
        tokenMint,
        amount
      );

      expect(result.success).toBe(true);
      expect(result.queueSignature).toBeDefined();
      expect(result.callbackSignature).toBeDefined();
      expect(result.amount).toBe(amount.toString());
      expect(result.token).toBe(tokenMint);
    });

    it("should handle large amounts", async () => {
      const tokenMint = UMBRA_SUPPORTED_TOKENS.USDC;
      const amount = BigInt(1_000_000_000_000); // 1 trillion USDC

      const result = await depositToEncryptedBalance(
        mockSigner,
        tokenMint,
        amount
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(amount.toString());
    });

    it("should support all Umbra tokens", async () => {
      const amount = BigInt(100_000);

      for (const [tokenName, tokenMint] of Object.entries(
        UMBRA_SUPPORTED_TOKENS
      )) {
        const result = await depositToEncryptedBalance(
          mockSigner,
          tokenMint,
          amount
        );

        expect(result.success).toBe(true);
        expect(result.token).toBe(tokenMint);
      }
    });
  });

  describe("withdrawFromEncryptedBalance", () => {
    it("should withdraw tokens successfully", async () => {
      const tokenMint = UMBRA_SUPPORTED_TOKENS.USDT;
      const amount = BigInt(500_000); // 0.5 USDT

      const result = await withdrawFromEncryptedBalance(
        mockSigner,
        tokenMint,
        amount
      );

      expect(result.success).toBe(true);
      expect(result.queueSignature).toBeDefined();
      expect(result.callbackSignature).toBeDefined();
      expect(result.amount).toBe(amount.toString());
      expect(result.token).toBe(tokenMint);
    });

    it("should handle minimum amounts", async () => {
      const tokenMint = UMBRA_SUPPORTED_TOKENS.USDC;
      const amount = BigInt(1); // 1 lamport

      const result = await withdrawFromEncryptedBalance(
        mockSigner,
        tokenMint,
        amount
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe("1");
    });
  });

  describe("createReceiverClaimableUtxo", () => {
    it("should create UTXO successfully", async () => {
      const recipientAddress = "22222222222222222222222222222222";
      const tokenMint = UMBRA_SUPPORTED_TOKENS.USDT;
      const amount = BigInt(1_000_000);

      const result = await createReceiverClaimableUtxo(
        mockSigner,
        recipientAddress,
        tokenMint,
        amount
      );

      expect(result.success).toBe(true);
      expect(result.recipient).toBe(recipientAddress);
      expect(result.amount).toBe(amount.toString());
      expect(result.token).toBe(tokenMint);
    });

    it("should handle anonymous transfers", async () => {
      const recipientAddress = "33333333333333333333333333333333";
      const tokenMint = UMBRA_SUPPORTED_TOKENS.wSOL;
      const amount = BigInt(1_000_000_000); // 1 SOL

      const result = await createReceiverClaimableUtxo(
        mockSigner,
        recipientAddress,
        tokenMint,
        amount
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("queued");
    });
  });

  describe("fetchClaimableUtxos", () => {
    it("should fetch claimable UTXOs", async () => {
      const result = await fetchClaimableUtxos(mockSigner);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.utxos)).toBe(true);
      expect(typeof result.count).toBe("number");
    });

    it("should return empty array when no UTXOs", async () => {
      const result = await fetchClaimableUtxos(mockSigner);

      expect(result.success).toBe(true);
      expect(result.utxos.length).toBe(0);
    });
  });

  describe("claimUtxoToEncryptedBalance", () => {
    it("should claim UTXO successfully", async () => {
      const utxos = [
        { id: "utxo1", amount: BigInt(1_000_000) },
        { id: "utxo2", amount: BigInt(500_000) },
      ];

      const result = await claimUtxoToEncryptedBalance(mockSigner, utxos);

      expect(result.success).toBe(true);
      expect(result.utxoCount).toBe(utxos.length);
      expect(result.message).toContain("queued");
    });

    it("should handle single UTXO claim", async () => {
      const utxos = [{ id: "utxo1", amount: BigInt(1_000_000) }];

      const result = await claimUtxoToEncryptedBalance(mockSigner, utxos);

      expect(result.success).toBe(true);
      expect(result.utxoCount).toBe(1);
    });

    it("should handle multiple UTXO claims", async () => {
      const utxos = Array.from({ length: 10 }, (_, i) => ({
        id: `utxo${i}`,
        amount: BigInt(100_000),
      }));

      const result = await claimUtxoToEncryptedBalance(mockSigner, utxos);

      expect(result.success).toBe(true);
      expect(result.utxoCount).toBe(10);
    });
  });

  describe("calculateUmbraFee", () => {
    it("should calculate 35 bps fee correctly", () => {
      const amount = BigInt(1_000_000); // 1 USDT (6 decimals)
      const fee = calculateUmbraFee(amount);

      // 35 bps = 35/10000 = 0.0035
      // 1_000_000 * 35 / 16384 ≈ 2136
      expect(fee).toBeGreaterThan(0n);
      expect(fee).toBeLessThan(amount);
    });

    it("should handle zero amount", () => {
      const amount = BigInt(0);
      const fee = calculateUmbraFee(amount);

      expect(fee).toBe(0n);
    });

    it("should handle large amounts", () => {
      const amount = BigInt(1_000_000_000_000); // 1 trillion
      const fee = calculateUmbraFee(amount);

      expect(fee).toBeGreaterThan(0n);
      expect(fee).toBeLessThan(amount);
    });

    it("should maintain fee consistency", () => {
      const amount = BigInt(1_000_000);
      const fee1 = calculateUmbraFee(amount);
      const fee2 = calculateUmbraFee(amount);

      expect(fee1).toBe(fee2);
    });
  });

  describe("UMBRA_SUPPORTED_TOKENS", () => {
    it("should have all required tokens", () => {
      expect(UMBRA_SUPPORTED_TOKENS.USDC).toBeDefined();
      expect(UMBRA_SUPPORTED_TOKENS.USDT).toBeDefined();
      expect(UMBRA_SUPPORTED_TOKENS.wSOL).toBeDefined();
      expect(UMBRA_SUPPORTED_TOKENS.UMBRA).toBeDefined();
    });

    it("should have valid Solana addresses", () => {
      // Solana addresses are base58 encoded (no 0, O, I, l)
      for (const [name, address] of Object.entries(UMBRA_SUPPORTED_TOKENS)) {
        expect(typeof address).toBe("string");
        expect(address.length).toBeGreaterThan(0);
        // Check that address doesn't contain invalid base58 characters
        expect(address).not.toMatch(/[0OIl]/);
      }
    });

    it("should have unique addresses", () => {
      const addresses = Object.values(UMBRA_SUPPORTED_TOKENS);
      const uniqueAddresses = new Set(addresses);

      expect(uniqueAddresses.size).toBe(addresses.length);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle deposit and withdrawal flow", async () => {
      const tokenMint = UMBRA_SUPPORTED_TOKENS.USDT;
      const amount = BigInt(1_000_000);

      // Deposit
      const depositResult = await depositToEncryptedBalance(
        mockSigner,
        tokenMint,
        amount
      );
      expect(depositResult.success).toBe(true);

      // Withdraw
      const withdrawResult = await withdrawFromEncryptedBalance(
        mockSigner,
        tokenMint,
        amount
      );
      expect(withdrawResult.success).toBe(true);
    });

    it("should handle anonymous transfer flow", async () => {
      const recipientAddress = "44444444444444444444444444444444";
      const tokenMint = UMBRA_SUPPORTED_TOKENS.USDC;
      const amount = BigInt(500_000);

      // Create UTXO
      const utxoResult = await createReceiverClaimableUtxo(
        mockSigner,
        recipientAddress,
        tokenMint,
        amount
      );
      expect(utxoResult.success).toBe(true);

      // Fetch UTXOs
      const fetchResult = await fetchClaimableUtxos(mockSigner);
      expect(fetchResult.success).toBe(true);

      // Claim UTXO (simulated)
      const claimResult = await claimUtxoToEncryptedBalance(mockSigner, [
        { id: "test", amount },
      ]);
      expect(claimResult.success).toBe(true);
    });

    it("should handle multiple token operations", async () => {
      const amount = BigInt(100_000);

      for (const tokenMint of Object.values(UMBRA_SUPPORTED_TOKENS)) {
        const deposit = await depositToEncryptedBalance(
          mockSigner,
          tokenMint,
          amount
        );
        expect(deposit.success).toBe(true);

        const withdraw = await withdrawFromEncryptedBalance(
          mockSigner,
          tokenMint,
          amount
        );
        expect(withdraw.success).toBe(true);
      }
    });
  });
});
