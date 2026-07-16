import { TRPCError } from "@trpc/server";
import {
  getUmbraClient as sdkGetUmbraClient,
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
  getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction,
  getClaimableUtxoScannerFunction,
  createSignerFromPrivateKeyBytes,
  getUmbraRelayer,
} from "@umbra-privacy/sdk";
import { address as toSolanaAddress, getAddressDecoder } from "@solana/kit";
import { ENV } from "../_core/env";
import { decryptSecret } from "../utils/wallet-crypto";
import {
  upsertUmbraEncryptedBalance,
  insertUmbraUtxoIfNew,
  insertUserTransaction,
  deleteUmbraUtxo,
  updateUmbraScanIndex,
  getUmbraEncryptedBalance,
} from "../db";
import type { LinkedWallet } from "../../drizzle/schema";
import {
  getCreateReceiverClaimableUtxoFromEncryptedBalanceProver,
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
} from "@umbra-privacy/web-zk-prover";
import {
  getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";

type UmbraNetwork = "mainnet" | "devnet" | "localnet";

function resolveNetwork(): UmbraNetwork {
  const v = (ENV.solanaNetwork ?? "").toLowerCase();
  if (v === "mainnet" || v === "mainnet-beta") return "mainnet";
  if (v === "localnet" || v === "localhost") return "localnet";
  return "devnet";
}

const clientCache = new Map<string, Promise<Awaited<ReturnType<typeof sdkGetUmbraClient>>>>();

async function getUmbraClientFromKeypair(secretKey: Uint8Array) {
  const cacheKey = Buffer.from(secretKey).toString("base64");
  let entry = clientCache.get(cacheKey);
  if (!entry) {
    entry = (async () => {
      const signer = await createSignerFromPrivateKeyBytes(secretKey);
      return sdkGetUmbraClient({
        signer,
        network: resolveNetwork(),
        rpcUrl: ENV.solanaRpcUrl,
        rpcSubscriptionsUrl: ENV.solanaRpcSubscriptionsUrl,
        indexerApiEndpoint: ENV.umbraIndexerEndpoint || undefined,
      });
    })();
    clientCache.set(cacheKey, entry);
  }
  return entry;
}

/**
 * Decrypt the user's main Solana keypair and ask Umbra to shield `transferAmount`
 * of `tokenMint` from that public balance into the user's encrypted balance.
 *
 * Updates `umbra_encrypted_balances` bookkeeping on success.
 */
export async function shieldPublicBalance(input: {
  userWallet: Pick<LinkedWallet, "userId" | "address" | "privateKey">;
  tokenMint: string;
  transferAmount: bigint;
}): Promise<{
  queueSignature: string;
  callbackSignature?: string;
  callbackStatus?: "finalized" | "pruned" | "timed-out";
}> {
  const sk = input.userWallet.privateKey;
  if (!sk) throw new Error("No private key available for Umbra operation");
  const secretKey = new Uint8Array(decryptSecret(sk));
  const client = await getUmbraClientFromKeypair(secretKey);

  const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({ client });
  const result = await deposit(
    toSolanaAddress(input.userWallet.address),
    toSolanaAddress(input.tokenMint),
    input.transferAmount as unknown as never,
  );

  await upsertUmbraEncryptedBalance({
    userId: input.userWallet.userId,
    tokenMint: input.tokenMint,
    amountDelta: input.transferAmount.toString(),
  });

  return {
    queueSignature: String(result.queueSignature),
    callbackSignature: result.callbackSignature ? String(result.callbackSignature) : undefined,
    callbackStatus: result.callbackStatus,
  };
}

/**
 * Move tokens from the user's encrypted balance back into their public wallet.
 * Inverse of `shieldPublicBalance` — does not require a ZK prover.
 *
 * Decrements `umbra_encrypted_balances` bookkeeping and writes a `withdrawal`
 * row to `user_transactions` (with `fromChain = "UMBRA"`) so it shows up in
 * the user-facing history.
 */
export async function unshieldEncryptedBalance(input: {
  userWallet: Pick<LinkedWallet, "userId" | "address" | "privateKey">;
  tokenMint: string;
  withdrawalAmount: bigint;
  recipient?: string; // defaults to user's main address
}): Promise<{
  queueSignature: string;
  callbackSignature?: string;
  callbackStatus?: "finalized" | "pruned" | "timed-out";
}> {
  const encryptedBalanceRow = await getUmbraEncryptedBalance(input.userWallet.userId, input.tokenMint);
  const currentBalance = encryptedBalanceRow ? BigInt(encryptedBalanceRow.lastKnownAmount) : BigInt(0);
  if (currentBalance < input.withdrawalAmount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Insufficient encrypted balance. Required: ${input.withdrawalAmount.toString()}, Available: ${currentBalance.toString()}`,
    });
  }

  const sk = input.userWallet.privateKey;
  if (!sk) throw new Error("No private key available for Umbra operation");
  const secretKey = new Uint8Array(decryptSecret(sk));
  const client = await getUmbraClientFromKeypair(secretKey);
  const recipient = input.recipient ?? input.userWallet.address;

  const withdraw = getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({ client });
  const result = await withdraw(
    toSolanaAddress(recipient),
    toSolanaAddress(input.tokenMint),
    input.withdrawalAmount as unknown as never,
  );

  await upsertUmbraEncryptedBalance({
    userId: input.userWallet.userId,
    tokenMint: input.tokenMint,
    amountDelta: `-${input.withdrawalAmount.toString()}`,
  });

  await insertUserTransaction({
    userId: input.userWallet.userId,
    type: "withdrawal",
    status: "confirmed",
    fromChain: "UMBRA",
    toChain: "SOLANA",
    fromToken: input.tokenMint,
    toToken: input.tokenMint,
    fromAmount: input.withdrawalAmount.toString(),
    toAmount: input.withdrawalAmount.toString(),
    confirmedAt: new Date(),
  });

  return {
    queueSignature: String(result.queueSignature),
    callbackSignature: result.callbackSignature ? String(result.callbackSignature) : undefined,
    callbackStatus: result.callbackStatus,
  };
}

/**
 * Creates a receiver-claimable UTXO directly from the user's encrypted balance.
 * Used for sending funds anonymously to another Umbra user.
 * 
 * Decrements `umbra_encrypted_balances` and writes a `transfer` row to `user_transactions`.
 */
export async function createReceiverClaimableUtxo(input: {
  userWallet: Pick<LinkedWallet, "userId" | "privateKey">;
  tokenMint: string;
  transferAmount: bigint;
  receiverStealthPublicKey: string;
}): Promise<{
  queueSignature: string;
  callbackSignature?: string;
  callbackStatus?: "finalized" | "pruned" | "timed-out";
}> {
  const encryptedBalanceRow = await getUmbraEncryptedBalance(input.userWallet.userId, input.tokenMint);
  const currentBalance = encryptedBalanceRow ? BigInt(encryptedBalanceRow.lastKnownAmount) : BigInt(0);
  if (currentBalance < input.transferAmount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Insufficient encrypted balance. Required: ${input.transferAmount.toString()}, Available: ${currentBalance.toString()}`,
    });
  }

  console.log("createReceiverClaimableUtxo started");
  const sk = input.userWallet.privateKey;
  if (!sk) throw new Error("No private key available for Umbra operation");
  const secretKey = new Uint8Array(decryptSecret(sk));
  console.log("Secret key decrypted");
  const client = await getUmbraClientFromKeypair(secretKey);
  console.log("Client created");

  const creator = getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
    { client },
    { zkProver: getCreateReceiverClaimableUtxoFromEncryptedBalanceProver() }
  );
  console.log("Creator function initialized");

  try {
    const result = await creator({
      destinationAddress: toSolanaAddress(input.receiverStealthPublicKey),
      mint: toSolanaAddress(input.tokenMint),
      amount: input.transferAmount,
    } as any);
    console.log("Creator result", result);

    await upsertUmbraEncryptedBalance({
      userId: input.userWallet.userId,
      tokenMint: input.tokenMint,
      amountDelta: `-${input.transferAmount.toString()}`,
    });

    await insertUserTransaction({
      userId: input.userWallet.userId,
      type: "transfer",
      status: "confirmed",
      fromChain: "UMBRA",
      toChain: "UMBRA",
      fromToken: input.tokenMint,
      toToken: input.tokenMint,
      fromAmount: input.transferAmount.toString(),
      toAmount: input.transferAmount.toString(),
      toAddress: input.receiverStealthPublicKey,
      confirmedAt: new Date(),
    });

    return {
      queueSignature: String(result.queueSignature),
      callbackSignature: result.callbackSignature ? String(result.callbackSignature) : undefined,
      callbackStatus: result.callbackStatus,
    };
  } catch (error: any) {
    console.error("Error in createReceiverClaimableUtxo:", error);
    if (error.cause?.message?.includes("Receiver is not registered")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The recipient's address is not registered on Umbra.",
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create anonymous transfer UTXO.",
      cause: error,
    });
  }
}

