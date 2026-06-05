import {
  getUmbraClient as sdkGetUmbraClient,
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
  createSignerFromPrivateKeyBytes,
} from "@umbra-privacy/sdk";
import { address as toSolanaAddress } from "@solana/kit";
import { ENV } from "./_core/env";
import { decryptSecret } from "./wallet-crypto";
import { upsertUmbraEncryptedBalance } from "./db";
import type { SolanaWallet } from "../drizzle/schema";

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
  userWallet: Pick<SolanaWallet, "userId" | "mainAddress" | "mainKeypair">;
  tokenMint: string;
  transferAmount: bigint;
}): Promise<{
  queueSignature: string;
  callbackSignature?: string;
  callbackStatus?: "finalized" | "pruned" | "timed-out";
}> {
  const secretKey = new Uint8Array(decryptSecret(input.userWallet.mainKeypair));
  const client = await getUmbraClientFromKeypair(secretKey);

  const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({ client });
  const result = await deposit(
    toSolanaAddress(input.userWallet.mainAddress),
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

export const UMBRA_SUPPORTED_TOKENS = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  wSOL: "So11111111111111111111111111111111111111112",
  UMBRA: "PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta",
};
