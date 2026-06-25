import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, Download, RefreshCcw } from "lucide-react";
import { formatUnits, parseUnits } from "ethers";

export default function AnonymousTransfer() {
  const { toast } = useToast();
  
  const [sendAmount, setSendAmount] = useState("");
  const [recipientStealthKey, setRecipientStealthKey] = useState("");
  // Default to USDC on Solana for MVP
  const [tokenMint, setTokenMint] = useState("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

  const { data: claimableUtxos, isLoading: isLoadingUtxos, refetch: refetchUtxos } = trpc.umbra.listClaimable.useQuery();
  const scanMutation = trpc.umbra.scanIncoming.useMutation({
    onSuccess: () => {
      toast({ title: "Scan Complete", description: "Checked for new stealth transfers." });
      refetchUtxos();
    }
  });

  const sendMutation = trpc.umbra.send.useMutation({
    onSuccess: () => {
      toast({ title: "Transfer Sent", description: "Anonymous transfer initiated." });
      setSendAmount("");
      setRecipientStealthKey("");
    },
    onError: (error) => toast({ title: "Transfer Failed", description: error.message, variant: "destructive" })
  });

  const claimMutation = trpc.umbra.claim.useMutation({
    onSuccess: () => {
      toast({ title: "Claimed", description: "Funds claimed to your encrypted balance." });
      refetchUtxos();
    },
    onError: (error) => toast({ title: "Claim Failed", description: error.message, variant: "destructive" })
  });

  const handleSend = () => {
    if (!sendAmount || !recipientStealthKey) return;
    try {
      const amountBaseUnits = parseUnits(sendAmount, 6).toString(); // Assuming 6 decimals for USDC
      sendMutation.mutate({
        tokenMint,
        amountBaseUnits,
        receiverStealthPublicKey: recipientStealthKey,
      });
    } catch {
      toast({ title: "Invalid Amount", variant: "destructive" });
    }
  };

  const handleClaim = (commitment: string, amount: string) => {
    claimMutation.mutate({
      tokenMint,
      commitment,
      amountBaseUnits: amount,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Anonymous Transfers</h1>
          <p className="text-muted-foreground mt-2">
            Send and receive funds privately using Umbra stealth addresses.
          </p>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send">Send</TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
          </TabsList>
          
          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle>Send Privately</CardTitle>
                <CardDescription>
                  Send funds to another user's stealth address. The transfer cannot be traced back to you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Recipient Stealth Public Key</Label>
                  <Input 
                    placeholder="Enter recipient's stealth public key" 
                    value={recipientStealthKey}
                    onChange={(e) => setRecipientStealthKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount (USDC)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  disabled={!sendAmount || !recipientStealthKey || sendMutation.isPending}
                  onClick={handleSend}
                >
                  {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send Anonymously
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="inbox">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Stealth Inbox</CardTitle>
                  <CardDescription>Funds sent to your stealth address waiting to be claimed.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => scanMutation.mutate({})} disabled={scanMutation.isPending}>
                  {scanMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  Scan
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingUtxos ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : claimableUtxos?.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                    No pending transfers found.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {claimableUtxos?.map((utxo) => (
                      <div key={utxo.commitment} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div>
                          <p className="font-medium">{formatUnits(BigInt(utxo.amount), 6)} USDC</p>
                          <p className="text-xs text-muted-foreground">Type: {utxo.type}</p>
                          <p className="text-xs text-muted-foreground truncate w-48" title={utxo.commitment}>
                            ID: {utxo.commitment.substring(0, 16)}...
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleClaim(utxo.commitment, utxo.amount)}
                          disabled={claimMutation.isPending}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Claim
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
