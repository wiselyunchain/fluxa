import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Users, AlertTriangle, TrendingUp, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { UserManagement } from "@/components/admin/UserManagement";
import { TransactionMonitoring } from "@/components/admin/TransactionMonitoring";
import { ComplianceLogging } from "@/components/admin/ComplianceLogging";
import { ViewingGrants } from "@/components/admin/ViewingGrants";

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

  if (loading || statsLoading) {
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
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4 hidden sm:block" />
              Users
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <TrendingUp className="w-4 h-4 hidden sm:block" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="compliance" className="gap-2">
              <AlertTriangle className="w-4 h-4 hidden sm:block" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="grants" className="gap-2">
              <Lock className="w-4 h-4 hidden sm:block" />
              Grants
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionMonitoring />
          </TabsContent>

          <TabsContent value="compliance">
            <ComplianceLogging />
          </TabsContent>

          <TabsContent value="grants">
            <ViewingGrants />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
