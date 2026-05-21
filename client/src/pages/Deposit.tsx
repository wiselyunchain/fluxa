import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Download, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/use-toast";

export default function Deposit() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  
  const depositMutation = trpc.flow.deposit.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Deposit Initiated",
        description: "Please transfer NGN to the provided account details.",
      });
      // In a real app, this would show the bank account details returned by Paj Cash
      // For now, we redirect to dashboard
      setTimeout(() => navigate('/dashboard'), 2000);
    },
    onError: (error) => {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    
    depositMutation.mutate({ nairaAmount: Number(amount) });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" className="mb-4 pl-0" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <Card className="border-border shadow-md">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Deposit NGN</CardTitle>
            <CardDescription>
              Convert Nigerian Naira to private SOL seamlessly via Paj Cash.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (NGN)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₦</span>
                  <Input 
                    id="amount" 
                    placeholder="100,000" 
                    className="pl-8 text-lg"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={depositMutation.isPending}
                  />
                </div>
              </div>

              <div className="bg-accent/50 p-4 rounded-lg flex items-start gap-3 border border-border">
                <ShieldCheck className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold mb-1 text-foreground">Privacy Guaranteed</p>
                  <p className="text-muted-foreground">Your funds will be routed through a stealth address, making this deposit untraceable on the Solana network.</p>
                </div>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full h-12 text-lg" 
                disabled={!amount || depositMutation.isPending}
              >
                {depositMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {depositMutation.isPending ? "Processing..." : "Continue"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
