import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import type { WalletAdapter } from "@solana/wallet-adapter-base";

const SOLANA_RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()] as unknown as WalletAdapter[],
    [],
  );

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function useSolanaWalletState() {
  const {
    publicKey,
    connected,
    wallet,
    connect: rawConnect,
    disconnect,
    connecting,
  } = useWallet();

  const address = publicKey?.toBase58() ?? null;

  return {
    address,
    connected,
    walletName: wallet?.adapter?.name ?? null,
    connecting,
    rawConnect,
    disconnect,
  };
}
