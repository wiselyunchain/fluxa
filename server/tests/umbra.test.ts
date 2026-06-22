import { describe, expect, it, vi, beforeEach } from "vitest";
import { randomBytes } from "crypto";

const mocks = vi.hoisted(() => {
  const mockDeposit = vi.fn();
  const mockWithdraw = vi.fn();
  const mockScan = vi.fn();
  return {
    mockDeposit,
    mockWithdraw,
    mockScan,
    mockGetDeposit: vi.fn(() => mockDeposit),
    mockGetWithdraw: vi.fn(() => mockWithdraw),
    mockGetScanner: vi.fn(() => mockScan),
    mockGetUmbraClient: vi.fn(async (args: unknown) => ({ __mock: "client", args })),
    mockCreateSigner: vi.fn(async (bytes: Uint8Array) => ({ __mock: "signer", bytes })),
    mockUpsertUmbra: vi.fn(async () => {}),
    mockInsertUtxo: vi.fn(async () => {}),
    mockInsertUserTxn: vi.fn(async () => ({ id: 1 })),
    mockDecode: vi.fn(() => "FAKE_MINT_ADDRESS"),
  };
});

vi.mock("@umbra-privacy/sdk", () => ({
  getUmbraClient: mocks.mockGetUmbraClient,
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction: mocks.mockGetDeposit,
  getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction: mocks.mockGetWithdraw,
  getClaimableUtxoScannerFunction: mocks.mockGetScanner,
  createSignerFromPrivateKeyBytes: mocks.mockCreateSigner,
}));

vi.mock("@solana/kit", () => ({
  address: (a: string) => a,
  getAddressDecoder: () => ({ decode: mocks.mockDecode }),
}));

vi.mock("../db", () => ({
  upsertUmbraEncryptedBalance: mocks.mockUpsertUmbra,
  insertUmbraUtxoIfNew: mocks.mockInsertUtxo,
  insertUserTransaction: mocks.mockInsertUserTxn,
}));

const KEY_HEX = "0".repeat(64);
process.env.WALLET_ENCRYPTION_KEY = KEY_HEX;

const {
  mockDeposit,
  mockWithdraw,
  mockScan,
  mockGetDeposit,
  mockGetWithdraw,
  mockGetScanner,
  mockGetUmbraClient,
  mockCreateSigner,
  mockUpsertUmbra,
  mockInsertUtxo,
  mockInsertUserTxn,
  mockDecode,
} = mocks;

import { encryptSecret } from "../utils/wallet-crypto";
import {
  shieldPublicBalance,
  unshieldEncryptedBalance,
  scanIncomingUtxos,
  UMBRA_SUPPORTED_TOKENS,
} from "../services/umbra";

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

beforeEach(() => {
  [
    mockDeposit, mockWithdraw, mockScan,
    mockGetDeposit, mockGetWithdraw, mockGetScanner,
    mockGetUmbraClient, mockCreateSigner,
    mockUpsertUmbra, mockInsertUtxo, mockInsertUserTxn,
    mockDecode,
  ].forEach((m) => m.mockReset());
  mockGetDeposit.mockImplementation(() => mockDeposit);
  mockGetWithdraw.mockImplementation(() => mockWithdraw);
  mockGetScanner.mockImplementation(() => mockScan);
  mockGetUmbraClient.mockImplementation(async (args: unknown) => ({ __mock: "client", args }));
  mockCreateSigner.mockImplementation(async (bytes: Uint8Array) => ({ __mock: "signer", bytes }));
  mockUpsertUmbra.mockImplementation(async () => {});
  mockInsertUtxo.mockImplementation(async () => {});
  mockInsertUserTxn.mockImplementation(async () => ({ id: 1 }));
  mockDecode.mockImplementation(() => "FAKE_MINT_ADDRESS");
});

describe("umbra.shieldPublicBalance", () => {
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

    expect(mockDeposit).toHaveBeenCalledWith(wallet.mainAddress, UMBRA_SUPPORTED_TOKENS.USDC, 1000n);

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

  it("exposes the well-known mint addresses", () => {
    expect(UMBRA_SUPPORTED_TOKENS.USDC).toMatch(/^[A-Za-z0-9]{32,44}$/);
    expect(UMBRA_SUPPORTED_TOKENS.USDT).toMatch(/^[A-Za-z0-9]{32,44}$/);
  });
});

