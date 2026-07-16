import {
  initializeSDK,
  initiate,
  verify,
  createOnrampOrder,
  createOfframpOrder,
  getAllRate,
  getBanks,
  resolveBankAccount,
  Environment,
  Currency,
  Chain,
  type CreateOnrampOrder,
  type CreateOfframpOrder,
  type OnrampOrder,
  type OfframpOrder,
  type InitiateResponse,
  type Verify,
  type DeviceSignature,
  type Bank,
  type ResolveBankAccount,
} from "paj_ramp";
import { ENV } from "../_core/env";
import { encryptSecret, decryptSecret } from "../utils/wallet-crypto";
import {
  getActivePajCashSession,
  upsertPajCashSession,
} from "../db";

let sdkInitialized = false;

function resolveEnvironment(): Environment {
  const v = ENV.pajCashEnvironment.toLowerCase();
  if (v === "production") return Environment.Production;
  if (v === "local") return Environment.Local;
  return Environment.Staging;
}

export function ensureSDKInitialized(): void {
  if (sdkInitialized) return;
  initializeSDK(resolveEnvironment());
  sdkInitialized = true;
}

// ---------- Platform session lifecycle (admin OTP flow) ----------

export async function initiatePlatformSession(email: string): Promise<InitiateResponse> {
  ensureSDKInitialized();
  return initiate(email, ENV.pajCashApiKey);
}

const PLATFORM_DEVICE: DeviceSignature = {
  uuid: "fluxa-platform-server",
  device: "fluxa-server",
  os: "linux",
  browser: "node",
};

export async function verifyPlatformSession(
  email: string,
  otp: string,
): Promise<{ expiresAt: Date }> {
  ensureSDKInitialized();
  const result: Verify = await verify(email, otp, PLATFORM_DEVICE, ENV.pajCashApiKey);
  const encrypted = encryptSecret(Buffer.from(result.token, "utf8"));
  const expiresAt = new Date(result.expiresAt);
  await upsertPajCashSession({ email, encryptedToken: encrypted, expiresAt });
  return { expiresAt };
}

export async function getPlatformSessionToken(): Promise<string> {
  const session = await getActivePajCashSession();
  if (!session) {
    throw new Error("No active Paj Cash session — admin must run pajCashInitiate + pajCashVerify");
  }
  return decryptSecret(session.encryptedToken).toString("utf8");
}

// ---------- Order creation ----------

const ACCEPTED_MINTS = ENV.pajCashAcceptedMints.map((m) => m.trim()).filter(Boolean);

function resolveMint(inputMint?: string): string {
  if (inputMint && ACCEPTED_MINTS.includes(inputMint)) return inputMint;
  return ENV.pajCashUsdcMint;
}

export async function createDepositOrder(input: {
  nairaAmount: number;
  recipientAddress: string;
  mint?: string;
}): Promise<OnrampOrder> {
  ensureSDKInitialized();
  const token = await getPlatformSessionToken();
  const order: CreateOnrampOrder = {
    fiatAmount: input.nairaAmount,
    currency: Currency.NGN,
    recipient: input.recipientAddress,
    mint: resolveMint(input.mint),
    chain: Chain.SOLANA,
    webhookURL: ENV.pajCashWebhookUrl,
  };
  return createOnrampOrder(order, token);
}

export async function createWithdrawalOrder(input: {
  usdtAmount: number;
  bankId: string;
  accountNumber: string;
  mint?: string;
}): Promise<OfframpOrder> {
  ensureSDKInitialized();
  const token = await getPlatformSessionToken();
  const order: CreateOfframpOrder = {
    bank: input.bankId,
    accountNumber: input.accountNumber,
    currency: Currency.NGN,
    amount: input.usdtAmount,
    mint: resolveMint(input.mint),
    chain: Chain.SOLANA,
    webhookURL: ENV.pajCashWebhookUrl,
  };
  return createOfframpOrder(order, token);
}

// ---------- Read-through helpers for the UI ----------

export async function listBanks(): Promise<Bank[]> {
  ensureSDKInitialized();
  const token = await getPlatformSessionToken();
  return getBanks(token);
}

export async function resolveAccount(
  bankId: string,
  accountNumber: string,
): Promise<ResolveBankAccount> {
  ensureSDKInitialized();
  const token = await getPlatformSessionToken();
  return resolveBankAccount(token, bankId, accountNumber);
}

export async function getRates() {
  ensureSDKInitialized();
  return getAllRate();
}
