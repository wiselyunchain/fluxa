import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, Send, ArrowRightLeft, TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const typeIcons: Record<string, any> = {
  deposit: <Download className="w-4 h-4" />,
  withdrawal: <Send className="w-4 h-4" />,
  swap: <ArrowRightLeft className="w-4 h-4" />,
  onramp: <TrendingUp className="w-4 h-4" />,
  offramp: <TrendingUp className="w-4 h-4" />,
};

const statusColors: Record<string, string> = {
  pending: "text-yellow-600",
  completed: "text-green-600",
  failed: "text-red-600",
  cancelled: "text-gray-600",
};

const statusIcons: Record<string, any> = {
  pending: <Clock className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

export default function History() {
  const { user, isAuthenticated } = useAuth();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: transactions, isLoading } = trpc.swap.getHistory.useQuery(
    {
      type: filterType !== "all" ? (filterType as any) : undefined,
      status: filterStatus !== "all" ? (filterStatus as any) : undefined,
      limit: 100,
    },
    { enabled: isAuthenticated }
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Transaction History</h1>
          <p className="text-muted-foreground">Your private transaction history (visible only to you)</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Search</label>
            <Input
              placeholder="Search by hash or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="swap">Swap</SelectItem>
                <SelectItem value="onramp">On-Ramp</SelectItem>
                <SelectItem value="offramp">Off-Ramp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <Card key={tx.id} className="hover:bg-card/80 transition cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    {/* Left: Icon and Details */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                        {typeIcons[tx.type] || <TrendingUp className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground capitalize">
                          {tx.type}
                          {tx.fromChain && tx.toChain && ` (${tx.fromChain} → ${tx.toChain})`}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {tx.description || `${tx.fromAmount} ${tx.fromToken?.toUpperCase()}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Amount */}
                    <div className="text-right mx-4">
                      <p className="font-semibold text-foreground">
                        {tx.fromAmount} {tx.fromToken?.toUpperCase()}
                      </p>
                      {tx.toAmount && (
                        <p className="text-sm text-accent">
                          → {tx.toAmount} {tx.toToken?.toUpperCase()}
                        </p>
                      )}
                    </div>

                    {/* Right: Status */}
                    <div className={`flex items-center gap-2 ${statusColors[tx.status]}`}>
                      {statusIcons[tx.status]}
                      <span className="text-sm font-medium capitalize">{tx.status}</span>
                    </div>
                  </div>

                  {/* Fee and Slippage Info */}
                  {(tx.fee || tx.slippage) && (
                    <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        {tx.fee && <span>Fee: {tx.fee} {tx.fromToken?.toUpperCase()}</span>}
                        {tx.slippage && <span>Slippage: {tx.slippage}%</span>}
                      </div>
                    </div>
                  )}

                  {/* Transaction Hash */}
                  {tx.txHash && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Hash: <span className="font-mono text-foreground">{tx.txHash.substring(0, 16)}...</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your transactions will appear here once you start trading
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Privacy Notice */}
        <Card className="mt-8 bg-accent/5 border-accent/20">
          <CardContent className="pt-6">
            <p className="text-sm text-foreground">
              <strong>🔒 Your Privacy:</strong> This transaction history is completely private. Only you can see your transactions. FluxaX does not share your transaction details with anyone.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