/**
 * Claims a receiver-claimable UTXO into the user's encrypted balance.
 * Uses a ZK prover to keep the claim process private.
 * 
 * Increments `umbra_encrypted_balances` and removes the UTXO from `umbra_utxos`.
 */
export async function claimUtxoToEncryptedBalance(input: {
  userWallet: Pick<LinkedWallet, "userId" | "privateKey">;
  tokenMint: string;
  commitment: string;
  amount: bigint;
}): Promise<{
  queueSignature: string;
  callbackSignature?: string;
  callbackStatus?: "finalized" | "pruned" | "timed-out";
}> {
  const sk = input.userWallet.privateKey;
  if (!sk) throw new Error("No private key available for Umbra operation");
  const secretKey = new Uint8Array(decryptSecret(sk));
  const client = await getUmbraClientFromKeypair(secretKey);

  const claimer = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
    { client },
    { 
      zkProver: getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver() as any,
      fetchBatchMerkleProof: client.fetchMerkleProof as any,
      relayer: getUmbraRelayer({ apiEndpoint: ENV.umbraRelayerEndpoint }) as any
    }
  );

  // We need to pass the actual UTXO object to the claimer.
  // We'll rescan to get it.
  const scanner = getClaimableUtxoScannerFunction({ client });
  const scanResult = await scanner(0 as any, 0 as any, undefined);
  const allUtxos = [
    ...(scanResult.received ?? []),
    ...(scanResult.publicReceived ?? []),
    ...(scanResult.selfBurnable ?? []),
    ...(scanResult.publicSelfBurnable ?? [])
  ];
  const utxoToClaim = allUtxos.find(
    (u: any) => u.h1Hash && bytesToHex(u.h1Hash) === input.commitment
  );
  
  if (!utxoToClaim) {
    throw new Error("UTXO not found or not claimable by this user");
  }

  if (BigInt(utxoToClaim.amount) !== input.amount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "UTXO amount mismatch.",
    });
  }

  if (!utxoToClaim.h1Components) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "UTXO is missing H1 components for mint verification.",
    });
  }
  const reconstructedMint = joinLowHighToAddress(
    utxoToClaim.h1Components.mintAddressLow,
    utxoToClaim.h1Components.mintAddressHigh
  );
  if (reconstructedMint !== input.tokenMint) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "UTXO token mint mismatch.",
    });
  }

  const result = await claimer([utxoToClaim] as any);

  await upsertUmbraEncryptedBalance({
    userId: input.userWallet.userId,
    tokenMint: input.tokenMint,
    amountDelta: input.amount.toString(),
  });

  // Remove the claimed UTXO from the DB
  await deleteUmbraUtxo(input.userWallet.userId, input.commitment);

  await insertUserTransaction({
    userId: input.userWallet.userId,
    type: "receive",
    status: "confirmed",
    fromChain: "UMBRA",
    toChain: "UMBRA",
    fromToken: input.tokenMint,
    toToken: input.tokenMint,
    fromAmount: input.amount.toString(),
    toAmount: input.amount.toString(),
    confirmedAt: new Date(),
  });

  return {
    queueSignature: String((result as any).transactionSignature || (result as any).signature || ""),
    callbackSignature: undefined,
    callbackStatus: undefined,
  };
}

