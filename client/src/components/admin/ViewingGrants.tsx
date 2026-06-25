import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, Lock, Unlock, Search } from "lucide-react";
import { Label } from "@/components/ui/label";

export function ViewingGrants() {
  const [transactionId, setTransactionId] = useState("");
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [requested, setRequested] = useState(false);

  const requestGrantMutation = trpc.admin.requestViewingGrant.useMutation({
    onSuccess: () => {
      toast.success("Viewing grant request submitted.");
      setRequested(true);
      setTransactionId("");
      setUserId("");
      setReason("");
      setTimeout(() => setRequested(false), 5000);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to request grant");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId || !userId || !reason) {
      toast.error("Please fill all fields to request a grant.");
      return;
    }

    requestGrantMutation.mutate({
      transactionId: parseInt(transactionId, 10),
      targetUserId: parseInt(userId, 10),
      reason,
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-purple-500" />
            Request Decryption Grant
          </CardTitle>
          <CardDescription>
            Request a viewing grant to decrypt and inspect Umbra transactions during disputes or compliance reviews.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">Target User ID</Label>
              <Input 
                id="userId"
                type="number" 
                placeholder="e.g. 1" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txnId">Transaction ID</Label>
              <Input 
                id="txnId"
                type="number" 
                placeholder="e.g. 42" 
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Request</Label>
              <Input 
                id="reason"
                placeholder="Required for audit logging" 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {requested && (
              <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md flex items-center gap-2 mt-4">
                <ShieldCheck className="w-4 h-4" />
                Request submitted securely. Awaiting cryptographic approval.
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={requestGrantMutation.isPending} className="w-full">
              {requestGrantMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Unlock className="w-5 h-5" />
            Active Grants
          </CardTitle>
          <CardDescription>
            Grants currently available for decryption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center py-12 space-y-3">
            <div className="p-4 bg-muted rounded-full">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No active grants</p>
            <p className="text-xs text-muted-foreground max-w-[250px]">
              Approved grants will appear here allowing you to view decrypted transaction details.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
