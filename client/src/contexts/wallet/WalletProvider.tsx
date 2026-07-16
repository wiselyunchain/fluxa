import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SolanaWalletProvider, useSolanaWalletState } from "./SolanaWalletProvider";
import { EvmWalletProvider, useEvmWalletState } from "./EvmWalletProvider";
import { TonWalletProvider, useTonWalletState } from "./TonWalletProvider";
import { useNearWalletStateWithProvider } from "./NearWalletProvider";
import { trpc } from "@/lib/trpc";
import type { ChainId, ConnectedWallet, WalletContextValue } from "./types";

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

function WalletProviderInner({ children }: { children: React.ReactNode }) {
  const solana = useSolanaWalletState();
  const evm = useEvmWalletState();
  const ton = useTonWalletState();
  const { state: near } = useNearWalletStateWithProvider();

  // Persist each external connection to the backend via tRPC linkWallet.
  const linkMutation = trpc.auth.linkWallet.useMutation();

  useEffect(() => {
    if (solana.address && solana.connected) {
      linkMutation.mutate({ chain: "solana", address: solana.address });
    }
  }, [solana.address]);

  useEffect(() => {
    if (evm.address && evm.connected) {
      linkMutation.mutate({ chain: "evm", address: evm.address });
    }
  }, [evm.address]);

  useEffect(() => {
    if (ton.address && ton.connected) {
      linkMutation.mutate({ chain: "ton", address: ton.address });
    }
  }, [ton.address]);

  useEffect(() => {
    if (near.address && near.connected) {
      linkMutation.mutate({ chain: "near", address: near.address });
    }
  }, [near.address]);

  const connected: Record<ChainId, ConnectedWallet | null> = {
    solana: solana.address && solana.connected
      ? { chain: "solana", address: solana.address, isExternal: true, walletName: solana.walletName ?? "phantom" }
      : null,
    evm: evm.address && evm.connected
      ? { chain: "evm", address: evm.address, isExternal: true, walletName: "metamask" }
      : null,
    ton: ton.address && ton.connected
      ? { chain: "ton", address: ton.address, isExternal: true, walletName: "tonconnect" }
      : null,
    near: near.address && near.connected
      ? { chain: "near", address: near.address, isExternal: true, walletName: "near-selector" }
      : null,
    bitcoin: null,
  };

  const isConnecting: Record<ChainId, boolean> = {
    solana: solana.connecting,
    evm: evm.connecting,
    ton: ton.connecting,
    near: near.connecting,
    bitcoin: false,
  };

  const connect = async (chain: ChainId): Promise<ConnectedWallet | null> => {
    try {
      switch (chain) {
        case "solana":
          await solana.rawConnect();
          return null;
        case "evm":
          // Try MetaMask first (first connector), fall back to others
          if (evm.connectors.length > 0) {
            await evm.connectAsync({ connector: evm.connectors[0] });
          }
          return null;
        case "ton":
          ton.openModal();
          return null;
        case "near":
          near.openModal();
          return null;
        case "bitcoin":
          // Bitcoin fallback: WalletConnectModal would live here.
          console.warn(
            "[WalletProvider] Bitcoin connection is not yet wired. Use WalletConnect fallback when available."
          );
          return null;
      }
    } catch (err) {
      console.error(`[WalletProvider] failed to connect ${chain}:`, err);
    }
    return null;
  };

  const disconnect = (chain: ChainId) => {
    switch (chain) {
      case "solana":
        solana.disconnect();
        break;
      case "evm":
        evm.disconnectAsync();
        break;
      case "ton":
        ton.disconnect();
        break;
      case "near":
        near.disconnect();
        break;
      case "bitcoin":
        break;
    }
  };

  const disconnectAll = () => {
    Object.keys(connected).forEach((c) => {
      if (connected[c as ChainId]) disconnect(c as ChainId);
    });
  };

  const getActiveWallet = (chain: ChainId) => connected[chain];

  const value = useMemo<WalletContextValue>(
    () => ({
      connected,
      connect,
      disconnect,
      disconnectAll,
      isConnecting,
      isReady: !near.connecting,
      getActiveWallet,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solana.address, solana.connected, evm.address, evm.connected, ton.address, near.address, near.connecting]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <EvmWalletProvider>
        <TonWalletProvider>
          <WalletProviderInner>{children}</WalletProviderInner>
        </TonWalletProvider>
      </EvmWalletProvider>
    </SolanaWalletProvider>
  );
}
