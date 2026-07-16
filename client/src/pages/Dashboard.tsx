import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Shield, ShieldCheck, Wallet, ArrowDownToLine, ArrowUpFromLine, Repeat } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import IntentInput from "@/components/IntentInput";
import { ConnectWallet } from "@/components/ConnectWallet";

export default function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [loading, isAuthenticated, navigate]);

  const { data: wallet, isLoading: walletLoading } = trpc.auth.getWallet.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createWalletMutation = trpc.auth.createWallet.useMutation({
    onSuccess: () => {
      // Refresh wallet after creation
      window.location.reload();
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="grid gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome, {user.name || user.username}</h1>
            <p className="text-muted-foreground">Privacy-First Crypto ↔ NGN Exchange</p>
          </div>
          <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-full border border-green-500/20">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-medium text-sm">Privacy Active</span>
          </div>
          <ConnectWallet />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Solana Settlement Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {walletLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : wallet?.solana ? (
                <>
                  <div className="text-3xl font-bold text-foreground">{wallet.solana.balance} SOL</div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{wallet.solana.address.substring(0, 8)}...{wallet.solana.address.substring(wallet.solana.address.length - 8)}</p>
                </>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-muted-foreground">No private wallet active</p>
                  <Button size="sm" onClick={() => createWalletMutation.mutate()} disabled={createWalletMutation.isPending}>
                    {createWalletMutation.isPending ? "Activating..." : "Activate Privacy Wallet"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Privacy Guarantees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-foreground/80">
                <li className="flex items-center gap-2">✓ Amounts hidden on-chain via Magic Block</li>
                <li className="flex items-center gap-2">✓ Stealth receiving addresses via Umbra</li>
                <li className="flex items-center gap-2">✓ Universal token routing via NEAR Intents</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Intent Input */}
        <div className="mb-12">
          <IntentInput />
        </div>

        {/* Quick Actions */}
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button variant="outline" className="h-24 flex flex-col gap-2 items-center justify-center border-border hover:bg-accent hover:text-accent-foreground" onClick={() => navigate('/deposit')}>
            <ArrowDownToLine className="w-6 h-6" />
            <span>Deposit NGN</span>
          </Button>
          <Button variant="outline" className="h-24 flex flex-col gap-2 items-center justify-center border-border hover:bg-accent hover:text-accent-foreground" onClick={() => navigate('/withdraw')}>
            <ArrowUpFromLine className="w-6 h-6" />
            <span>Withdraw to Bank</span>
          </Button>
          <Button variant="outline" className="h-24 flex flex-col gap-2 items-center justify-center border-border hover:bg-accent hover:text-accent-foreground" onClick={() => navigate('/history')}>
            <Repeat className="w-6 h-6" />
            <span>Transaction History</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
