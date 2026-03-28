import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Wallet, Plus, TrendingUp, Send, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [loading, isAuthenticated, navigate]);

  const { data: wallets, isLoading: walletsLoading } = trpc.auth.getWallets.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createWalletMutation = trpc.auth.createWallet.useMutation();

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

  const handleCreateWallet = async (chain: "solana" | "base" | "bsc" | "ton" | "avalanche") => {
    try {
      await createWalletMutation.mutateAsync({ chain });
    } catch (error) {
      console.error("Failed to create wallet:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome, {user.name || user.username}</h1>
          <p className="text-muted-foreground">Manage your multi-chain crypto wallets and transactions</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">$0.00</div>
              <p className="text-xs text-muted-foreground mt-1">Across all chains</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Daily Limit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">₦{parseFloat(user.dailyTransactionLimit || "1000000").toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Remaining today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${user.accountFrozen ? "text-destructive" : "text-accent"}`}>
                {user.accountFrozen ? "Frozen" : "Active"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">KYC: {user.kycStatus}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="wallets" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="swap" asChild><a href="/swap">Swap</a></TabsTrigger>
            <TabsTrigger value="onramp" asChild><a href="/fiat">On-Ramp</a></TabsTrigger>
            <TabsTrigger value="history" asChild><a href="/history">History</a></TabsTrigger>
          </TabsList>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Multi-Chain Wallets
                </CardTitle>
                <CardDescription>
                  Create and manage wallets across Solana, Base, BSC, TON, and Avalanche
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {walletsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : (
                  <>
                    {wallets && wallets.length > 0 ? (
                      <div className="space-y-3">
                        {wallets.map((wallet) => (
                          <Card key={wallet.id} className="bg-card/50">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-foreground capitalize">{wallet.chain}</p>
                                  <p className="text-sm text-muted-foreground font-mono truncate">{wallet.address}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-foreground">{wallet.balance} {wallet.chain.toUpperCase()}</p>
                                  <div className="flex gap-2 mt-2">
                                    <Button size="sm" variant="outline" className="gap-1">
                                      <Download className="w-4 h-4" />
                                      Deposit
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-1">
                                      <Send className="w-4 h-4" />
                                      Withdraw
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-muted-foreground mb-4">No wallets yet</p>
                      </div>
                    )}
                  </>
                )}

                {/* Create Wallet Buttons */}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-foreground mb-3">Create New Wallet</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {["solana", "base", "bsc", "ton", "avalanche"].map((chain) => (
                      <Button
                        key={chain}
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateWallet(chain as any)}
                        disabled={createWalletMutation.isPending}
                        className="gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline capitalize">{chain}</span>
                        <span className="sm:hidden capitalize">{chain.substring(0, 3)}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Swap Tab */}
          <TabsContent value="swap">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Swap Crypto
                </CardTitle>
                <CardDescription>
                  Swap tokens across multiple blockchains instantly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Swap feature coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* On-Ramp Tab */}
          <TabsContent value="onramp">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Buy Crypto with NGN
                </CardTitle>
                <CardDescription>
                  Convert Nigerian Naira to crypto instantly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  On-ramp feature coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  Your private transaction history (visible only to you)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No transactions yet
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
