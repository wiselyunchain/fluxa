import axios, { AxiosInstance } from "axios";
import { ENV } from "./_core/env";

/**
 * Paj Cash API client for NGN ↔ USDT conversion and settlement
 */
class PajCashClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = ENV.pajCashApiKey;
    this.baseUrl = ENV.pajCashApiUrl;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  /**
   * Initiate a deposit (NGN → USDT)
   * User transfers NGN to Paj Cash bank account
   * Paj Cash converts and sends USDT to stealth address
   */
  async initiateDeposit(params: {
    userId: string;
    nairaAmount: number;
    userBankAccount?: string;
    stealthAddress: string;
  }) {
    try {
      const response = await this.client.post("/deposits/initiate", {
        userId: params.userId,
        nairaAmount: params.nairaAmount,
        userBankAccount: params.userBankAccount,
        stealthAddress: params.stealthAddress,
        callbackUrl: `${ENV.appBaseUrl}/api/webhooks/paj-cash`,
      });

      console.log(`[Paj Cash] Deposit initiated: ${response.data.reference}`);
      return {
        success: true,
        reference: response.data.reference,
        bankAccount: response.data.bankAccount,
        bankName: response.data.bankName,
        accountName: response.data.accountName,
        expiresAt: response.data.expiresAt,
      };
    } catch (error: any) {
      console.error("[Paj Cash] Deposit initiation failed:", error.response?.data || error.message);
      throw new Error(`Failed to initiate deposit: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify deposit status
   * Check if NGN transfer was received and USDT was sent
   */
  async verifyDeposit(reference: string) {
    try {
      const response = await this.client.get(`/deposits/${reference}/status`);

      console.log(`[Paj Cash] Deposit status: ${response.data.status}`);
      return {
        success: true,
        status: response.data.status, // 'pending', 'confirmed', 'failed'
        nairaAmount: response.data.nairaAmount,
        usdtAmount: response.data.usdtAmount,
        usdtTransactionHash: response.data.usdtTransactionHash,
        confirmedAt: response.data.confirmedAt,
      };
    } catch (error: any) {
      console.error("[Paj Cash] Deposit verification failed:", error.response?.data || error.message);
      throw new Error(`Failed to verify deposit: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Initiate a withdrawal (USDT → NGN)
   * User sends USDT to Paj Cash stealth address
   * Paj Cash converts and transfers NGN to user's bank account
   */
  async initiateWithdrawal(params: {
    userId: string;
    usdtAmount: number;
    userBankAccount: string;
    bankCode: string;
    accountName: string;
  }) {
    try {
      const response = await this.client.post("/withdrawals/initiate", {
        userId: params.userId,
        usdtAmount: params.usdtAmount,
        userBankAccount: params.userBankAccount,
        bankCode: params.bankCode,
        accountName: params.accountName,
        callbackUrl: `${ENV.appBaseUrl}/api/webhooks/paj-cash`,
      });

      console.log(`[Paj Cash] Withdrawal initiated: ${response.data.reference}`);
      return {
        success: true,
        reference: response.data.reference,
        stealthAddress: response.data.stealthAddress,
        expectedNairaAmount: response.data.expectedNairaAmount,
        fee: response.data.fee,
        expiresAt: response.data.expiresAt,
      };
    } catch (error: any) {
      console.error("[Paj Cash] Withdrawal initiation failed:", error.response?.data || error.message);
      throw new Error(`Failed to initiate withdrawal: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify withdrawal status
   * Check if USDT was received and NGN was transferred
   */
  async verifyWithdrawal(reference: string) {
    try {
      const response = await this.client.get(`/withdrawals/${reference}/status`);

      console.log(`[Paj Cash] Withdrawal status: ${response.data.status}`);
      return {
        success: true,
        status: response.data.status, // 'pending', 'confirmed', 'failed'
        usdtAmount: response.data.usdtAmount,
        nairaAmount: response.data.nairaAmount,
        bankTransferReference: response.data.bankTransferReference,
        confirmedAt: response.data.confirmedAt,
      };
    } catch (error: any) {
      console.error("[Paj Cash] Withdrawal verification failed:", error.response?.data || error.message);
      throw new Error(`Failed to verify withdrawal: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get exchange rate (NGN → USDT or USDT → NGN)
   */
  async getExchangeRate(direction: "naira_to_usdt" | "usdt_to_naira") {
    try {
      const response = await this.client.get("/rates", {
        params: { direction },
      });

      console.log(`[Paj Cash] Exchange rate: ${response.data.rate}`);
      return {
        success: true,
        rate: response.data.rate,
        timestamp: response.data.timestamp,
      };
    } catch (error: any) {
      console.error("[Paj Cash] Rate fetch failed:", error.response?.data || error.message);
      throw new Error(`Failed to get exchange rate: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Validate Nigerian bank account
   */
  async validateBankAccount(params: {
    bankCode: string;
    accountNumber: string;
  }) {
    try {
      const response = await this.client.post("/bank/validate", {
        bankCode: params.bankCode,
        accountNumber: params.accountNumber,
      });

      console.log(`[Paj Cash] Bank account validated: ${response.data.accountName}`);
      return {
        success: true,
        accountName: response.data.accountName,
        bankName: response.data.bankName,
      };
    } catch (error: any) {
      console.error("[Paj Cash] Bank validation failed:", error.response?.data || error.message);
      throw new Error(`Failed to validate bank account: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get list of supported Nigerian banks
   */
  async getSupportedBanks() {
    try {
      const response = await this.client.get("/bank/list");

      console.log(`[Paj Cash] Retrieved ${response.data.banks.length} supported banks`);
      return {
        success: true,
        banks: response.data.banks,
      };
    } catch (error: any) {
      console.error("[Paj Cash] Bank list fetch failed:", error.response?.data || error.message);
      throw new Error(`Failed to get supported banks: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get Paj Cash stealth address for receiving USDT
   * Used for withdrawal flow
   */
  async getStealthAddress() {
    try {
      const response = await this.client.get("/stealth-address");

      console.log(`[Paj Cash] Stealth address: ${response.data.address}`);
      return {
        success: true,
        address: response.data.address,
        mint: response.data.mint, // USDT mint
      };
    } catch (error: any) {
      console.error("[Paj Cash] Stealth address fetch failed:", error.response?.data || error.message);
      throw new Error(`Failed to get stealth address: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * Ensures webhook is from Paj Cash
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", this.apiKey);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    return expectedSignature === signature;
  }
}

// Singleton instance
let pajCashClient: PajCashClient | null = null;

export function getPajCashClient(): PajCashClient {
  if (!pajCashClient) {
    pajCashClient = new PajCashClient();
  }
  return pajCashClient;
}

/**
 * Calculate fees for Paj Cash operations
 * Paj Cash charges a percentage fee on conversions
 */
export function calculatePajCashFee(amount: number, feePercentage: number = 0.5): number {
  return amount * (feePercentage / 100);
}

/**
 * Supported Nigerian banks (common ones)
 */
export const NIGERIAN_BANKS = {
  "001": { code: "001", name: "Access Bank" },
  "044": { code: "044", name: "Access Bank (Diamond)" },
  "050": { code: "050", name: "Ecobank" },
  "011": { code: "011", name: "First Bank" },
  "058": { code: "058", name: "Guaranty Trust Bank" },
  "012": { code: "012", name: "WEMA Bank" },
  "032": { code: "032", name: "Union Bank" },
  "024": { code: "024", name: "United Bank for Africa" },
  "033": { code: "033", name: "United Bank for Africa (UBA)" },
  "035": { code: "035", name: "Wema Bank" },
  "037": { code: "037", name: "Zenith Bank" },
  "039": { code: "039", name: "Stanbic IBTC" },
  "040": { code: "040", name: "Stanbic IBTC (Stanbic)" },
  "057": { code: "057", name: "Sterling Bank" },
  "070": { code: "070", name: "Fidelity Bank" },
  "071": { code: "071", name: "Fidelity Bank (Fidelity)" },
  "082": { code: "082", name: "Fidelity Bank (Fidelity)" },
  "089": { code: "089", name: "Fidelity Bank (Fidelity)" },
};
