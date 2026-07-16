export type ChainId = "solana" | "evm" | "ton" | "near" | "bitcoin";

export interface ConnectedWallet {
  chain: ChainId;
  address: string;
  isExternal: true;
  walletName: string;
}

export interface WalletContextValue {
  connected: Record<ChainId, ConnectedWallet | null>;
  connect: (chain: ChainId) => Promise<ConnectedWallet | null>;
  disconnect: (chain: ChainId) => void;
  disconnectAll: () => void;
  isConnecting: Record<ChainId, boolean>;
  isReady: boolean;
  getActiveWallet: (chain: ChainId) => ConnectedWallet | null;
}
