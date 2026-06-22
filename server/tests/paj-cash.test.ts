import { describe, expect, it, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.WALLET_ENCRYPTION_KEY = "0".repeat(64);
  process.env.PAJ_CASH_API_KEY = "test-api-key";
  process.env.PAJ_CASH_ENVIRONMENT = "Staging";
  process.env.PAJ_CASH_WEBHOOK_URL = "https://example.com/webhook";
});

const mocks = vi.hoisted(() => ({
  initializeSDK: vi.fn(),
  initiate: vi.fn(),
  verify: vi.fn(),
  createOnrampOrder: vi.fn(),
  createOfframpOrder: vi.fn(),
  getAllRate: vi.fn(),
  getBanks: vi.fn(),
  resolveBankAccount: vi.fn(),

  getActivePajCashSession: vi.fn(),
  upsertPajCashSession: vi.fn(async () => {}),
}));

vi.mock("paj_ramp", () => ({
  initializeSDK: mocks.initializeSDK,
  initiate: mocks.initiate,
  verify: mocks.verify,
  createOnrampOrder: mocks.createOnrampOrder,
  createOfframpOrder: mocks.createOfframpOrder,
  getAllRate: mocks.getAllRate,
  getBanks: mocks.getBanks,
  resolveBankAccount: mocks.resolveBankAccount,
  Environment: { Staging: "staging", Production: "production", Local: "local" },
  Currency: { NGN: "NGN", USD: "USD" },
  Chain: { SOLANA: "SOLANA", MONAD: "MONAD" },
}));

vi.mock("../db", () => ({
  getActivePajCashSession: mocks.getActivePajCashSession,
  upsertPajCashSession: mocks.upsertPajCashSession,
}));

import {
  initiatePlatformSession,
  verifyPlatformSession,
  getPlatformSessionToken,
  createDepositOrder,
  createWithdrawalOrder,
  listBanks,
  resolveAccount,
  getRates,
} from "../services/paj-cash";
import { encryptSecret } from "../utils/wallet-crypto";

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) m.mockReset();
  });
  mocks.upsertPajCashSession.mockImplementation(async () => {});
});

