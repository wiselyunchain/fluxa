import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/use-toast";

export default function IntentInput() {
  const [intent, setIntent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const swapMutation = trpc.flow.swap.useMutation({
    onSuccess: () => {
      toast({
        title: "Intent Executed Successfully",
        description: "Your funds have been privately routed.",
      });
      setIsProcessing(false);
      setIntent("");
    },
    onError: (error) => {
      toast({
        title: "Intent Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  });

  const depositMutation = trpc.flow.deposit.useMutation({
    onSuccess: () => {
      toast({
        title: "Deposit Initiated",
        description: "Please complete the NGN bank transfer.",
      });
      setIsProcessing(false);
      setIntent("");
    },
    onError: (error) => {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  });

  const handleIntentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim()) return;

    setIsProcessing(true);

    // Extremely basic mock intent parsing for the UI demo
    const lowerIntent = intent.toLowerCase();
    
    if (lowerIntent.includes("sell") || lowerIntent.includes("swap") || lowerIntent.includes("convert")) {
      // Mock parsing: "Sell 100 TON for USDT"
      // In production, this would use an LLM or robust regex parser backend
      swapMutation.mutate({
        fromToken: "TON",
        fromChain: "TON",
        fromAmount: 100,
        toToken: "USDT",
        toChain: "Solana",
      });
    } else if (lowerIntent.includes("buy") || lowerIntent.includes("deposit")) {
      // Mock parsing: "Buy 100000 NGN worth of SOL"
      depositMutation.mutate({
        nairaAmount: 100000
      });
    } else {
      toast({
        title: "Unrecognized Intent",
        description: "Please try saying 'Sell 100 TON for NGN' or 'Deposit 50000 NGN'.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 shadow-lg bg-gradient-to-br from-background to-primary/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center gap-2 mb-4 text-primary">
          <Sparkles className="w-5 h-5" />
          <h2 className="text-lg font-bold">What do you want to do?</h2>
        </div>
        
        <form onSubmit={handleIntentSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input 
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g., Sell 100 TON for NGN..." 
              className="h-14 text-lg pr-12 rounded-xl border-primary/20 focus-visible:ring-primary/30"
              disabled={isProcessing}
            />
          </div>
          <Button 
            type="submit" 
            size="lg" 
            className="h-14 px-8 rounded-xl shrink-0 font-semibold"
            disabled={!intent.trim() || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Execute
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </form>
        
        <p className="text-sm text-muted-foreground mt-4 text-center sm:text-left">
          Powered by NEAR Intent Protocol. We handle the complex routing and privacy automatically.
        </p>
      </CardContent>
    </Card>
  );
}
