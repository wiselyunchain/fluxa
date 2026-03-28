import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Users, AlertTriangle, TrendingUp, Lock, Unlock, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/");
    }
  }, [loading, isAuthenticated, user, navigate]);

  const { data: stats, isLoading: statsLoading } = trpc.admin.getDashboardStats.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: users, isLoading: usersLoading } = trpc.admin.getUsers.useQuery(
    { limit: 50 },
    { enabled: user?.role === "admin" }
  );

  const toggleFreezeMutation = trpc.admin.toggleAccountFreeze.useMutation();
  const updateKycMutation = trpc.admin.updateKycStatus.useMutation();

  const handleFreezeAccount = async (userId: number, currentFrozen: boolean) => {
    try {
      await toggleFreezeMutation.mutateAsync({
        userId,
        frozen: !currentFrozen,
      });
      toast.success(`Account ${!currentFrozen ? "frozen" : "unfrozen"}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update account");
    }
  };

  const handleUpdateKyc = async (userId: number, status: string) => {
    try {
      await updateKycMutation.mutateAsync({
        userId,
        status: status as any,
      });
      toast.success("KYC status updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update KYC");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="grid gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, monitor transactions, and control risk</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Active: {stats?.activeUsers || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats?.totalTransactions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Volume: ₦{stats?.totalVolume || "0"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pendingTransactions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Flagged</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.flaggedTransactions || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Risk alerts</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alerts
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user accounts, KYC status, and transaction limits
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {usersLoading ? (
                    <>
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </>
                  ) : users && users.length > 0 ? (
                    users.map((u) => (
                      <Card key={u.id} className="bg-card/50">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{u.name || u.username}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                              <div className="flex gap-2 mt-2">
                                <span className={`text-xs px-2 py-1 rounded ${u.kycStatus === "verified" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                                  KYC: {u.kycStatus}
                                </span>
                                {u.accountFrozen && (
                                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                                    Frozen
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFreezeAccount(u.id, u.accountFrozen)}
                                className="gap-1"
                              >
                                {u.accountFrozen ? (
                                  <>
                                    <Unlock className="w-4 h-4" />
                                    Unfreeze
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-4 h-4" />
                                    Freeze
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateKyc(u.id, u.kycStatus === "verified" ? "pending" : "verified")}
                              >
                                Update KYC
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Monitoring</CardTitle>
                <CardDescription>
                  Monitor all transactions and flag suspicious activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Transaction monitoring coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Risk Alerts</CardTitle>
                <CardDescription>
                  View and manage fraud detection and risk alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No active alerts
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
