import { TonConnectUIProvider, useTonAddress, useTonConnectUI, useIsConnectionRestored } from "@tonconnect/ui-react";

const MANIFEST_URL =
  import.meta.env.VITE_TONCONNECT_MANIFEST_URL || `${window.location.origin}/tonconnect-manifest.json`;

export function TonWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      {children}
    </TonConnectUIProvider>
  );
}

export function useTonWalletState() {
  const userFriendlyAddress = useTonAddress();
  const rawAddress = useTonAddress(false);
  const [tonConnectUI] = useTonConnectUI();
  const connectionRestored = useIsConnectionRestored();

  return {
    address: userFriendlyAddress || rawAddress || null,
    connected: !!userFriendlyAddress,
    connecting: !connectionRestored,
    openModal: () => tonConnectUI.openModal(),
    disconnect: () => tonConnectUI.disconnect(),
  };
}
