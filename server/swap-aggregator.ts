import axios from "axios";
import { z } from "zod";

const LIFI_API_BASE = "https://li.quest/v1";

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  fromAmount: string;
  toAmount: string;
  priceImpact: number;
  estimatedTime: number;
  fees: {
    platform: string;
    gas: string;
  };
  route: string;
}

export interface SwapRoute {
  id: string;
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  fromAmount: string;
  toAmount: string;
  transactionRequest?: {
    to: string;
    from: string;
    data: string;
    value: string;
    gasPrice: string;
    gasLimit: string;
  };
}

/**
 * Get swap quote from LI.FI API
 */
export async function getSwapQuote(params: {
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  fromAmount: string;
  userAddress: string;
}): Promise<SwapQuote> {
  try {
    // Map chain names to LI.FI chain IDs
    const chainMap: Record<string, number> = {
      solana: 501,
      base: 8453,
      bsc: 56,
      ton: 607,
      avalanche: 43114,
    };

    const fromChainId = chainMap[params.fromChain];
    const toChainId = chainMap[params.toChain];

    if (!fromChainId || !toChainId) {
      throw new Error(`Unsupported chain: ${params.fromChain} or ${params.toChain}`);
    }

    // For cross-chain swaps, use LI.FI quote endpoint
    const response = await axios.get(`${LIFI_API_BASE}/quote`, {
      params: {
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        userAddress: params.userAddress,
        slippage: 0.03, // 3% slippage tolerance
      },
      timeout: 10000,
    });

    if (!response.data.action) {
      throw new Error("Invalid quote response from LI.FI");
    }

    const action = response.data.action;
    const estimate = response.data.estimate;

    return {
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromAmount: params.fromAmount,
      toAmount: estimate.toAmount || "0",
      priceImpact: parseFloat(estimate.slippage || "0.03"),
      estimatedTime: estimate.executionDuration || 0,
      fees: {
        platform: estimate.feeCosts?.[0]?.amount || "0",
        gas: estimate.gasCosts?.[0]?.amount || "0",
      },
      route: JSON.stringify(response.data),
    };
  } catch (error: any) {
    console.error("[LI.FI] Quote error:", error.message);
    // Return mock quote if API fails
    return getMockSwapQuote(params);
  }
}

/**
 * Get swap route for execution
 */
export async function getSwapRoute(params: {
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  fromAmount: string;
  userAddress: string;
}): Promise<SwapRoute> {
  try {
    const quote = await getSwapQuote(params);

    return {
      id: `route_${Date.now()}`,
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromAmount: params.fromAmount,
      toAmount: quote.toAmount,
      transactionRequest: {
        to: "0x0000000000000000000000000000000000000000", // Mock address
        from: params.userAddress,
        data: "0x", // Mock data
        value: "0",
        gasPrice: "1000000000",
        gasLimit: "500000",
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to get swap route: ${error.message}`);
  }
}

/**
 * Execute swap (returns transaction hash for monitoring)
 */
export async function executeSwap(params: {
  route: SwapRoute;
  userAddress: string;
  slippage: number;
}): Promise<{
  transactionHash: string;
  status: "pending" | "success" | "failed";
  estimatedTime: number;
}> {
  try {
    // In production, this would submit the transaction to the blockchain
    // For now, return a mock transaction hash
    const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

    return {
      transactionHash: mockTxHash,
      status: "pending",
      estimatedTime: 30, // seconds
    };
  } catch (error: any) {
    throw new Error(`Failed to execute swap: ${error.message}`);
  }
}

/**
 * Get swap status
 */
export async function getSwapStatus(transactionHash: string): Promise<{
  status: "pending" | "success" | "failed";
  fromAmount: string;
  toAmount: string;
  timestamp: number;
}> {
  try {
    // In production, query blockchain for transaction status
    // For now, return mock status
    return {
      status: "success",
      fromAmount: "1000000",
      toAmount: "950000",
      timestamp: Date.now(),
    };
  } catch (error: any) {
    throw new Error(`Failed to get swap status: ${error.message}`);
  }
}

/**
 * Get available tokens for a chain
 */
export async function getChainTokens(chain: string): Promise<
  Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI: string;
  }>
> {
  try {
    const chainMap: Record<string, number> = {
      solana: 501,
      base: 8453,
      bsc: 56,
      ton: 607,
      avalanche: 43114,
    };

    const chainId = chainMap[chain];
    if (!chainId) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const response = await axios.get(`${LIFI_API_BASE}/tokens?chains=${chainId}`, {
      timeout: 10000,
    });

    return response.data.tokens[chainId] || [];
  } catch (error: any) {
    console.error("[LI.FI] Get tokens error:", error.message);
    // Return mock tokens if API fails
    return getMockTokens(chain);
  }
}

/**
 * Mock swap quote for testing/fallback
 */
function getMockSwapQuote(params: {
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  fromAmount: string;
  userAddress: string;
}): SwapQuote {
  // Mock exchange rates
  const rates: Record<string, number> = {
    "USDT-USDC": 1.0,
    "USDT-SOL": 0.0001,
    "SOL-USDT": 10000,
    "ETH-USDT": 2000,
    "USDT-ETH": 0.0005,
  };

  const rateKey = `${params.fromToken}-${params.toToken}`;
  const rate = rates[rateKey] || 1.0;
  const toAmount = (parseFloat(params.fromAmount) * rate).toString();

  return {
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromChain: params.fromChain,
    toChain: params.toChain,
    fromAmount: params.fromAmount,
    toAmount,
    priceImpact: 0.02, // 2% mock impact
    estimatedTime: 30,
    fees: {
      platform: (parseFloat(toAmount) * 0.001).toString(), // 0.1% platform fee
      gas: "0.001",
    },
    route: "mock-route",
  };
}

/**
 * Mock tokens for testing/fallback
 */
function getMockTokens(
  chain: string
): Array<{
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}> {
  const mockTokens: Record<
    string,
    Array<{
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoURI: string;
    }>
  > = {
    solana: [
      {
        address: "EPjFWaLb3odcccccccccccccccccccccccccccccccc",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWaLb3odcccccccccccccccccccccccccccccccc/logo.png",
      },
      {
        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenErt",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenErt/logo.svg",
      },
      {
        address: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      },
    ],
    base: [
      {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
      },
      {
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/uniswap/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
      },
    ],
    bsc: [
      {
        address: "0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 18,
        logoURI: "https://raw.githubusercontent.com/uniswap/assets/master/blockchains/smartchain/assets/0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d/logo.png",
      },
    ],
    ton: [
      {
        address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCmaTMUqKaLBFgQ",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/uniswap/assets/master/blockchains/ton/assets/EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCmaTMUqKaLBFgQ/logo.png",
      },
    ],
    avalanche: [
      {
        address: "0xA7D8d9ef8D0231B7734519e4937eb1D1D998352C",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/uniswap/assets/master/blockchains/avalanchec/assets/0xA7D8d9ef8D0231B7734519e4937eb1D1D998352C/logo.png",
      },
    ],
  };

  return mockTokens[chain] || [];
}
