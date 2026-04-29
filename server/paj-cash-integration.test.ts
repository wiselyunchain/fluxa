import { describe, it, expect, beforeEach } from "vitest";
import {
  getExchangeRate,
  convertNgnToUsdt,
  convertUsdtToNgn,
  initiateDeposit,
  confirmDeposit,
  initiateWithdrawal,
  confirmWithdrawal,
  resolveBankAccount,
  getSupportedBanks,
  calculateSettlementFee,
  getTransactionStatus,
} from "./paj-cash-integration";

describe("Paj Cash Integration", () => {
  describe("getExchangeRate", () => {
    it("should fetch current exchange rate", async () => {
      const rate = await getExchangeRate();

      expect(rate).toBeDefined();
      expect(rate.ngnToUsdt).toBeGreaterThan(0);
      expect(rate.usdtToNgn).toBeGreaterThan(0);
      expect(rate.timestamp).toBeInstanceOf(Date);
      expect(rate.source).toBe("paj.cash");
    });

    it("should have inverse rates", async () => {
      const rate = await getExchangeRate();

      // ngnToUsdt * usdtToNgn should be approximately 1
      const product = rate.ngnToUsdt * rate.usdtToNgn;
      expect(product).toBeCloseTo(1, 2);
    });

    it("should have realistic NGN/USDT rate", async () => {
      const rate = await getExchangeRate();

      // 1 USDT should be between 1000-2000 NGN
      expect(rate.usdtToNgn).toBeGreaterThan(1000);
      expect(rate.usdtToNgn).toBeLessThan(2000);
    });
  });

  describe("convertNgnToUsdt", () => {
    it("should convert NGN to USDT", async () => {
      const ngnAmount = 50000; // ₦50,000
      const usdtAmount = await convertNgnToUsdt(ngnAmount);

      expect(usdtAmount).toBeGreaterThan(0n);
      expect(typeof usdtAmount).toBe("bigint");
    });

    it("should handle large amounts", async () => {
      const ngnAmount = 1_000_000; // ₦1,000,000
      const usdtAmount = await convertNgnToUsdt(ngnAmount);

      expect(usdtAmount).toBeGreaterThan(0n);
    });

    it("should handle small amounts", async () => {
      const ngnAmount = 100; // ₦100
      const usdtAmount = await convertNgnToUsdt(ngnAmount);

      expect(usdtAmount).toBeGreaterThanOrEqual(0n);
    });

    it("should be consistent", async () => {
      const ngnAmount = 50000;
      const result1 = await convertNgnToUsdt(ngnAmount);
      const result2 = await convertNgnToUsdt(ngnAmount);

      expect(result1).toBe(result2);
    });
  });

  describe("convertUsdtToNgn", () => {
    it("should convert USDT to NGN", async () => {
      const usdtAmount = BigInt(50_000_000); // 50 USDT
      const ngnAmount = await convertUsdtToNgn(usdtAmount);

      expect(ngnAmount).toBeGreaterThan(0);
      expect(typeof ngnAmount).toBe("number");
    });

    it("should handle large amounts", async () => {
      const usdtAmount = BigInt(1_000_000_000); // 1000 USDT
      const ngnAmount = await convertUsdtToNgn(usdtAmount);

      expect(ngnAmount).toBeGreaterThan(0);
    });

    it("should handle minimum amounts", async () => {
      const usdtAmount = BigInt(1); // 0.000001 USDT
      const ngnAmount = await convertUsdtToNgn(usdtAmount);

      expect(ngnAmount).toBeGreaterThanOrEqual(0);
    });

    it("should be consistent", async () => {
      const usdtAmount = BigInt(50_000_000);
      const result1 = await convertUsdtToNgn(usdtAmount);
      const result2 = await convertUsdtToNgn(usdtAmount);

      expect(result1).toBe(result2);
    });
  });

  describe("initiateDeposit", () => {
    it("should initiate deposit successfully", async () => {
      const request = {
        userId: "user123",
        amount: BigInt(50_000_000), // 50 USDT
        reference: "ref123",
      };

      const result = await initiateDeposit(request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.amount).toBe(request.amount);
      expect(result.currency).toBe("USDT");
      expect(result.status).toBe("pending");
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should generate unique transaction IDs", async () => {
      const request = {
        userId: "user123",
        amount: BigInt(50_000_000),
        reference: "ref123",
      };

      const result1 = await initiateDeposit(request);
      const result2 = await initiateDeposit(request);

      expect(result1.transactionId).not.toBe(result2.transactionId);
    });

    it("should include NGN amount in message", async () => {
      const request = {
        userId: "user123",
        amount: BigInt(50_000_000),
        reference: "ref123",
      };

      const result = await initiateDeposit(request);

      expect(result.message).toContain("₦");
    });
  });

  describe("confirmDeposit", () => {
    it("should confirm deposit successfully", async () => {
      const transactionId = "dep_123";
      const amount = BigInt(50_000_000);

      const result = await confirmDeposit(transactionId, amount);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(transactionId);
      expect(result.amount).toBe(amount);
      expect(result.status).toBe("confirmed");
      expect(result.currency).toBe("USDT");
    });
  });

  describe("initiateWithdrawal", () => {
    it("should initiate withdrawal successfully", async () => {
      const request = {
        userId: "user123",
        amount: BigInt(50_000_000), // 50 USDT
        bankAccount: "1234567890",
        bankCode: "007",
        accountName: "John Doe",
        reference: "ref123",
      };

      const result = await initiateWithdrawal(request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.amount).toBe(request.amount);
      expect(result.currency).toBe("USDT");
      expect(result.status).toBe("pending");
    });

    it("should require bank account", async () => {
      const request = {
        userId: "user123",
        amount: BigInt(50_000_000),
        bankAccount: "",
        bankCode: "007",
        accountName: "John Doe",
        reference: "ref123",
      };

      await expect(initiateWithdrawal(request)).rejects.toThrow();
    });

    it("should require bank code", async () => {
      const request = {
        userId: "user123",
        amount: BigInt(50_000_000),
        bankAccount: "1234567890",
        bankCode: "",
        accountName: "John Doe",
        reference: "ref123",
      };

      await expect(initiateWithdrawal(request)).rejects.toThrow();
    });

    it("should include account name in message", async () => {
      const request = {
        userId: "user123",
        amount: BigInt(50_000_000),
        bankAccount: "1234567890",
        bankCode: "007",
        accountName: "John Doe",
        reference: "ref123",
      };

      const result = await initiateWithdrawal(request);

      expect(result.message).toContain("John Doe");
    });
  });

  describe("confirmWithdrawal", () => {
    it("should confirm withdrawal successfully", async () => {
      const transactionId = "wth_123";
      const amount = BigInt(50_000_000);
      const bankAccount = "1234567890";

      const result = await confirmWithdrawal(
        transactionId,
        amount,
        bankAccount
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(transactionId);
      expect(result.amount).toBe(amount);
      expect(result.status).toBe("confirmed");
    });
  });

  describe("resolveBankAccount", () => {
    it("should resolve bank account", async () => {
      const result = await resolveBankAccount("007", "1234567890");

      expect(result).toBeDefined();
      expect(result.accountName).toBeDefined();
      expect(result.accountNumber).toBe("1234567890");
      expect(result.bankCode).toBe("007");
    });

    it("should return account name", async () => {
      const result = await resolveBankAccount("007", "1234567890");

      expect(typeof result.accountName).toBe("string");
      expect(result.accountName.length).toBeGreaterThan(0);
    });
  });

  describe("getSupportedBanks", () => {
    it("should return list of supported banks", async () => {
      const banks = await getSupportedBanks();

      expect(Array.isArray(banks)).toBe(true);
      expect(banks.length).toBeGreaterThan(0);
    });

    it("should have bank code and name", async () => {
      const banks = await getSupportedBanks();

      for (const bank of banks) {
        expect(bank.code).toBeDefined();
        expect(bank.name).toBeDefined();
        expect(typeof bank.code).toBe("string");
        expect(typeof bank.name).toBe("string");
      }
    });

    it("should include major Nigerian banks", async () => {
      const banks = await getSupportedBanks();
      const bankNames = banks.map((b) => b.name);

      expect(bankNames).toContain("Zenith Bank");
      expect(bankNames).toContain("GTBank");
      expect(bankNames).toContain("First Bank");
      expect(bankNames).toContain("UBA");
    });

    it("should have unique bank codes", async () => {
      const banks = await getSupportedBanks();
      const codes = banks.map((b) => b.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("calculateSettlementFee", () => {
    it("should calculate 1% fee", () => {
      const amount = BigInt(100_000_000); // 100 USDT
      const fee = calculateSettlementFee(amount);

      // 1% of 100 USDT = 1 USDT = 1_000_000 smallest units
      expect(fee).toBe(BigInt(1_000_000));
    });

    it("should handle zero amount", () => {
      const amount = BigInt(0);
      const fee = calculateSettlementFee(amount);

      expect(fee).toBe(0n);
    });

    it("should handle large amounts", () => {
      const amount = BigInt(1_000_000_000); // 1000 USDT
      const fee = calculateSettlementFee(amount);

      expect(fee).toBeGreaterThan(0n);
      expect(fee).toBeLessThan(amount);
    });

    it("should be consistent", () => {
      const amount = BigInt(50_000_000);
      const fee1 = calculateSettlementFee(amount);
      const fee2 = calculateSettlementFee(amount);

      expect(fee1).toBe(fee2);
    });
  });

  describe("getTransactionStatus", () => {
    it("should fetch transaction status", async () => {
      const transactionId = "tx_123";
      const result = await getTransactionStatus(transactionId);

      expect(result).toBeDefined();
      expect(result.transactionId).toBe(transactionId);
      expect(result.status).toBeDefined();
      expect(result.amount).toBeGreaterThan(0n);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should have valid status", async () => {
      const result = await getTransactionStatus("tx_123");

      expect(["pending", "confirmed", "failed"]).toContain(result.status);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle complete deposit flow", async () => {
      // Initiate deposit
      const depositRequest = {
        userId: "user123",
        amount: BigInt(50_000_000),
        reference: "ref123",
      };
      const initiated = await initiateDeposit(depositRequest);
      expect(initiated.success).toBe(true);

      // Confirm deposit
      const confirmed = await confirmDeposit(
        initiated.transactionId,
        initiated.amount
      );
      expect(confirmed.success).toBe(true);
      expect(confirmed.status).toBe("confirmed");
    });

    it("should handle complete withdrawal flow", async () => {
      // Initiate withdrawal
      const withdrawalRequest = {
        userId: "user123",
        amount: BigInt(50_000_000),
        bankAccount: "1234567890",
        bankCode: "007",
        accountName: "John Doe",
        reference: "ref123",
      };
      const initiated = await initiateWithdrawal(withdrawalRequest);
      expect(initiated.success).toBe(true);

      // Confirm withdrawal
      const confirmed = await confirmWithdrawal(
        initiated.transactionId,
        initiated.amount,
        withdrawalRequest.bankAccount
      );
      expect(confirmed.success).toBe(true);
      expect(confirmed.status).toBe("confirmed");
    });

    it("should handle NGN/USDT conversion round trip", async () => {
      const originalNgn = 50000;

      // Convert NGN to USDT
      const usdt = await convertNgnToUsdt(originalNgn);
      expect(usdt).toBeGreaterThan(0n);

      // Convert USDT back to NGN
      const ngnAgain = await convertUsdtToNgn(usdt);

      // Should be approximately the same (accounting for rounding)
      expect(ngnAgain).toBeGreaterThan(originalNgn - 100);
      expect(ngnAgain).toBeLessThan(originalNgn + 100);
    });

    it("should handle multiple deposits and withdrawals", async () => {
      for (let i = 0; i < 5; i++) {
        const amount = BigInt(10_000_000 * (i + 1));

        // Deposit
        const deposit = await initiateDeposit({
          userId: `user${i}`,
          amount,
          reference: `ref${i}`,
        });
        expect(deposit.success).toBe(true);

        // Withdrawal
        const withdrawal = await initiateWithdrawal({
          userId: `user${i}`,
          amount,
          bankAccount: `account${i}`,
          bankCode: "007",
          accountName: `User ${i}`,
          reference: `ref${i}`,
        });
        expect(withdrawal.success).toBe(true);
      }
    });
  });
});
