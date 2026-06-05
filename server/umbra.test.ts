import { describe, expect, it, vi, beforeEach } from "vitest";
import { randomBytes } from "crypto";

const mocks = vi.hoisted(() => {
  const mockDeposit = vi.fn();
  return {
    mockDeposit,
    mockGetDeposit: vi.fn(() => mockDeposit),
    mockGetUmbraClient: vi.fn(async (args: unknown) => ({ __mock: "client", args })),
    mockCreateSigner: vi.fn(async (bytes: Uint8Array) => ({ __mock: "signer", bytes })),
    mockUpsertUmbra: vi.fn(async () => {}),
  };
});

vi.mock("@umbra-privacy/sdk", () => ({
  getUmbraClient: mocks.mockGetUmbraClient,
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction: mocks.mockGetDeposit,
  createSignerFromPrivateKeyBytes: mocks.mockCreateSigner,
}));

vi.mock("@solana/kit", () => ({
  address: (a: string) => a,
}));

vi.mock("./db", () => ({
  upsertUmbraEncryptedBalance: mocks.mockUpsertUmbra,
}));

const KEY_HEX = "0".repeat(64);
process.env.WALLET_ENCRYPTION_KEY = KEY_HEX;

const { mockDeposit, mockGetDeposit, mockGetUmbraClient, mockCreateSigner, mockUpsertUmbra } = mocks;

import { encryptSecret } from "./wallet-crypto";
import { shieldPublicBalance, UMBRA_SUPPORTED_TOKENS } from "./umbra";

describe("umbra.shieldPublicBalance", () => {
  beforeEach(() => {
    mockDeposit.mockReset();
    mockGetDeposit.mockClear();
    mockGetUmbraClient.mockClear();
    mockCreateSigner.mockClear();
    mockUpsertUmbra.mockClear();
  });

  function makeWallet() {
    const secretKey = randomBytes(64);
    const encryptedKeypair = encryptSecret(secretKey);
    return {
      userId: 42,
      mainAddress: "11111111111111111111111111111111",
      mainKeypair: encryptedKeypair,
      _rawSecret: secretKey,
    };
  }

  it("decrypts the keypair, builds a signer, and calls the SDK depositor with the right args", async () => {
    mockDeposit.mockResolvedValueOnce({
      queueSignature: "queue-sig-1",
      callbackSignature: "cb-sig-1",
      callbackStatus: "finalized",
    });
    const wallet = makeWallet();

    const result = await shieldPublicBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      transferAmount: 1000n,
    });

    expect(mockCreateSigner).toHaveBeenCalledTimes(1);
    const signerBytesArg = mockCreateSigner.mock.calls[0][0] as Uint8Array;
    expect(Buffer.from(signerBytesArg)).toEqual(wallet._rawSecret);

    expect(mockGetUmbraClient).toHaveBeenCalledTimes(1);
    const clientArgs = mockGetUmbraClient.mock.calls[0][0] as Record<string, unknown>;
    expect(clientArgs.network).toBeDefined();
    expect(typeof clientArgs.rpcUrl).toBe("string");

    expect(mockDeposit).toHaveBeenCalledTimes(1);
    const [recipient, mint, amount] = mockDeposit.mock.calls[0];
    expect(recipient).toBe(wallet.mainAddress);
    expect(mint).toBe(UMBRA_SUPPORTED_TOKENS.USDC);
    expect(amount).toBe(1000n);

    expect(result).toEqual({
      queueSignature: "queue-sig-1",
      callbackSignature: "cb-sig-1",
      callbackStatus: "finalized",
    });
  });

  it("upserts the encrypted balance bookkeeping after a successful shield", async () => {
    mockDeposit.mockResolvedValueOnce({ queueSignature: "sig" });
    const wallet = makeWallet();

    await shieldPublicBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDT,
      transferAmount: 250_000n,
    });

    expect(mockUpsertUmbra).toHaveBeenCalledWith({
      userId: 42,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDT,
      amountDelta: "250000",
    });
  });

  it("propagates SDK errors without writing bookkeeping", async () => {
    mockDeposit.mockRejectedValueOnce(new Error("fee-calculation failed"));
    const wallet = makeWallet();

    await expect(
      shieldPublicBalance({
        userWallet: wallet,
        tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
        transferAmount: 5n,
      }),
    ).rejects.toThrow(/fee-calculation/);

    expect(mockUpsertUmbra).not.toHaveBeenCalled();
  });

  it("returns optional callback fields as undefined when the SDK omits them", async () => {
    mockDeposit.mockResolvedValueOnce({ queueSignature: "only-queue" });
    const wallet = makeWallet();

    const result = await shieldPublicBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      transferAmount: 1n,
    });

    expect(result).toEqual({
      queueSignature: "only-queue",
      callbackSignature: undefined,
      callbackStatus: undefined,
    });
  });

  it("caches the Umbra client per keypair so repeat calls reuse the same signer", async () => {
    mockDeposit.mockResolvedValue({ queueSignature: "sig" });
    const wallet = makeWallet();

    await shieldPublicBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      transferAmount: 1n,
    });
    await shieldPublicBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      transferAmount: 2n,
    });

    expect(mockGetUmbraClient).toHaveBeenCalledTimes(1);
    expect(mockCreateSigner).toHaveBeenCalledTimes(1);
    expect(mockDeposit).toHaveBeenCalledTimes(2);
  });

  it("exposes the well-known mint addresses", () => {
    expect(UMBRA_SUPPORTED_TOKENS.USDC).toMatch(/^[A-Za-z0-9]{32,44}$/);
    expect(UMBRA_SUPPORTED_TOKENS.USDT).toMatch(/^[A-Za-z0-9]{32,44}$/);
  });
});
