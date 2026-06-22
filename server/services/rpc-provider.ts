import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { ethers } from "ethers";

export type ChainType = "solana" | "base" | "bsc" | "ton" | "avalanche";

export interface RpcConfig {
  solana: string;
  base: string;
  bsc: string;
  ton: string;
  avalanche: string;
}

// RPC endpoints configuration
const RPC_ENDPOINTS: RpcConfig = {
  solana: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  base: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  bsc: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
  ton: process.env.TON_RPC_URL || "https://toncenter.com/api/v2/jsonRPC",
  avalanche: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
};

/**
 * Get Solana wallet balance
 */
export async function getSolanaBalance(walletAddress: string): Promise<string> {
  try {
    const connection = new Connection(RPC_ENDPOINTS.solana, "confirmed");
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);

    // Convert lamports to SOL (1 SOL = 1 billion lamports)
    return (balance / 1_000_000_000).toString();
  } catch (error: any) {
    console.error("[RPC] Solana balance error:", error.message);
    return "0";
  }
}

/**
 * Get Ethereum-compatible wallet balance (Base, BSC, Avalanche)
 */
export async function getEthereumBalance(
  walletAddress: string,
  chain: "base" | "bsc" | "avalanche"
): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chain]);
    const balance = await provider.getBalance(walletAddress);

    // Convert wei to ether
    return ethers.formatEther(balance);
  } catch (error: any) {
    console.error(`[RPC] ${chain} balance error:`, error.message);
    return "0";
  }
}

/**
 * Get TON wallet balance
 */
export async function getTonBalance(walletAddress: string): Promise<string> {
  try {
    const response = await axios.post(RPC_ENDPOINTS.ton, {
      jsonrpc: "2.0",
      id: 1,
      method: "getAddressInformation",
      params: {
        address: walletAddress,
      },
    });

    if (response.data.result?.account_state?.balance) {
      // TON balance is in nanoton (1 TON = 1 billion nanoton)
      const balance = response.data.result.account_state.balance;
      return (balance / 1_000_000_000).toString();
    }

    return "0";
  } catch (error: any) {
    console.error("[RPC] TON balance error:", error.message);
    return "0";
  }
}

/**
 * Get token balance for EVM chains
 */
export async function getTokenBalance(
  walletAddress: string,
  tokenAddress: string,
  chain: "base" | "bsc" | "avalanche"
): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chain]);

    // ERC20 ABI for balanceOf function
    const erc20Abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();

    // Convert to human-readable format
    return ethers.formatUnits(balance, decimals);
  } catch (error: any) {
    console.error(`[RPC] Token balance error on ${chain}:`, error.message);
    return "0";
  }
}

/**
 * Get Solana token balance (SPL tokens)
 */
export async function getSolanaTokenBalance(
  walletAddress: string,
  tokenMint: string
): Promise<string> {
  try {
    const connection = new Connection(RPC_ENDPOINTS.solana, "confirmed");
    const publicKey = new PublicKey(walletAddress);
    const mintPublicKey = new PublicKey(tokenMint);

    // Get token accounts for this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      mint: mintPublicKey,
    });

    if (tokenAccounts.value.length === 0) {
      return "0";
    }

    // Get balance from first token account
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance?.toString() || "0";
  } catch (error: any) {
    console.error("[RPC] Solana token balance error:", error.message);
    return "0";
  }
}

/**
 * Get wallet balance for any chain
 */
export async function getWalletBalance(
  walletAddress: string,
  chain: ChainType
): Promise<string> {
  try {
    switch (chain) {
      case "solana":
        return await getSolanaBalance(walletAddress);
      case "base":
      case "bsc":
      case "avalanche":
        return await getEthereumBalance(walletAddress, chain);
      case "ton":
        return await getTonBalance(walletAddress);
      default:
        return "0";
    }
  } catch (error: any) {
    console.error(`[RPC] Error getting balance for ${chain}:`, error.message);
    return "0";
  }
}

/**
 * Get gas price for transaction estimation
 */
export async function getGasPrice(chain: ChainType): Promise<string> {
  try {
    switch (chain) {
      case "solana":
        const solanaConnection = new Connection(RPC_ENDPOINTS.solana, "confirmed");
        const fees = await solanaConnection.getRecentBlockhash();
        return fees.feeCalculator.lamportsPerSignature.toString();

      case "base":
      case "bsc":
      case "avalanche":
        const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chain]);
        const feeData = await provider.getFeeData();
        return feeData.gasPrice?.toString() || "0";

      case "ton":
        // TON gas prices are fixed
        return "0.000000004"; // 4 nanoton per gas unit

      default:
        return "0";
    }
  } catch (error: any) {
    console.error(`[RPC] Error getting gas price for ${chain}:`, error.message);
    return "0";
  }
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  txHash: string,
  chain: ChainType
): Promise<{
  status: "pending" | "success" | "failed";
  confirmations: number;
  blockNumber?: number;
}> {
  try {
    switch (chain) {
      case "solana":
        const solanaConnection = new Connection(RPC_ENDPOINTS.solana, "confirmed");
        const signature = txHash;
        const tx = await solanaConnection.getSignatureStatus(signature);

        if (!tx.value) {
          return { status: "pending", confirmations: 0 };
        }

        if (tx.value.err) {
          return { status: "failed", confirmations: tx.value.confirmations || 0 };
        }

        return {
          status: tx.value.confirmationStatus === "finalized" ? "success" : "pending",
          confirmations: tx.value.confirmations || 0,
        };

      case "base":
      case "bsc":
      case "avalanche":
        const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chain]);
        const receipt = await provider.getTransactionReceipt(txHash);

        if (!receipt) {
          return { status: "pending", confirmations: 0 };
        }

        const currentBlock = await provider.getBlockNumber();
        const confirmations = currentBlock - receipt.blockNumber;

        return {
          status: receipt.status === 1 ? "success" : "failed",
          confirmations,
          blockNumber: receipt.blockNumber,
        };

      case "ton":
        // TON transaction status check
        const tonResponse = await axios.post(RPC_ENDPOINTS.ton, {
          jsonrpc: "2.0",
          id: 1,
          method: "getTransactionByHash",
          params: { hash: txHash },
        });

        if (tonResponse.data.result) {
          return {
            status: "success",
            confirmations: tonResponse.data.result.confirmations || 0,
          };
        }

        return { status: "pending", confirmations: 0 };

      default:
        return { status: "pending", confirmations: 0 };
    }
  } catch (error: any) {
    console.error(`[RPC] Error getting transaction status for ${chain}:`, error.message);
    return { status: "pending", confirmations: 0 };
  }
}

/**
 * Estimate gas for transaction
 */
export async function estimateGas(
  from: string,
  to: string,
  value: string,
  chain: ChainType
): Promise<string> {
  try {
    switch (chain) {
      case "solana":
        // Solana transactions have fixed size
        return "5000"; // lamports

      case "base":
      case "bsc":
      case "avalanche":
        const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chain]);
        const gasEstimate = await provider.estimateGas({
          from,
          to,
          value: ethers.parseEther(value),
        });
        return gasEstimate.toString();

      case "ton":
        // TON gas estimation
        return "10000000"; // nanoton

      default:
        return "0";
    }
  } catch (error: any) {
    console.error(`[RPC] Error estimating gas for ${chain}:`, error.message);
    return "0";
  }
}