describe("umbra.unshieldEncryptedBalance", () => {
  it("calls the SDK withdrawer with recipient defaulting to the user's main address", async () => {
    mockWithdraw.mockResolvedValueOnce({
      queueSignature: "withdraw-sig",
      callbackSignature: "cb-sig",
      callbackStatus: "finalized",
    });
    const wallet = makeWallet();

    const result = await unshieldEncryptedBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      withdrawalAmount: 500n,
    });

    expect(mockWithdraw).toHaveBeenCalledWith(
      wallet.mainAddress,
      UMBRA_SUPPORTED_TOKENS.USDC,
      500n,
    );
    expect(result).toEqual({
      queueSignature: "withdraw-sig",
      callbackSignature: "cb-sig",
      callbackStatus: "finalized",
    });
  });

  it("routes funds to an explicit recipient when provided", async () => {
    mockWithdraw.mockResolvedValueOnce({ queueSignature: "sig" });
    const wallet = makeWallet();

    await unshieldEncryptedBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      withdrawalAmount: 100n,
      recipient: "SomeOtherSolanaAddr",
    });

    expect(mockWithdraw.mock.calls[0][0]).toBe("SomeOtherSolanaAddr");
  });

  it("decrements bookkeeping (negative amountDelta) and writes a withdrawal user_transaction", async () => {
    mockWithdraw.mockResolvedValueOnce({ queueSignature: "sig" });
    const wallet = makeWallet();

    await unshieldEncryptedBalance({
      userWallet: wallet,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      withdrawalAmount: 1234n,
    });

    expect(mockUpsertUmbra).toHaveBeenCalledWith({
      userId: 42,
      tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
      amountDelta: "-1234",
    });

    expect(mockInsertUserTxn).toHaveBeenCalledTimes(1);
    const row = mockInsertUserTxn.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      userId: 42,
      type: "withdrawal",
      status: "confirmed",
      fromChain: "UMBRA",
      toChain: "SOLANA",
      fromAmount: "1234",
      toAmount: "1234",
    });
  });

  it("propagates SDK errors without writing bookkeeping or history", async () => {
    mockWithdraw.mockRejectedValueOnce(new Error("insufficient encrypted balance"));
    const wallet = makeWallet();

    await expect(
      unshieldEncryptedBalance({
        userWallet: wallet,
        tokenMint: UMBRA_SUPPORTED_TOKENS.USDC,
        withdrawalAmount: 1n,
      }),
    ).rejects.toThrow(/insufficient/);

    expect(mockUpsertUmbra).not.toHaveBeenCalled();
    expect(mockInsertUserTxn).not.toHaveBeenCalled();
  });
});

describe("umbra.scanIncomingUtxos", () => {
  const SAMPLE_H1 = { mintAddressLow: 1n, mintAddressHigh: 0n };

  it("calls the SDK scanner with treeIndex/start defaults and returns the empty shape", async () => {
    mockScan.mockResolvedValueOnce({
      selfBurnable: [],
      received: [],
      publicSelfBurnable: [],
      publicReceived: [],
      nextScanStartIndex: 0,
    });
    const wallet = makeWallet();

    const result = await scanIncomingUtxos({ userWallet: wallet });

    expect(mockScan).toHaveBeenCalledWith(0, 0, undefined);
    expect(result).toEqual({
      received: [],
      selfBurnable: [],
      publicReceived: [],
      publicSelfBurnable: [],
      nextScanStartIndex: 0,
    });
    expect(mockInsertUtxo).not.toHaveBeenCalled();
  });

  it("persists every received UTXO with hex commitment + reconstructed mint", async () => {
    mockScan.mockResolvedValueOnce({
      selfBurnable: [],
      received: [
        { amount: 1000n, h1Hash: new Uint8Array([0xaa, 0xbb, 0xcc]), h1Components: SAMPLE_H1 },
        { amount: 250n, h1Hash: new Uint8Array([0x11, 0x22]), h1Components: SAMPLE_H1 },
      ],
      publicSelfBurnable: [],
      publicReceived: [],
      nextScanStartIndex: 42,
    });
    const wallet = makeWallet();

    const result = await scanIncomingUtxos({ userWallet: wallet, treeIndex: 0, startInsertionIndex: 0 });

    expect(mockInsertUtxo).toHaveBeenCalledTimes(2);
    expect(mockInsertUtxo).toHaveBeenNthCalledWith(1, {
      userId: 42,
      commitment: "aabbcc",
      tokenMint: "FAKE_MINT_ADDRESS",
      amount: "1000",
      type: "receiver_claimable",
    });
    expect(mockInsertUtxo).toHaveBeenNthCalledWith(2, {
      userId: 42,
      commitment: "1122",
      tokenMint: "FAKE_MINT_ADDRESS",
      amount: "250",
      type: "receiver_claimable",
    });
    expect(result.received).toHaveLength(2);
    expect(result.nextScanStartIndex).toBe(42);
  });

  it("classifies selfBurnable as self_claimable", async () => {
    mockScan.mockResolvedValueOnce({
      selfBurnable: [
        { amount: 7n, h1Hash: new Uint8Array([0xde, 0xad]), h1Components: SAMPLE_H1 },
      ],
      received: [],
      publicSelfBurnable: [],
      publicReceived: [],
      nextScanStartIndex: 1,
    });
    const wallet = makeWallet();

    await scanIncomingUtxos({ userWallet: wallet });

    expect(mockInsertUtxo).toHaveBeenCalledWith(
      expect.objectContaining({
        commitment: "dead",
        type: "self_claimable",
        amount: "7",
      }),
    );
  });

  it("skips UTXOs with empty h1Hash (no commitment to dedupe on)", async () => {
    mockScan.mockResolvedValueOnce({
      selfBurnable: [],
      received: [{ amount: 5n, h1Components: SAMPLE_H1 }],
      publicSelfBurnable: [],
      publicReceived: [],
      nextScanStartIndex: 0,
    });
    const wallet = makeWallet();

    await scanIncomingUtxos({ userWallet: wallet });
    expect(mockInsertUtxo).not.toHaveBeenCalled();
  });

  it("propagates a custom endInsertionIndex into the scanner call", async () => {
    mockScan.mockResolvedValueOnce({
      selfBurnable: [], received: [], publicSelfBurnable: [], publicReceived: [],
      nextScanStartIndex: 100,
    });
    const wallet = makeWallet();

    await scanIncomingUtxos({ userWallet: wallet, startInsertionIndex: 50, endInsertionIndex: 100 });

    expect(mockScan).toHaveBeenCalledWith(0, 50, 100);
  });
});
