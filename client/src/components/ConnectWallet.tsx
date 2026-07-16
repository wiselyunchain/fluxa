import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWallet, type ChainId } from "@/contexts/wallet";
import { trpc } from "@/lib/trpc";
import { Wallet, Check, Loader2, X, ChevronRight } from "lucide-react";

const CHAIN_LABELS: Record<ChainId, string> = {
  solana: "Solana",
  evm: "EVM (Ethereum/Base/Arb)",
  ton: "TON",
  near: "NEAR",
  bitcoin: "Bitcoin",
};

const CHAIN_WALLETS: Record<ChainId, string> = {
  solana: "Phantom, Solflare",
  evm: "MetaMask, WalletConnect",
  ton: "Tonkeeper, MyTonWallet",
  near: "MyNearWallet, Sender, HERE",
  bitcoin: "WalletConnect (fallback)",
};

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;
}

export function ConnectWallet() {
  const { connected, connect, disconnect, isConnecting } = useWallet();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  // Pull embedded wallets (fallback) from backend
  const { data: embeddedWallets } = trpc.auth.getWallet.useQuery();

  const handleConnect = async (chain: ChainId) => {
    await connect(chain);
    setOpen(false);
    utils.auth.getWallet.invalidate();
  };

  const handleDisconnect = (chain: ChainId) => {
    disconnect(chain);
  };

  // Determine display status per chain: external wallet > embedded fallback > none
  const getStatus = (chain: ChainId): { type: "external" | "embedded" | "none"; address: string | null } => {
    const ext = connected[chain];
    if (ext) return { type: "external", address: ext.address };
    const emb = embeddedWallets?.[chain];
    if (emb) return { type: "embedded", address: emb.address };
    return { type: "none", address: null };
  };

  // Aggregate: total of any wallets active across any chain
  const anyConnected = Object.values(connected).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="h-4 w-4" />
          {anyConnected
            ? `${Object.values(connected).filter(Boolean).length} Wallet${
                Object.values(connected).filter(Boolean).length > 1 ? "s" : ""
              }`
            : "Connect Wallet"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallets</DialogTitle>
          <DialogDescription>
            Connect chain-specific wallets (native adapters first). Embedded wallets are used as automatic fallbacks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          {Object.keys(CHAIN_LABELS).map((chainKey) => {
            const chain = chainKey as ChainId;
            const status = getStatus(chain);
            const ext = connected[chain];
            const connecting = isConnecting[chain];

            return (
              <div
                key={chain}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{CHAIN_LABELS[chain]}</span>
                    {status.type === "external" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                        Native
                      </span>
                    )}
                    {status.type === "embedded" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Fallback
                      </span>
                    )}
                  </div>
                  {status.address ? (
                    <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
                      {shortAddress(status.address)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">{CHAIN_WALLETS[chain]}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : ext ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => handleDisconnect(chain)}
                        aria-label={`Disconnect ${chain}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : status.type === "embedded" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      onClick={() => handleConnect(chain)}
                    >
                      Connect Native
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button size="sm" className="h-8" onClick={() => handleConnect(chain)}>
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            Native adapters are preferred. WalletConnect is used only when no native adapter exists.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
