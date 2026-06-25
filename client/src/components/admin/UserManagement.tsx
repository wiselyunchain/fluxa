import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Lock, Unlock, Search, ChevronLeft, ChevronRight } from "lucide-react";

export function UserManagement() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 10;

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: users, isLoading, refetch } = trpc.admin.getUsers.useQuery({
    limit,
    offset: page * limit,
    search: debouncedSearch || undefined,
  });

  const toggleFreezeMutation = trpc.admin.toggleAccountFreeze.useMutation({
    onSuccess: () => refetch(),
  });
  const updateKycMutation = trpc.admin.updateKycStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const handleFreezeAccount = async (userId: number, currentFrozen: boolean) => {
    try {
      await toggleFreezeMutation.mutateAsync({
        userId,
        frozen: !currentFrozen,
        reason: !currentFrozen ? "Admin action via dashboard" : undefined,
      });
      toast.success(`Account ${!currentFrozen ? "frozen" : "unfrozen"} successfully`);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage user accounts, KYC status, and transaction limits</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or username..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : users && users.length > 0 ? (
            users.map((u) => (
              <Card key={u.id} className="bg-card/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{u.name || u.username || "Unknown"}</p>
                        {u.accountFrozen && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium">Frozen</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={u.kycStatus}
                        onValueChange={(val) => handleUpdateKyc(u.id, val)}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue placeholder="KYC Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant={u.accountFrozen ? "default" : "destructive"}
                        onClick={() => handleFreezeAccount(u.id, u.accountFrozen)}
                        className="gap-1 h-8 px-3 text-xs"
                      >
                        {u.accountFrozen ? (
                          <>
                            <Unlock className="w-3 h-3" />
                            Unfreeze
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            Freeze
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg">
              No users found matching your search.
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
            disabled={!users || users.length < limit || isLoading}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