/**
 * Reconstruct a Solana address from the (mintAddressLow, mintAddressHigh) U128
 * pair that the Umbra SDK ships inside H1 components. Inverse of the SDK's
 * `splitAddressToLowHigh`: bytes 0-15 = low (LE), bytes 16-31 = high (LE).
 */
function joinLowHighToAddress(low: bigint | number | string, high: bigint | number | string): string {
  const MASK = BigInt(0xff);
  const SHIFT = BigInt(8);
  const bytes = new Uint8Array(32);
  let v = BigInt(low);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number(v & MASK);
    v >>= SHIFT;
  }
  v = BigInt(high);
  for (let i = 0; i < 16; i++) {
    bytes[16 + i] = Number(v & MASK);
    v >>= SHIFT;
  }
  return getAddressDecoder().decode(bytes) as unknown as string;
}

function bytesToHex(bytes: Uint8Array | readonly number[]): string {
  const arr = Array.from(bytes as Iterable<number>);
  return arr.map((b) => (b & 0xff).toString(16).padStart(2, "0")).join("");
}

interface PersistedUtxo {
  commitment: string;
  tokenMint: string;
  amount: string;
  type: "self_claimable" | "receiver_claimable";
}

/**
 * Scan the Umbra mixer tree for UTXOs decryptable with the user's keys, persist
 * the receiver-claimable ones into `umbra_utxos` (idempotent on commitment), and
 * return both groups so the UI can render them. The actual claim step requires
 * a ZK prover and is gated until that's wired up.
 */
