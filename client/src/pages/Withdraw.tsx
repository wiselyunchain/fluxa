import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Upload, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/use-toast";

const SETTLEMENT_TOKENS = [
  { label: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { label: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
] as const;

export default function Withdraw() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: "",
    accountName: "",
    accountNumber: "",
    bankId: "044"
  });
  const [tokenMint, setTokenMint] = useState(SETTLEMENT_TOKENS[0].mint);

  const withdrawMutation = trpc.flow.withdraw.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Withdrawal Initiated",
        description: "Your funds are being routed privately and converted to NGN.",
      });
      setTimeout(() => navigate('/dashboard'), 2000);
    },
    onError: (error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || isNaN(Number(formData.amount))) return;

    withdrawMutation.mutate({
      usdtAmount: Number(formData.amount),
      bankId: formData.bankId,
      accountNumber: formData.accountNumber,
      mint: tokenMint,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-md">
        <Button variant="ghost" className="mb-4 pl-0" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="border-border shadow-md">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Withdraw to Bank</CardTitle>
            <CardDescription>
              Convert private crypto to Nigerian Naira via Paj Cash.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Settlement Token</Label>
                <Select value={tokenMint} onValueChange={setTokenMint}>
                  <SelectTrigger id="token">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_TOKENS.map((t) => (
                      <SelectItem key={t.mint} value={t.mint}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                    {SETTLEMENT_TOKENS.find(t => t.mint === tokenMint)?.label ?? "USDC"}
                  </span>
                  <Input
                    id="amount"
                    placeholder="100"
                    className="pl-14 text-lg"
                    value={formData.amount}
                    onChange={handleChange}
                    disabled={withdrawMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  placeholder="John Doe"
                  value={formData.accountName}
                  onChange={handleChange}
                  disabled={withdrawMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  placeholder="0123456789"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  disabled={withdrawMutation.isPending}
                />
              </div>

              <div className="bg-accent/50 p-4 rounded-lg flex items-start gap-3 border border-border mt-6">
                <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold mb-1 text-foreground">Sender Anonymity</p>
                  <p className="text-muted-foreground">This transaction is routed through a private pool. The receiving bank will not be able to trace this back to your on-chain wallet.</p>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full h-12 text-lg"
                disabled={!formData.amount || !formData.accountName || !formData.accountNumber || withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {withdrawMutation.isPending ? "Processing..." : "Confirm Withdrawal"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}