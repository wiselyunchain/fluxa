import { useMemo } from "react";
import { http, createConfig } from "wagmi";
import { mainnet, base, arbitrum, bsc, polygon, avalanche, optimism } from "wagmi/chains";
import { metaMask, walletConnect } from "wagmi/connectors";
import { WagmiProvider, useAccount, useConnect, useDisconnect } from "wagmi";

const WC_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "fluxa-default-project-id";

export const wagmiConfig = createConfig({
  chains: [mainnet, base, arbitrum, bsc, polygon, avalanche, optimism],
  connectors: [
    metaMask(),
    walletConnect({ projectId: WC_PROJECT_ID }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [avalanche.id]: http(),
    [optimism.id]: http(),
  },
});

export function EvmWalletProvider({ children }: { children: React.ReactNode }) {
  const config = useMemo(() => wagmiConfig, []);
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}

export function useEvmWalletState() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();

  return {
    address: address ?? null,
    connected: isConnected,
    connecting: isPending,
    connectAsync,
    disconnectAsync,
    connectors,
  };
}