export async function scanIncomingUtxos(input: {
  userWallet: Pick<LinkedWallet, "userId" | "privateKey" | "umbraScanIndex">;
  treeIndex?: number;
  startInsertionIndex?: number;
  endInsertionIndex?: number;
}): Promise<{
  received: PersistedUtxo[];
  selfBurnable: PersistedUtxo[];
  publicReceived: PersistedUtxo[];
  publicSelfBurnable: PersistedUtxo[];
  nextScanStartIndex: number;
}> {
  const sk = input.userWallet.privateKey;
  if (!sk) throw new Error("No private key available for Umbra operation");
  const secretKey = new Uint8Array(decryptSecret(sk));
  const client = await getUmbraClientFromKeypair(secretKey);
  const scanner = getClaimableUtxoScannerFunction({ client });

  const treeIndex = BigInt(input.treeIndex ?? 0) as unknown as never;
  const startIndex = BigInt(input.startInsertionIndex ?? input.userWallet.umbraScanIndex ?? 0) as unknown as never;
  const endIndex = input.endInsertionIndex !== undefined ? BigInt(input.endInsertionIndex) as unknown as never : undefined;

  let result: any = {};
  try {
    result = await scanner(treeIndex, startIndex, endIndex);
  } catch (err: any) {
    console.warn("Umbra indexer scan failed, returning empty results. Error:", err?.message || err);
    result = {
      received: [],
      selfBurnable: [],
      publicReceived: [],
      publicSelfBurnable: [],
      nextScanStartIndex: startIndex,
    };
  }

  const toPersisted = (
    utxo: {
      amount: bigint;
      h1Hash?: Uint8Array | readonly number[];
      h1Components?: { mintAddressLow: bigint; mintAddressHigh: bigint };
    },
    type: PersistedUtxo["type"],
  ): PersistedUtxo => {
    const mint = utxo.h1Components
      ? joinLowHighToAddress(utxo.h1Components.mintAddressLow, utxo.h1Components.mintAddressHigh)
      : "UNKNOWN";
    const commitment = utxo.h1Hash ? bytesToHex(utxo.h1Hash) : "";
    return {
      commitment,
      tokenMint: mint,
      amount: utxo.amount.toString(),
      type,
    };
  };

  const received = (result.received ?? []).map((u: any) => toPersisted(u, "receiver_claimable"));
  const selfBurnable = (result.selfBurnable ?? []).map((u: any) => toPersisted(u, "self_claimable"));
  const publicReceived = (result.publicReceived ?? []).map((u: any) => toPersisted(u, "receiver_claimable"));
  const publicSelfBurnable = (result.publicSelfBurnable ?? []).map((u: any) =>
    toPersisted(u, "self_claimable"),
  );

  // Persist every UTXO that is claimable by this user, idempotently.
  for (const utxo of [...received, ...publicReceived, ...selfBurnable, ...publicSelfBurnable]) {
    if (!utxo.commitment) continue;
    await insertUmbraUtxoIfNew({
      userId: input.userWallet.userId,
      commitment: utxo.commitment,
      tokenMint: utxo.tokenMint,
      amount: utxo.amount,
      type: utxo.type,
    });
  }

  const nextScanStartIndex = Number(result.nextScanStartIndex ?? startIndex);
  if (nextScanStartIndex > (input.userWallet.umbraScanIndex ?? 0)) {
    await updateUmbraScanIndex(input.userWallet.userId, nextScanStartIndex);
  }

  return {
    received,
    selfBurnable,
    publicReceived,
    publicSelfBurnable,
    nextScanStartIndex,
  };
}

export const UMBRA_SUPPORTED_TOKENS = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  wSOL: "So11111111111111111111111111111111111111112",
  UMBRA: "PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta",
};

export async function registerWalletOnUmbra(wallet: Pick<LinkedWallet, "userId" | "address" | "privateKey">): Promise<void> {
  const sk = wallet.privateKey;
  if (!sk) throw new Error("No private key available for Umbra operation");
  const secretKey = new Uint8Array(decryptSecret(sk));

  const network = resolveNetwork();
  
  if (network !== "mainnet") {
    try {
      const { Connection, PublicKey } = await import("@solana/web3.js");
      const connection = new Connection(ENV.solanaRpcUrl, "confirmed");
      const pubkey = new PublicKey(wallet.address);
      const balance = await connection.getBalance(pubkey);
      if (balance < 500_000_000) {
        console.log(`[Umbra registration] Balance low (${balance} lamports), requesting airdrop for ${wallet.address}`);
        const signature = await connection.requestAirdrop(pubkey, 1_000_000_000);
        const latestBlockHash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature
        }, "confirmed");
        console.log(`[Umbra registration] Airdrop successful`);
      }
    } catch (err) {
      console.warn("[Umbra registration] Airdrop failed:", err);
    }
  }

  const client = await getUmbraClientFromKeypair(secretKey);
  const register = getUserRegistrationFunction({ client });
  await register({
    destinationAddress: wallet.address,
  } as any);
  console.log(`[Umbra registration] Wallet ${wallet.address} registered successfully`);
}
