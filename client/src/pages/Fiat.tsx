import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Download, Send, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Fiat() {
  const { user, isAuthenticated } = useAuth();
  const [onrampAmount, setOnrampAmount] = useState("");
  const [onrampToken, setOnrampToken] = useState("usdt");
  const [offrampAmount, setOfframpAmount] = useState("");
  const [offrampToken, setOfframpToken] = useState("usdt");
  const [bankAccount, setBankAccount] = useState("");

  const initiateOnrampMutation = trpc.fiat.initiateOnramp.useMutation();
  const initiateOfframpMutation = trpc.fiat.initiateOfframp.useMutation();
  const { data: exchangeRate } = trpc.fiat.getExchangeRate.useQuery(
    { fromToken: onrampToken as any, toToken: "ngn" },
    { enabled: false }
  );

  const handleOnramp = async () => {
    if (!onrampAmount || !onrampToken) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const result = await initiateOnrampMutation.mutateAsync({
        amount: onrampAmount,
        cryptoToken: onrampToken as any,
      });

      toast.success("Payment request created!");
      // Show payment details modal or redirect to payment page
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate on-ramp");
    }
  };

  const handleOfframp = async () => {
    if (!offrampAmount || !offrampToken || !bankAccount) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const result = await initiateOfframpMutation.mutateAsync({
        cryptoAmount: offrampAmount,
        cryptoToken: offrampToken as any,
        bankAccount,
      });

      toast.success("Withdrawal initiated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate off-ramp");
    }
  };



  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Buy & Sell Crypto</h1>
          <p className="text-muted-foreground">Convert between NGN and crypto instantly</p>
        </div>

        <Tabs defaultValue="onramp" className="max-w-2xl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="onramp" className="gap-2">
              <Download className="w-4 h-4" />
              Buy Crypto
            </TabsTrigger>
            <TabsTrigger value="offramp" className="gap-2">
              <Send className="w-4 h-4" />
              Sell Crypto
            </TabsTrigger>
          </TabsList>

          {/* On-Ramp Tab */}
          <TabsContent value="onramp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Buy Crypto with NGN</CardTitle>
                <CardDescription>
                  Transfer NGN to your virtual account and receive crypto instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Security Notice */}
                <div className="flex gap-3 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground mb-1">Your transactions are private</p>
                    <p className="text-muted-foreground">Only you can see your transaction history</p>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="onramp-amount">Amount (NGN)</Label>
                  <Input
                    id="onramp-amount"
                    type="number"
                    placeholder="Enter amount in Naira"
                    value={onrampAmount}
                    onChange={(e) => setOnrampAmount(e.target.value)}
                    className="text-lg"
                  />
                  <p className="text-xs text-muted-foreground">Minimum: ₦1,000 | Maximum: ₦5,000,000</p>
                </div>

                {/* Token Selection */}
                <div className="space-y-2">
                  <Label htmlFor="onramp-token">Receive Token</Label>
                  <Select value={onrampToken} onValueChange={setOnrampToken}>
                    <SelectTrigger id="onramp-token">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usdt">USDT (Tether)</SelectItem>
                      <SelectItem value="usdc">USDC (USD Coin)</SelectItem>
                      <SelectItem value="usde">USDe (Ethena)</SelectItem>
                      <SelectItem value="sol">SOL (Solana)</SelectItem>
                      <SelectItem value="eth">ETH (Ethereum)</SelectItem>
                      <SelectItem value="bnb">BNB (Binance Coin)</SelectItem>
                      <SelectItem value="ton">TON (Telegram)</SelectItem>
                      <SelectItem value="avax">AVAX (Avalanche)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Exchange Rate */}
                <div className="p-4 bg-card border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Exchange Rate</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-foreground">
                      {onrampAmount ? `₦${parseFloat(onrampAmount).toLocaleString()}` : "₦0"}
                    </p>
                    <p className="text-lg font-semibold text-accent">
                      {onrampAmount ? `${(parseFloat(onrampAmount) / 1500000).toFixed(4)} ${onrampToken.toUpperCase()}` : "0"}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={handleOnramp}
                  disabled={initiateOnrampMutation.isPending || !onrampAmount}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Download className="w-4 h-4" />
                  {initiateOnrampMutation.isPending ? "Processing..." : "Continue to Payment"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Off-Ramp Tab */}
          <TabsContent value="offramp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sell Crypto for NGN</CardTitle>
                <CardDescription>
                  Withdraw your crypto as Nigerian Naira to your bank account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Security Notice */}
                <div className="flex gap-3 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground mb-1">Fast & Secure Withdrawals</p>
                    <p className="text-muted-foreground">Receive NGN in your account within minutes</p>
                  </div>
                </div>

                {/* Crypto Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="offramp-amount">Amount (Crypto)</Label>
                  <Input
                    id="offramp-amount"
                    type="number"
                    placeholder="Enter amount"
                    value={offrampAmount}
                    onChange={(e) => setOfframpAmount(e.target.value)}
                    step="0.00000001"
                    className="text-lg"
                  />
                </div>

                {/* Token Selection */}
                <div className="space-y-2">
                  <Label htmlFor="offramp-token">Sell Token</Label>
                  <Select value={offrampToken} onValueChange={setOfframpToken}>
                    <SelectTrigger id="offramp-token">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usdt">USDT (Tether)</SelectItem>
                      <SelectItem value="usdc">USDC (USD Coin)</SelectItem>
                      <SelectItem value="usde">USDe (Ethena)</SelectItem>
                      <SelectItem value="sol">SOL (Solana)</SelectItem>
                      <SelectItem value="eth">ETH (Ethereum)</SelectItem>
                      <SelectItem value="bnb">BNB (Binance Coin)</SelectItem>
                      <SelectItem value="ton">TON (Telegram)</SelectItem>
                      <SelectItem value="avax">AVAX (Avalanche)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bank Account */}
                <div className="space-y-2">
                  <Label htmlFor="bank-account">Bank Account Number</Label>
                  <Input
                    id="bank-account"
                    type="text"
                    placeholder="Enter your bank account number"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>

                {/* Exchange Rate */}
                <div className="p-4 bg-card border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">You will receive</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-foreground">
                      {offrampAmount ? `${parseFloat(offrampAmount).toFixed(4)} ${offrampToken.toUpperCase()}` : "0"}
                    </p>
                    <p className="text-lg font-semibold text-accent">
                      {offrampAmount ? `₦${(parseFloat(offrampAmount) * 1500000).toLocaleString()}` : "₦0"}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={handleOfframp}
                  disabled={initiateOfframpMutation.isPending || !offrampAmount || !bankAccount}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Send className="w-4 h-4" />
                  {initiateOfframpMutation.isPending ? "Processing..." : "Withdraw to Bank"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
