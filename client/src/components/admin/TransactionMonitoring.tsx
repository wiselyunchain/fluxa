import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, AlertTriangle, ArrowRightLeft, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";

export function TransactionMonitoring() {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const limit = 10;

  const { data: transactions, isLoading, refetch } = trpc.admin.getTransactions.useQuery({
    limit,
    offset: page * limit,
    type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const flagMutation = trpc.admin.flagTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction flagged successfully");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to flag transaction");
    }
  });

  const handleFlag = async (transactionId: number, reason: string, severity: "low" | "medium" | "high") => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    await flagMutation.mutateAsync({ transactionId, reason, severity });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "deposit": return <ArrowDownCircle className="w-5 h-5 text-green-500" />;
      case "withdrawal": return <ArrowUpCircle className="w-5 h-5 text-blue-500" />;
      case "swap": return <ArrowRightLeft className="w-5 h-5 text-purple-500" />;
      default: return <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "failed": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Monitoring</CardTitle>
        <CardDescription>Monitor all transactions, filter by type/status, and flag suspicious activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="deposit">Deposits</SelectItem>
              <SelectItem value="withdrawal">Withdrawals</SelectItem>
              <SelectItem value="swap">Swaps</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((txn) => (
              <Card key={txn.id} className="bg-card/50 shadow-sm border-l-4 border-l-transparent hover:border-l-primary transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-background rounded-full shadow-sm">
                        {getIcon(txn.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground capitalize">{txn.type}</p>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${getStatusColor(txn.status)}`}>
                            {txn.status}
                          </span>
                          {txn.isPrivate && (
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">Private</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(txn.createdAt), "MMM d, yyyy HH:mm")} • User #{txn.userId}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-1">
                      <p className="font-medium">
                        {txn.fromAmount} {txn.fromToken} 
                        {txn.toToken && txn.toToken !== txn.fromToken && ` → ${txn.toAmount} ${txn.toToken}`}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">
                        {txn.fromChain} {txn.toChain && `→ ${txn.toChain}`}
                      </p>
                    </div>

                    <div className="flex items-center">
                      <FlagDialog onFlag={(reason, severity) => handleFlag(txn.id, reason, severity)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg">
              No transactions found.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <div className="text-sm text-muted-foreground px-2">Page {page + 1}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!transactions || transactions.length < limit || isLoading}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FlagDialog({ onFlag }: { onFlag: (reason: string, severity: "low" | "medium" | "high") => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");

  const handleSubmit = () => {
    onFlag(reason, severity);
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Flag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag Transaction</DialogTitle>
          <DialogDescription>
            Mark this transaction as suspicious. This will create a risk alert for compliance review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Severity</label>
            <Select value={severity} onValueChange={(val: any) => setSeverity(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Input 
              placeholder="e.g., Unusually large transfer"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit}>Flag Transaction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
