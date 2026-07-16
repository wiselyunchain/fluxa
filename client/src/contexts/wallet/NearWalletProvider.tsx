import { useEffect, useRef, useState, useCallback } from "react";
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupWalletConnect } from "@near-wallet-selector/wallet-connect";

const NEAR_NETWORK = (import.meta.env.VITE_NEAR_NETWORK || "testnet") as "testnet" | "mainnet";
const NEAR_CONTRACT_ID = import.meta.env.VITE_NEAR_CONTRACT_ID || "guest-book.testnet";

export interface NearWalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  openModal: () => void;
  disconnect: () => Promise<void>;
}

export function useNearWalletStateWithProvider(): {
  selectorRef: React.MutableRefObject<WalletSelector | null>;
  state: NearWalletState;
} {
  const selectorRef = useRef<WalletSelector | null>(null);
  const modalRef = useRef<WalletSelectorModal | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  const accountsChanged = useCallback((accounts: Array<{ accountId: string }>) => {
    if (accounts.length === 0) {
      setAddress(null);
    } else {
      setAddress(accounts[0].accountId);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const selector = await setupWalletSelector({
          network: NEAR_NETWORK,
          modules: [
            setupMyNearWallet(),
            setupSender(),
            setupHereWallet(),
            setupMeteorWallet(),
            setupNightly(),
            setupWalletConnect({
              projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "fluxa-default-project-id",
              metadata: {
                name: "FluxaX V2",
                description: "Multichain NGN-Crypto bridge",
                url: typeof window !== "undefined" ? window.location.origin : "https://fluxa.app",
                icons: [],
              },
            }),
          ],
        });

        if (!active) return;
        selectorRef.current = selector;
        modalRef.current = setupModal(selector, {
          contractId: NEAR_CONTRACT_ID,
        });

        const state = selector.store.getState();
        if (state.accounts.length > 0) {
          setAddress(state.accounts[0].accountId);
        }

        const subscription = selector.store.observable.subscribe((next) => {
          accountsChanged(next.accounts);
        });

        setConnecting(false);

        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("[NEAR] failed to init wallet selector:", err);
        setConnecting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accountsChanged]);

  const openModal = useCallback(() => modalRef.current?.show(), []);
  const disconnect = useCallback(async () => {
    const selector = selectorRef.current;
    if (!selector) return;
    const wallet = await selector.wallet();
    if (typeof (wallet as any).disconnect === "function") {
      await (wallet as any).disconnect();
    }
    setAddress(null);
  }, []);

  return {
    selectorRef,
    state: {
      address,
      connected: !!address,
      connecting,
      openModal,
      disconnect,
    },
  };
}
