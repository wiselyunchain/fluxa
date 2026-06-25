import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcw, ArrowDownUp, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { parseUnits, formatUnits } from "ethers";

export default function Swap() {
  const { toast } = useToast();
  
  const [amount, setAmount] = useState("");
  const [originAsset, setOriginAsset] = useState("");
  const [destinationAsset, setDestinationAsset] = useState("");
  const [recipient, setRecipient] = useState("");
  const debouncedAmount = useDebounce(amount, 500);

  const { data: tokens, isLoading: isLoadingTokens } = trpc.flow.supportedTokens.useQuery();
  const { data: userWallet } = trpc.auth.getWallet.useQuery();
  
  // Use USDC on Solana as default if available
  const usdcSolana = useMemo(() => tokens?.find(t => t.symbol === "USDC" && t.blockchain === "solana"), [tokens]);
  
  const originToken = useMemo(() => tokens?.find(t => t.assetId === originAsset), [tokens, originAsset]);
  const destToken = useMemo(() => tokens?.find(t => t.assetId === destinationAsset), [tokens, destinationAsset]);

  const amountBaseUnits = useMemo(() => {
    if (!debouncedAmount || !originToken || isNaN(Number(debouncedAmount))) return "";
    try {
      return parseUnits(debouncedAmount, originToken.decimals).toString();
    } catch {
      return "";
    }
  }, [debouncedAmount, originToken]);

  const { data: quote, isLoading: isLoadingQuote, isError: isQuoteError } = trpc.flow.getQuote.useQuery(
    { originAsset, destinationAsset, amountBaseUnits },
    { 
      enabled: !!originAsset && !!destinationAsset && !!amountBaseUnits,
      retry: false,
    }
  );

  const swapMutation = trpc.flow.swap.useMutation({
    onSuccess: () => {
      toast({
        title: "Swap Initiated",
        description: "Your swap is being processed via NEAR Intents.",
      });
      setAmount("");
    },
    onError: (error) => {
      toast({
        title: "Swap Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSwap = () => {
    if (!originAsset || !destinationAsset || !amountBaseUnits || !originToken) return;
    
    // We need the mint address for fromMintAddress. For now, assuming we use the contractAddress.
    const fromMintAddress = originToken.contractAddress || ""; 

    swapMutation.mutate({
      originAsset,
      destinationAsset,
      fromMintAddress,
      amountBaseUnits,
      recipient: recipient || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Swap</h1>
          <p className="text-muted-foreground mt-2">
            Exchange any asset instantly via NEAR Intents 1Click.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Trade</CardTitle>
            <CardDescription>Select tokens and amount to swap.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pay with</Label>
              <div className="flex space-x-2">
                <Select value={originAsset} onValueChange={setOriginAsset}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Token" />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens?.map(token => (
                      <SelectItem key={token.assetId} value={token.assetId}>
                        {token.symbol} ({token.blockchain})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full bg-background"
                onClick={() => {
                  setOriginAsset(destinationAsset);
                  setDestinationAsset(originAsset);
                }}
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Receive</Label>
              <Select value={destinationAsset} onValueChange={setDestinationAsset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Token" />
                </SelectTrigger>
                <SelectContent>
                  {tokens?.map(token => (
                    <SelectItem key={token.assetId} value={token.assetId}>
                      {token.symbol} ({token.blockchain})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recipient Address (Optional)</Label>
              <Input 
                placeholder="Leave blank to receive in your Fluxa wallet" 
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            {isLoadingQuote && (
              <div className="flex items-center justify-center p-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Fetching best quote...
              </div>
            )}

            {quote && destToken && !isLoadingQuote && (
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Output:</span>
                  <span className="font-medium">
                    {formatUnits(BigInt(quote.quote.amountOut), destToken.decimals)} {destToken.symbol}
                  </span>
                </div>
              </div>
            )}
            
            {isQuoteError && !isLoadingQuote && amountBaseUnits && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                Failed to fetch quote. This route might not be supported or the amount is too small.
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              size="lg"
              disabled={!quote || isLoadingQuote || swapMutation.isPending}
              onClick={handleSwap}
            >
              {swapMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Swapping...
                </>
              ) : "Swap"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}