describe("paj-cash platform session", () => {
  it("initiatePlatformSession calls the SDK with the configured API key", async () => {
    mocks.initiate.mockResolvedValueOnce({ email: "ops@fluxa.test" });
    const out = await initiatePlatformSession("ops@fluxa.test");
    expect(mocks.initializeSDK).toHaveBeenCalledWith("staging");
    expect(mocks.initiate).toHaveBeenCalledWith("ops@fluxa.test", "test-api-key");
    expect(out.email).toBe("ops@fluxa.test");
  });

  it("verifyPlatformSession encrypts the SDK token and upserts the session", async () => {
    mocks.verify.mockResolvedValueOnce({
      recipient: "ops@fluxa.test",
      isActive: "true",
      expiresAt: "2030-01-01T00:00:00.000Z",
      token: "super-secret-token",
    });

    const { expiresAt } = await verifyPlatformSession("ops@fluxa.test", "123456");

    expect(expiresAt.toISOString()).toBe("2030-01-01T00:00:00.000Z");
    expect(mocks.upsertPajCashSession).toHaveBeenCalledTimes(1);
    const call = mocks.upsertPajCashSession.mock.calls[0][0];
    expect(call.email).toBe("ops@fluxa.test");
    expect(call.encryptedToken).not.toBe("super-secret-token");
    expect(call.encryptedToken.split(":")).toHaveLength(3);
    expect(call.expiresAt.toISOString()).toBe("2030-01-01T00:00:00.000Z");
  });

  it("getPlatformSessionToken decrypts the cached session", async () => {
    const encrypted = encryptSecret(Buffer.from("plaintext-token", "utf8"));
    mocks.getActivePajCashSession.mockResolvedValueOnce({
      id: 1,
      email: "ops@fluxa.test",
      encryptedToken: encrypted,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await getPlatformSessionToken();
    expect(token).toBe("plaintext-token");
  });

  it("getPlatformSessionToken throws when no session exists", async () => {
    mocks.getActivePajCashSession.mockResolvedValueOnce(undefined);
    await expect(getPlatformSessionToken()).rejects.toThrow(/No active Paj Cash session/);
  });
});

describe("paj-cash order creation", () => {
  beforeEach(() => {
    const encrypted = encryptSecret(Buffer.from("session-token", "utf8"));
    mocks.getActivePajCashSession.mockResolvedValue({
      id: 1,
      email: "ops@fluxa.test",
      encryptedToken: encrypted,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("createDepositOrder forwards mint+chain+webhook to the SDK", async () => {
    mocks.createOnrampOrder.mockResolvedValueOnce({
      id: "order-1",
      accountNumber: "0123456789",
      accountName: "Fluxa",
      amount: 100,
      fiatAmount: 100_000,
      bank: "GTB",
      rate: 1000,
      recipient: "Solana1111111111111111111111111111111111111",
      currency: "NGN",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      fee: 1,
    });

    const order = await createDepositOrder({
      nairaAmount: 100_000,
      recipientAddress: "Solana1111111111111111111111111111111111111",
    });

    expect(mocks.createOnrampOrder).toHaveBeenCalledTimes(1);
    const [body, token] = mocks.createOnrampOrder.mock.calls[0];
    expect(token).toBe("session-token");
    expect(body.fiatAmount).toBe(100_000);
    expect(body.currency).toBe("NGN");
    expect(body.recipient).toBe("Solana1111111111111111111111111111111111111");
    expect(body.chain).toBe("SOLANA");
    expect(body.webhookURL).toBe("https://example.com/webhook");
    expect(order.id).toBe("order-1");
  });

  it("createWithdrawalOrder passes bank+account+mint+webhook to the SDK", async () => {
    mocks.createOfframpOrder.mockResolvedValueOnce({
      id: "order-2",
      address: "Solana222222222222222222222222222222222",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      currency: "NGN",
      amount: 50,
      fiatAmount: 50_000,
      rate: 1000,
      fee: 1,
    });

    const order = await createWithdrawalOrder({
      usdtAmount: 50,
      bankId: "058",
      accountNumber: "0123456789",
    });

    expect(mocks.createOfframpOrder).toHaveBeenCalledTimes(1);
    const [body, token] = mocks.createOfframpOrder.mock.calls[0];
    expect(token).toBe("session-token");
    expect(body.bank).toBe("058");
    expect(body.accountNumber).toBe("0123456789");
    expect(body.amount).toBe(50);
    expect(body.chain).toBe("SOLANA");
    expect(body.webhookURL).toBe("https://example.com/webhook");
    expect(order.id).toBe("order-2");
  });
});

describe("paj-cash read-throughs", () => {
  beforeEach(() => {
    const encrypted = encryptSecret(Buffer.from("token", "utf8"));
    mocks.getActivePajCashSession.mockResolvedValue({
      id: 1,
      email: "ops@fluxa.test",
      encryptedToken: encrypted,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("listBanks forwards the session token", async () => {
    mocks.getBanks.mockResolvedValueOnce([{ id: "058", code: "058", name: "GTB", logo: "", country: "NG" }]);
    const banks = await listBanks();
    expect(mocks.getBanks).toHaveBeenCalledWith("token");
    expect(banks).toHaveLength(1);
  });

  it("resolveAccount forwards the session token + ids", async () => {
    mocks.resolveBankAccount.mockResolvedValueOnce({
      accountName: "Jane Doe",
      accountNumber: "0123456789",
      bank: { id: "058", name: "GTB", code: "058", country: "NG" },
    });
    const out = await resolveAccount("058", "0123456789");
    expect(mocks.resolveBankAccount).toHaveBeenCalledWith("token", "058", "0123456789");
    expect(out.accountName).toBe("Jane Doe");
  });

  it("getRates returns the SDK response untouched", async () => {
    mocks.getAllRate.mockResolvedValueOnce({
      onRampRate: { baseCurrency: "USD", targetCurrency: "NGN", isActive: true, rate: 1500, type: "onRamp" },
      offRampRate: { baseCurrency: "USD", targetCurrency: "NGN", isActive: true, rate: 1450, type: "offRamp" },
    });
    const out = await getRates();
    expect(out.onRampRate.rate).toBe(1500);
    expect(out.offRampRate.rate).toBe(1450);
  });
});
