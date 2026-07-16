import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowDownUp, Loader2, Shield, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { parseUnits, formatUnits } from "ethers";
import { useWallet } from "@/contexts/wallet";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";

const UMBRA_SUPPORTED_MINTS = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "So11111111111111111111111111111111111111112", // wSOL
  "PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta", // UMBRA
];

export default function Swap() {
  const { toast } = useToast();
  const { connected: externalWallets } = useWallet();
  const solanaWallet = useSolanaWallet();
  
  const [amount, setAmount] = useState("");
  const [originAsset, setOriginAsset] = useState("");
  const [destinationAsset, setDestinationAsset] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const debouncedAmount = useDebounce(amount, 500);

  const { data: tokens, isLoading: isLoadingTokens } = trpc.flow.supportedTokens.useQuery();
  const { data: userWallet } = trpc.auth.getWallet.useQuery();
  
  const usdcSolana = useMemo(() => tokens?.find(t => t.symbol === "USDC" && t.blockchain === "solana"), [tokens]);
  
  const originToken = useMemo(() => tokens?.find(t => t.assetId === originAsset), [tokens, originAsset]);
  const destToken = useMemo(() => tokens?.find(t => t.assetId === destinationAsset), [tokens, destinationAsset]);

  const hasExternalSolana = !!(externalWallets.solana?.address);

  const amountBaseUnits = useMemo(() => {
    if (!debouncedAmount || !originToken || isNaN(Number(debouncedAmount))) return "";
    try {
      return parseUnits(debouncedAmount, originToken.decimals).toString();
    } catch {
      return "";
    }
  }, [debouncedAmount, originToken]);

  const isDestinationSupportedByUmbra = useMemo(() => {
    if (!destToken) return false;
    return destToken.blockchain.toLowerCase() === "solana" && destToken.contractAddress && UMBRA_SUPPORTED_MINTS.includes(destToken.contractAddress);
  }, [destToken]);

  useEffect(() => {
    if (!isDestinationSupportedByUmbra && !recipient && userWallet && destToken) {
      const chain = destToken.blockchain.toLowerCase();
      if (chain === "ton" && userWallet.ton) {
        setRecipient(userWallet.ton.address);
      } else if (chain === "near" && userWallet.near) {
        setRecipient(userWallet.near.address);
      } else if ((chain === "bitcoin" || chain === "btc") && userWallet.bitcoin) {
        setRecipient(userWallet.bitcoin.address);
      } else if (userWallet.evm) {
        setRecipient(userWallet.evm.address);
      }
    }
  }, [isDestinationSupportedByUmbra, userWallet, recipient, destToken]);

  const { data: quote, isLoading: isLoadingQuote, isError: isQuoteError } = trpc.flow.getQuote.useQuery(
    { originAsset, destinationAsset, amountBaseUnits },
    { 
      enabled: !!originAsset && !!destinationAsset && !!amountBaseUnits,
      retry: false,
    }
  );

  const swapMutation = trpc.flow.swap.useMutation({
    onSuccess: () => {
      toast({ title: "Swap Initiated", description: "Your swap is being processed via NEAR Intents." });
      setAmount("");
    },
    onError: (error) => {
      toast({ title: "Swap Failed", description: error.message, variant: "destructive" });
    }
  });

  const submitSignedMutation = trpc.flow.submitSwapSigned.useMutation({
    onSuccess: () => {
      toast({ title: "Swap Initiated", description: "Signed transaction submitted via your wallet." });
      setAmount("");
    },
    onError: (error) => {
      toast({ title: "Swap Failed", description: error.message, variant: "destructive" });
    }
  });

  const utils = trpc.useUtils();
  const [signing, setSigning] = useState(false);
  const isPending = swapMutation.isPending || submitSignedMutation.isPending || signing;

  const handleSwap = async () => {
    if (!originAsset || !destinationAsset || !amountBaseUnits || !originToken) return;
    
    const fromMintAddress = originToken.contractAddress || ""; 

    if (isPrivate && !isDestinationSupportedByUmbra && !recipient) {
      toast({ title: "Error", description: "Recipient address is required for cross-chain private swaps", variant: "destructive" });
      return;
    }

    if (hasExternalSolana && solanaWallet.signTransaction) {
      try {
        const prepared = await utils.flow.prepareUnsignedSwap.fetch({
          originAsset,
          destinationAsset,
          fromMintAddress,
          fromAddress: externalWallets.solana!.address,
          amountBaseUnits,
          recipient: recipient || undefined,
          isPrivate: isPrivate || undefined,
        });

        setSigning(true);
        const tx = Transaction.from(Buffer.from(prepared.unsignedTxBase64, "base64"));
        const signed = await solanaWallet.signTransaction!(tx);
        const signedTxBase64 = Buffer.from(signed.serialize()).toString("base64");

        await submitSignedMutation.mutateAsync({
          signedTxBase64,
          correlationId: prepared.correlationId,
          depositAddress: prepared.depositAddress,
          depositMemo: prepared.depositMemo,
          originAsset,
          destinationAsset,
          fromMintAddress,
          amountBaseUnits,
          isPrivate: isPrivate || undefined,
        });
      } catch (err: any) {
        if (!(err as any)?.message?.includes("User rejected")) {
          toast({ title: "Swap Failed", description: err.message, variant: "destructive" });
        }
      } finally {
        setSigning(false);
      }
    } else {
      swapMutation.mutate({
        originAsset,
        destinationAsset,
        fromMintAddress,
        amountBaseUnits,
        recipient: recipient || undefined,
        isPrivate,
      });
    }
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
              <Label>Recipient Address {(!isDestinationSupportedByUmbra && isPrivate) ? "(Required)" : "(Optional)"}</Label>
              <Input 
                placeholder={(!isDestinationSupportedByUmbra && isPrivate) ? "Enter destination wallet address" : "Leave blank to receive in your Fluxa wallet"} 
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={(isPrivate && isDestinationSupportedByUmbra) as boolean}
              />
            </div>

            <div className="flex items-center space-x-2 border p-4 rounded-lg bg-card">
              <Switch 
                id="private-mode" 
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="private-mode" className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  Private Swap
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isPrivate 
                    ? isDestinationSupportedByUmbra
                      ? "Output tokens will be routed through an ephemeral address and shielded directly into your Umbra balance."
                      : "Funds will be drawn from your private balance and sent directly to the recipient address on the destination chain."
                    : "Swap runs normally. Enable to keep your origin balance private."}
                </p>
              </div>
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
              disabled={!quote || isLoadingQuote || isPending}
              onClick={handleSwap}
            >
              {signing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sign in {externalWallets.solana?.walletName ?? "wallet"}...
                </>
              ) : submitSignedMutation.isPending || swapMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Swapping...
                </>
              ) : hasExternalSolana ? (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Sign & Swap
                </>
              ) : "Swap"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}
