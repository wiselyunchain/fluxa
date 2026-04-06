import axios from "axios";
import { z } from "zod";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    paid_at: string;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
    status: "success" | "failed" | "abandoned";
  };
}

export interface PaystackTransferResponse {
  status: boolean;
  message: string;
  data: {
    transfer_code: string;
    reference: string;
    status: string;
  };
}

/**
 * Initialize a Paystack payment transaction
 * Used for on-ramp (NGN to crypto) flows
 */
export async function initializePaystackPayment(params: {
  email: string;
  amount: number; // Amount in kobo (NGN * 100)
  reference: string;
  metadata?: Record<string, any>;
}): Promise<PaystackInitializeResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }

  try {
    const response = await axios.post<PaystackInitializeResponse>(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        metadata: params.metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.message || "Failed to initialize payment");
    }

    return response.data;
  } catch (error: any) {
    console.error("[Paystack] Initialize payment error:", error.response?.data || error.message);
    throw new Error(`Paystack initialization failed: ${error.message}`);
  }
}

/**
 * Verify a Paystack payment transaction
 * Used to confirm payment completion and credit user account
 */
export async function verifyPaystackPayment(reference: string): Promise<PaystackVerifyResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }

  try {
    const response = await axios.get<PaystackVerifyResponse>(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.message || "Failed to verify payment");
    }

    return response.data;
  } catch (error: any) {
    console.error("[Paystack] Verify payment error:", error.response?.data || error.message);
    throw new Error(`Paystack verification failed: ${error.message}`);
  }
}

/**
 * Initiate a bank transfer via Paystack
 * Used for off-ramp (crypto to NGN) flows
 */
export async function initiatePaystackTransfer(params: {
  recipient_code: string;
  amount: number; // Amount in kobo (NGN * 100)
  reference: string;
  reason?: string;
}): Promise<PaystackTransferResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }

  try {
    const response = await axios.post<PaystackTransferResponse>(
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        source: "balance",
        recipient: params.recipient_code,
        amount: params.amount,
        reference: params.reference,
        reason: params.reason,
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.message || "Failed to initiate transfer");
    }

    return response.data;
  } catch (error: any) {
    console.error("[Paystack] Initiate transfer error:", error.response?.data || error.message);
    throw new Error(`Paystack transfer failed: ${error.message}`);
  }
}

/**
 * Create a recipient for bank transfers
 * Used during off-ramp setup to store user bank details
 */
export async function createPaystackRecipient(params: {
  type: "nuban" | "mobile_money" | "ghipss";
  name: string;
  account_number: string;
  bank_code: string;
  currency?: string;
}): Promise<{
  status: boolean;
  message: string;
  data: {
    recipient_code: string;
    active: boolean;
  };
}> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }

  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: params.type,
        name: params.name,
        account_number: params.account_number,
        bank_code: params.bank_code,
        currency: params.currency || "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.message || "Failed to create recipient");
    }

    return response.data;
  } catch (error: any) {
    console.error("[Paystack] Create recipient error:", error.response?.data || error.message);
    throw new Error(`Paystack recipient creation failed: ${error.message}`);
  }
}

/**
 * Get list of banks for recipient creation
 * Used during off-ramp setup for bank selection
 */
export async function getPaystackBanks(): Promise<{
  status: boolean;
  message: string;
  data: Array<{
    id: number;
    code: string;
    name: string;
  }>;
}> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }

  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank?currency=NGN`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.message || "Failed to fetch banks");
    }

    return response.data;
  } catch (error: any) {
    console.error("[Paystack] Get banks error:", error.response?.data || error.message);
    throw new Error(`Paystack bank fetch failed: ${error.message}`);
  }
}

/**
 * Resolve account number to get account name
 * Used for verification during off-ramp setup
 */
export async function resolvePaystackAccount(params: {
  account_number: string;
  bank_code: string;
}): Promise<{
  status: boolean;
  message: string;
  data: {
    account_number: string;
    account_name: string;
  };
}> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }

  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${params.account_number}&bank_code=${params.bank_code}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.message || "Failed to resolve account");
    }

    return response.data;
  } catch (error: any) {
    console.error("[Paystack] Resolve account error:", error.response?.data || error.message);
    throw new Error(`Paystack account resolution failed: ${error.message}`);
  }
}
