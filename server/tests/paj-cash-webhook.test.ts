import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.hoisted(() => {
  process.env.WALLET_ENCRYPTION_KEY = "0".repeat(64);
});

const mocks = vi.hoisted(() => ({
  getFiatRequestByReference: vi.fn(),
  updateFiatRequestStatus: vi.fn(async () => {}),
  insertUserTransaction: vi.fn(async () => ({})),
  getUserWallets: vi.fn(async () => []),
  getUserWalletByChain: vi.fn(),
  shieldPublicBalance: vi.fn(async () => ({ queueSignature: "shield-sig" })),
}));

vi.mock("../db", () => ({
  getFiatRequestByReference: mocks.getFiatRequestByReference,
  updateFiatRequestStatus: mocks.updateFiatRequestStatus,
  insertUserTransaction: mocks.insertUserTransaction,
  getUserWallets: mocks.getUserWallets,
  getUserWalletByChain: mocks.getUserWalletByChain,
}));

vi.mock("../services/umbra", () => ({
  shieldPublicBalance: mocks.shieldPublicBalance,
}));

import { registerPajCashWebhook } from "../routes/paj-cash-webhook";

function buildApp() {
  const app = express();
  app.use(express.json());
  registerPajCashWebhook(app);
  return app;
}

const SAMPLE_REQUEST = {
  id: 1,
  userId: 42,
  type: "deposit" as const,
  amount: "100000",
  currency: "NGN",
  pajCashReference: "ref-1",
  status: "pending" as const,
  stealthAddressId: null,
  bankAccount: null,
  createdAt: new Date(),
  confirmedAt: null,
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.updateFiatRequestStatus.mockImplementation(async () => {});
  mocks.insertUserTransaction.mockImplementation(async () => ({}));
  mocks.shieldPublicBalance.mockImplementation(async () => ({ queueSignature: "shield-sig" }));
  mocks.getUserWallets.mockImplementation(async () => []);
  mocks.getUserWalletByChain.mockImplementation(async () => undefined);
});

describe("paj-cash webhook", () => {
  it("returns 200 with no-op when id or status are missing", async () => {
    const res = await request(buildApp()).post("/api/webhooks/paj-cash").send({ status: "INIT" });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mocks.getFiatRequestByReference).not.toHaveBeenCalled();
  });

  it("returns 200 and ignores unknown statuses", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/paj-cash")
      .send({ id: "ref-1", status: "BOGUS" });
    expect(res.status).toBe(200);
    expect(res.body.ignored).toMatch(/unknown status/);
  });

  it("returns 200 and skips persistence when no matching fiat_request exists", async () => {
    mocks.getFiatRequestByReference.mockResolvedValueOnce(undefined);
    const res = await request(buildApp())
      .post("/api/webhooks/paj-cash")
      .send({ id: "ref-missing", status: "COMPLETED", transactionType: "ON_RAMP", amount: 10 });
    expect(res.status).toBe(200);
    expect(mocks.updateFiatRequestStatus).not.toHaveBeenCalled();
    expect(mocks.insertUserTransaction).not.toHaveBeenCalled();
  });

  it("maps INIT/PAID/FAILED statuses to fiat_request status without inserting transactions on PAID", async () => {
    mocks.getFiatRequestByReference.mockResolvedValue(SAMPLE_REQUEST);
    await request(buildApp()).post("/api/webhooks/paj-cash").send({ id: "ref-1", status: "PAID", transactionType: "ON_RAMP" });
    expect(mocks.updateFiatRequestStatus).toHaveBeenCalledWith("ref-1", "processing", undefined);
    expect(mocks.insertUserTransaction).not.toHaveBeenCalled();
  });

  it("on COMPLETED ON_RAMP: updates status, shields, and inserts user_transaction", async () => {
    mocks.getFiatRequestByReference.mockResolvedValueOnce(SAMPLE_REQUEST);
    mocks.getUserWalletByChain.mockResolvedValueOnce(
      { id: 7, userId: 42, address: "Sol111", privateKey: "iv:c:t", stealthKey: "iv:c:t", claimKey: "iv:c:t", balance: "0", lastBalanceUpdate: new Date(), createdAt: new Date(), updatedAt: new Date() },
    );

    const res = await request(buildApp())
      .post("/api/webhooks/paj-cash")
      .send({ id: "ref-1", status: "COMPLETED", transactionType: "ON_RAMP", amount: 99, mint: "USDC-mint" });

    expect(res.status).toBe(200);
    expect(mocks.updateFiatRequestStatus).toHaveBeenCalledWith("ref-1", "confirmed", expect.any(Date));
    expect(mocks.shieldPublicBalance).toHaveBeenCalledWith({
      userWallet: expect.objectContaining({ userId: 42, address: "Sol111" }),
      tokenMint: "USDC-mint",
      transferAmount: 99000000n,
    });
    expect(mocks.insertUserTransaction).toHaveBeenCalledTimes(1);
    const inserted = mocks.insertUserTransaction.mock.calls[0][0];
    expect(inserted.type).toBe("deposit");
    expect(inserted.status).toBe("confirmed");
    expect(inserted.pajCashReference).toBe("ref-1");
  });

  it("on COMPLETED OFF_RAMP: inserts a withdrawal user_transaction (no shielding)", async () => {
    mocks.getFiatRequestByReference.mockResolvedValueOnce({ ...SAMPLE_REQUEST, type: "withdrawal" });
    const res = await request(buildApp())
      .post("/api/webhooks/paj-cash")
      .send({ id: "ref-1", status: "COMPLETED", transactionType: "OFF_RAMP", amount: 50, mint: "USDC-mint" });
    expect(res.status).toBe(200);
    expect(mocks.shieldPublicBalance).not.toHaveBeenCalled();
    const inserted = mocks.insertUserTransaction.mock.calls[0][0];
    expect(inserted.type).toBe("withdrawal");
    expect(inserted.status).toBe("confirmed");
  });

  it("on FAILED: marks fiat_request failed and inserts a failed user_transaction", async () => {
    mocks.getFiatRequestByReference.mockResolvedValueOnce(SAMPLE_REQUEST);
    const res = await request(buildApp())
      .post("/api/webhooks/paj-cash")
      .send({ id: "ref-1", status: "FAILED", transactionType: "ON_RAMP" });
    expect(res.status).toBe(200);
    expect(mocks.updateFiatRequestStatus).toHaveBeenCalledWith("ref-1", "failed", undefined);
    expect(mocks.insertUserTransaction).toHaveBeenCalledTimes(1);
    const inserted = mocks.insertUserTransaction.mock.calls[0][0];
    expect(inserted.status).toBe("failed");
  });

  it("returns 200 even when DB throws (idempotent webhook contract)", async () => {
    mocks.getFiatRequestByReference.mockRejectedValueOnce(new Error("db down"));
    const res = await request(buildApp())
      .post("/api/webhooks/paj-cash")
      .send({ id: "ref-1", status: "COMPLETED", transactionType: "ON_RAMP" });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.error).toBe("internal");
  });
});
