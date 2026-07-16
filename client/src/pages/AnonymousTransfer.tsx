import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, Download, RefreshCcw } from "lucide-react";
import { formatUnits, parseUnits } from "ethers";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const sendSchema = z.object({
  recipientStealthKey: z.string().min(32, "Invalid stealth public key length"),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
});

type SendFormValues = z.infer<typeof sendSchema>;

export default function AnonymousTransfer() {
  const { toast } = useToast();
  
  // Default to USDC on Solana for MVP
  const tokenMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: {
      recipientStealthKey: "",
      amount: "",
    },
  });

  const { data: claimableUtxos, isLoading: isLoadingUtxos, refetch: refetchUtxos } = trpc.umbra.listClaimable.useQuery();
  const scanMutation = trpc.umbra.scanIncoming.useMutation({
    onSuccess: () => {
      toast({ title: "Scan Complete", description: "Checked for new stealth transfers." });
      refetchUtxos();
    },
    onError: (error) => {
      toast({ title: "Scan Failed", description: error.message, variant: "destructive" });
    }
  });

  const sendMutation = trpc.umbra.send.useMutation({
    onSuccess: () => {
      toast({ title: "Transfer Sent", description: "Anonymous transfer initiated." });
      form.reset();
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

  const onSubmit = (values: SendFormValues) => {
    try {
      const amountBaseUnits = parseUnits(values.amount, 6).toString(); // Assuming 6 decimals for USDC
      sendMutation.mutate({
        tokenMint,
        amountBaseUnits,
        receiverStealthPublicKey: values.recipientStealthKey,
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
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="recipientStealthKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Stealth Public Key</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter recipient's stealth public key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (USDC)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit"
                      className="w-full" 
                      disabled={sendMutation.isPending}
                    >
                      {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Anonymously
                    </Button>
                  </CardFooter>
                </form>
              </Form>
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
                          <p className="text-xs text-muted-foreground">Type: {utxo.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground truncate w-48" title={utxo.commitment}>
                            ID: {utxo.commitment.substring(0, 16)}...
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleClaim(utxo.commitment, utxo.amount)}
                          disabled={claimMutation.isPending}
                        >
                          {claimMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
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
