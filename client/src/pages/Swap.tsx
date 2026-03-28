import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowRightLeft, TrendingUp, AlertCircle, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const chains = ["solana", "base", "bsc", "ton", "avalanche"] as const;
const tokens = ["usdt", "usdc", "usde", "sol", "eth", "bnb", "ton", "avax"] as const;

export default function Swap() {
  const { user, isAuthenticated } = useAuth();
  const [fromChain, setFromChain] = useState<typeof chains[number]>("solana");
  const [toChain, setToChain] = useState<typeof chains[number]>("base");
  const [fromToken, setFromToken] = useState<typeof tokens[number]>("usdt");
  const [toToken, setToToken] = useState<typeof tokens[number]>("usdc");
  const [fromAmount, setFromAmount] = useState("");
  const [quote, setQuote] = useState<any>(null);

  const initiateSwapMutation = trpc.swap.initiateSwap.useMutation();
  const { data: swapQuote, isLoading: quoteLoading } = trpc.swap.getSwapQuote.useQuery(
    {
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount: fromAmount || "0",
    },
    { enabled: !!fromAmount && parseFloat(fromAmount) > 0 }
  );

  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const result = await initiateSwapMutation.mutateAsync({
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
      });

      toast.success("Swap initiated! Processing your transaction...");
      setFromAmount("");
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate swap");
    }
  };

  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
  };

  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Swap Crypto</h1>
          <p className="text-muted-foreground">Instantly swap tokens across multiple blockchains</p>
        </div>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Multi-Chain Swap
              </CardTitle>
              <CardDescription>
                Exchange tokens across Solana, Base, BSC, TON, and Avalanche
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Security Notice */}
              <div className="flex gap-3 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground mb-1">Privacy Protected</p>
                  <p className="text-muted-foreground">Your swap details are private and never shared</p>
                </div>
              </div>

              {/* From Section */}
              <div className="space-y-4 p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-sm font-semibold">From</Label>
                  <span className="text-xs text-muted-foreground">Balance: 0.00</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="from-chain" className="text-xs">Chain</Label>
                    <Select value={fromChain} onValueChange={(v) => setFromChain(v as any)}>
                      <SelectTrigger id="from-chain" className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chains.map((chain) => (
                          <SelectItem key={chain} value={chain} className="capitalize">
                            {chain}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from-token" className="text-xs">Token</Label>
                    <Select value={fromToken} onValueChange={(v) => setFromToken(v as any)}>
                      <SelectTrigger id="from-token" className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tokens.map((token) => (
                          <SelectItem key={token} value={token} className="uppercase">
                            {token}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from-amount" className="text-xs">Amount</Label>
                  <Input
                    id="from-amount"
                    type="number"
                    placeholder="0.00"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    step="0.00000001"
                    className="text-lg"
                  />
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSwapChains}
                  className="rounded-full"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              </div>

              {/* To Section */}
              <div className="space-y-4 p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-sm font-semibold">To</Label>
                  <span className="text-xs text-muted-foreground">Balance: 0.00</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="to-chain" className="text-xs">Chain</Label>
                    <Select value={toChain} onValueChange={(v) => setToChain(v as any)}>
                      <SelectTrigger id="to-chain" className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chains.map((chain) => (
                          <SelectItem key={chain} value={chain} className="capitalize">
                            {chain}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="to-token" className="text-xs">Token</Label>
                    <Select value={toToken} onValueChange={(v) => setToToken(v as any)}>
                      <SelectTrigger id="to-token" className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tokens.map((token) => (
                          <SelectItem key={token} value={token} className="uppercase">
                            {token}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to-amount" className="text-xs">You will receive</Label>
                  <Input
                    id="to-amount"
                    type="text"
                    placeholder="0.00"
                    value={swapQuote?.toAmount || "0.00"}
                    readOnly
                    className="text-lg bg-muted"
                  />
                </div>
              </div>

              {/* Quote Details */}
              {swapQuote && fromAmount && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Exchange Rate</span>
                    <span className="font-semibold text-foreground">
                      1 {fromToken.toUpperCase()} = {(parseFloat(swapQuote.toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee</span>
                    <span className="font-semibold text-foreground">{swapQuote.fee} {fromToken.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Slippage</span>
                    <span className="font-semibold text-foreground">{swapQuote.slippage}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Time</span>
                    <span className="font-semibold text-foreground">{swapQuote.estimatedTime}</span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={handleSwap}
                disabled={initiateSwapMutation.isPending || !fromAmount || parseFloat(fromAmount) <= 0}
                className="w-full gap-2"
                size="lg"
              >
                <Zap className="w-4 h-4" />
                {initiateSwapMutation.isPending ? "Processing..." : "Confirm Swap"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
